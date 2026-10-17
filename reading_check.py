"""Short-utterance recognition, with conservative feedback rather than grading."""
import base64
import binascii
import json
import math
import os
import re
import secrets
import urllib.error
import urllib.request


class CheckError(Exception):
    def __init__(self, message, status=502):
        super().__init__(message)
        self.status = status


HOMOPHONES = [set(group.split()) for group in (
    'sun son', 'see sea', 'blue blew', 'no know', 'one won',
    'two to too', 'here hear', 'right write', 'I eye', 'be bee', 'for four',
    'their there theyre', 'flower flour', 'night knight'
)]


def normalize(text):
    return ' '.join(re.findall(r"[a-z]+(?:'[a-z]+)?", str(text).lower()))


def evaluate(target, result):
    text = result.get('text', '')
    tokens = [word for word in result.get('words', []) if word.get('type') == 'word']
    heard, expected = normalize(text), normalize(target)
    # Confidence is a conservative heuristic, not a calibrated assessment.
    scores = [word['logprob'] for word in tokens if isinstance(word.get('logprob'), (int, float)) and math.isfinite(word['logprob'])]
    confident = bool(tokens and len(scores) == len(tokens) and min(scores) >= -1.0)
    if not heard or not confident or len(heard.split()) > len(expected.split()) + 2:
        return {'outcome':'unclear','transcript':text[:300], 'message':'I couldn’t hear that clearly. Try again—this attempt won’t count.'}
    # Accept a natural article prefix, but not a sentence containing the answer.
    variants = {heard}
    if heard.startswith(('a ', 'the ')):
        variants.add(heard.split(' ', 1)[1])
    accepted = {expected}
    for group in HOMOPHONES:
        normalized = {normalize(word) for word in group}
        if expected in normalized:
            accepted.update(normalized)
    if variants & accepted:
        return {'outcome':'correct','transcript':text[:300], 'message':'You got it! Great reading.'}
    if len(heard.split()) != len(expected.split()):
        return {'outcome':'unclear','transcript':text[:300], 'message':'Say just the word on the card. This attempt won’t count.'}
    return {'outcome':'retry','transcript':text[:300], 'message':'That sounded like a different word. Let’s try again.'}


def check(data):
    if not isinstance(data, dict):
        raise CheckError('Invalid recording request.', 400)
    target, encoded, mime = data.get('word'), data.get('audio'), data.get('mime', '').split(';')[0]
    if not isinstance(target, str) or not normalize(target) or len(target) > 100:
        raise CheckError('Invalid reading word.',400)
    types={'audio/webm':'webm','audio/mp4':'mp4','audio/ogg':'ogg','audio/wav':'wav','audio/mpeg':'mp3'}
    if mime not in types or not isinstance(encoded,str) or len(encoded)>2_800_000:
        raise CheckError('Use a short supported audio recording.',400)
    try:
        audio=base64.b64decode(encoded,validate=True)
    except (ValueError,TypeError,binascii.Error):
        raise CheckError('Invalid recording.',400) from None
    if not 100 <= len(audio) <= 2_000_000:
        raise CheckError('Recording was empty or too large. Try a short word.',400)
    key=os.getenv('ELEVENLABS_API_KEY')
    if not key:
        raise CheckError('Configure an ElevenLabs key with Speech to Text access.',503)
    boundary='WordRing'+secrets.token_hex(20)
    body=bytearray()
    for name,value in {'model_id':'scribe_v2','language_code':'en','tag_audio_events':'false','diarize':'false'}.items():
        body.extend(f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode())
    body.extend(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="attempt.{types[mime]}"\r\nContent-Type: {mime}\r\n\r\n'.encode())
    body.extend(audio)
    body.extend(f'\r\n--{boundary}--\r\n'.encode())
    request=urllib.request.Request('https://api.elevenlabs.io/v1/speech-to-text',data=bytes(body),headers={'xi-api-key':key,'Content-Type':'multipart/form-data; boundary='+boundary})
    try:
        with urllib.request.urlopen(request,timeout=45) as response:
            result=json.load(response)
        return evaluate(target,result)
    except urllib.error.HTTPError as error:
        if error.code in (401,403):
            raise CheckError('Enable Speech to Text access for your ElevenLabs API key, then try again.',503) from None
        if error.code in (402,429):
            raise CheckError('Speech recognition credits or quota are unavailable. This attempt won’t count.',503) from None
        raise CheckError('Speech recognition is unavailable. Try again—this attempt won’t count.') from None
    except (urllib.error.URLError,TimeoutError,ValueError,TypeError,AttributeError):
        raise CheckError('Couldn’t check the recording. Try again—this attempt won’t count.') from None
