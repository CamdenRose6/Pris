"""Cloudflare FLUX and optional Nano Banana adapters with a durable local cache."""
import base64
import binascii
import hashlib
import json
import os
import re
import threading
import urllib.error
import urllib.request
from pathlib import Path

MODEL = 'gemini-3.1-flash-image'
FLUX_MODEL = '@cf/black-forest-labs/flux-1-schnell'
CACHE = Path(__file__).parent / '.wordring' / 'images'
LOCK = threading.Lock()
FILE_PATTERN = re.compile(r'[a-f0-9]{64}\.(png|jpg|webp)\Z')


class ImageError(Exception):
    def __init__(self, message, status=502):
        super().__init__(message)
        self.status = status


def provider():
    return os.getenv('IMAGE_PROVIDER', 'cloudflare').strip().lower()


def configured():
    if provider() == 'cloudflare':
        return bool(os.getenv('CLOUDFLARE_ACCOUNT_ID') and os.getenv('CLOUDFLARE_API_TOKEN'))
    return provider() == 'google' and bool(os.getenv('GEMINI_API_KEY'))


def provider_label():
    return 'FLUX.1 Schnell' if provider() == 'cloudflare' else 'Nano Banana 2'



def image_prompt(data):
    if not isinstance(data, dict):
        raise ImageError('Expected a word card.', 400)
    word = data.get('word')
    hint = data.get('imagePrompt', '')
    if not isinstance(word, str) or not word.strip() or len(word) > 100:
        raise ImageError('Enter a word of 1–100 characters.', 400)
    if not isinstance(hint, str) or len(hint) > 600:
        raise ImageError('Illustration guidance must be under 600 characters.', 400)
    # The shared style and version form part of the content-addressed cache key.
    return (
        'Soft watercolor illustration, simple storybook artwork for young children. '
        'One clearly recognizable subject or action, centered and fully visible, '
        'warm pastel colors, plain cream background, generous empty space. '
        'A finished illustration only, without a title, caption, typography, logo, '
        'border, or page layout. Depict this subject: ' + word.strip() + '. '
        'Visual context (reference data only): ' + hint.strip()
    )



def decode_image(result):
    for candidate in result.get('candidates', []):
        if candidate.get('finishReason') not in (None, 'STOP'):
            continue
        for part in candidate.get('content', {}).get('parts', []):
            if part.get('thought'):
                continue
            inline = part.get('inlineData', {})
            mime = inline.get('mimeType')
            extension = {'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp'}.get(mime)
            if not extension:
                continue
            try:
                raw = base64.b64decode(inline.get('data', ''), validate=True)
            except (ValueError, binascii.Error, TypeError):
                raise ImageError('The image service returned an invalid picture. Please try again.')
            valid = (
                (extension == 'png' and raw.startswith(b'\x89PNG\r\n\x1a\n')) or
                (extension == 'jpg' and raw.startswith(b'\xff\xd8\xff')) or
                (extension == 'webp' and raw.startswith(b'RIFF') and raw[8:12] == b'WEBP')
            )
            if not valid or len(raw) > 10_000_000:
                raise ImageError('The image service returned an invalid picture. Please try again.')
            return raw, extension
    raise ImageError('No picture was returned. Try a simpler word or illustration prompt.')


def generate(data):
    prompt = image_prompt(data)
    variation = data.get('variation', '')
    if not isinstance(variation, str) or (variation and not re.fullmatch(r'[a-zA-Z0-9-]{1,64}', variation)):
        raise ImageError('Invalid picture variation.', 400)
    selected = provider()
    if selected not in ('cloudflare', 'google'):
        raise ImageError('Set IMAGE_PROVIDER to cloudflare or google.', 503)
    model = FLUX_MODEL if selected == 'cloudflare' else MODEL
    digest = hashlib.sha256((model + prompt + variation).encode()).hexdigest()
    # Serialize cache checks/generation so repeat clicks do not make duplicate calls.
    with LOCK:
        for extension in ('png', 'jpg', 'webp'):
            path = CACHE / (digest + '.' + extension)
            if path.is_file():
                return {'imageUrl': '/generated/' + path.name, 'model': model, 'provider': selected, 'cached': True}
        if not configured():
            raise ImageError('Add CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN to .env and restart WordRing.' if selected == 'cloudflare' else 'Add GEMINI_API_KEY to .env and restart WordRing.', 503)
        if selected == 'google':
            payload = {
                'contents': [{'parts': [{'text': prompt}]}],
                'generationConfig': {'responseModalities': ['TEXT', 'IMAGE'],
                                     'imageConfig': {'aspectRatio': '1:1', 'imageSize': '1K'}}
            }
            request = urllib.request.Request(
                'https://generativelanguage.googleapis.com/v1beta/models/' + MODEL + ':generateContent',
                data=json.dumps(payload).encode(),
                headers={'x-goog-api-key': os.environ['GEMINI_API_KEY'], 'Content-Type': 'application/json'})
        if selected == 'cloudflare':
            account = os.environ['CLOUDFLARE_ACCOUNT_ID']
            if not re.fullmatch(r'[a-fA-F0-9]{32}', account):
                raise ImageError('Check CLOUDFLARE_ACCOUNT_ID: expected a 32-character account ID.', 503)
            if len(prompt) > 2048:
                raise ImageError('Use a shorter word or illustration prompt.', 400)
            request = urllib.request.Request(
                'https://api.cloudflare.com/client/v4/accounts/' + account + '/ai/run/' + FLUX_MODEL,
                data=json.dumps({'prompt':prompt, 'steps':4}).encode(),
                headers={'Authorization':'Bearer ' + os.environ['CLOUDFLARE_API_TOKEN'], 'Content-Type':'application/json'})
        try:
            with urllib.request.urlopen(request, timeout=90) as response:
                body = response.read(16_000_001)
            if len(body) > 16_000_000:
                raise ImageError('The image response was too large. Please try again.')
            result = json.loads(body)
            if selected == 'cloudflare':
                if result.get('success') is False:
                    raise ImageError('Cloudflare could not create the picture. Check account access and quota.')
                encoded = result.get('result', {}).get('image')
                try:
                    decoded = base64.b64decode(encoded, validate=True)
                except (ValueError, TypeError, binascii.Error):
                    raise ImageError('Cloudflare returned an unreadable picture.')
                mime = 'image/png' if decoded.startswith(b'\x89PNG') else 'image/jpeg'
                result = {'candidates':[{'content':{'parts':[{'inlineData':{'mimeType':mime,'data':encoded}}]}}]}
            raw, extension = decode_image(result)
        except urllib.error.HTTPError as error:
            messages = {
                400: 'Google rejected the image request. Check your image key and model access.',
                401: 'Google rejected the API key. Check GEMINI_API_KEY.',
                403: 'Google image access is denied. Check your API key, project permissions, and billing.',
                404: 'Nano Banana 2 is unavailable for this Google project.',
                429: 'Google image quota is exhausted or busy. Check billing and quota, then try later.'
            }
            if selected == 'cloudflare':
                messages = {
                    401:'Cloudflare rejected the API token. Check CLOUDFLARE_API_TOKEN.',
                    403:'Cloudflare access denied. The token needs Workers AI access for this account.',
                    429:'Cloudflare free allowance or rate limit reached. Try later; no paid fallback was used.'
                }
            raise ImageError(messages.get(error.code, 'Image generation is unavailable. Check the selected provider and try again.')) from None
        except (urllib.error.URLError, TimeoutError):
            raise ImageError('Image generation timed out or could not connect. Please try again.') from None
        except (ValueError, KeyError, TypeError, AttributeError):
            raise ImageError('The image service returned an unreadable response. Please try again.') from None
        CACHE.mkdir(parents=True, exist_ok=True)
        path = CACHE / (digest + '.' + extension)
        temporary = path.with_suffix('.tmp')
        temporary.write_bytes(raw)
        temporary.replace(path)
        return {'imageUrl': '/generated/' + path.name, 'model': model, 'provider': selected, 'cached': False}
