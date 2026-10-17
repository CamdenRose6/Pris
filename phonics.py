"""Allowlisted phoneme synthesis; never interpret client-supplied SSML."""
from pathlib import Path

# Canonical sound IDs used by the browser; ARPAbet retained as reference; synthesis uses IPA below.
SOUNDS = {
    'a':'AE1','e':'EH1','i':'IH1','o':'AA1','u':'AH1',
    'b':'B','d':'D','f':'F','g':'G','h':'HH','j':'JH','k':'K','l':'L','m':'M',
    'n':'N','p':'P','r':'R','s':'S','t':'T','v':'V','w':'W','y':'Y','z':'Z',
    'sh':'SH','ch':'CH','th':'TH','dh':'DH','ng':'NG','ee':'IY1','ay':'EY1',
    'eye':'AY1','oh':'OW1','oo':'UW1','book':'UH1','er':'ER1','ar':'AA1 R',
    'or':'AO1 R','aw':'AO1','ow':'AW1','oy':'OY1','x':'K S','qu':'K W','schwa':'AH0','ul':'AH0 L'
}

# Eleven v4 consumes IPA directly. Keep the entire request to the target sound:
# no letter names, example words, or spoken coaching.
# Bare stop-consonant IPA can be spoken as punctuation by the selected voice.
# Use short audible respellings for b, d, and p.
# Warm delivery keeps d from taking the dismissive tone of the word “duh”.
IPA_SOUNDS = {
    'a':'æ','e':'ɛ','i':'ɪ','o':'ɑ','u':'ʌ',
    'b':'b','d':'d','f':'f','g':'ɡ','h':'h','j':'dʒ','k':'k','l':'l','m':'m',
    'n':'n','p':'p','r':'ɹ','s':'s','t':'t','v':'v','w':'w','y':'j','z':'z',
    'sh':'ʃ','ch':'tʃ','th':'θ','dh':'ð','ng':'ŋ','ee':'iː','ay':'eɪ',
    'eye':'aɪ','oh':'oʊ','oo':'uː','book':'ʊ','er':'ɝ','ar':'ɑɹ',
    'or':'ɔɹ','aw':'ɔ','ow':'aʊ','oy':'ɔɪ','x':'ks','qu':'kw',
    'schwa':'ə','ul':'əl'
}

RECORDINGS = Path(__file__).parent / '.wordring' / 'phonics' / 'reviewed'
BUNDLED_RECORDINGS = Path(__file__).parent / 'assets' / 'phonics'


def validate_sound(sound):
    if not isinstance(sound, str) or sound not in SOUNDS:
        raise ValueError('Unknown letter sound')


def recorded_sound(sound, slow=False):
    """Only explicitly installed, reviewed MP3s override generated sound audio."""
    validate_sound(sound)
    # Separate slow recordings preserve brief stops instead of stretching them.
    names = [sound + '.slow.mp3', sound + '.mp3'] if slow else [sound + '.mp3']
    path = next((folder / name for folder in (RECORDINGS, BUNDLED_RECORDINGS) for name in names if (folder / name).is_file()), None)
    if path is None:
        return None
    with path.open('rb') as recording:
        audio = recording.read(4_000_001)
    if not audio or len(audio) > 4_000_000:
        raise ValueError('Invalid reviewed sound recording')
    return audio


def model_for_sound(sound):
    validate_sound(sound)
    return 'eleven_v4'


def speech_for_sound(sound):
    validate_sound(sound)
    if sound in ('b', 'd', 'p'):
        return {'b': 'buh', 'd': '[warmly] duh.', 'p': '[warmly] puh.'}[sound]
    return '/' + IPA_SOUNDS[sound] + '/'
