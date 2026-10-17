"""Allowlisted phoneme synthesis; never interpret client-supplied SSML."""
# Canonical sound IDs used by the browser; ARPAbet is sent only on the server.
SOUNDS = {
    'a':'AE1','e':'EH1','i':'IH1','o':'AA1','u':'AH1',
    'b':'B','d':'D','f':'F','g':'G','h':'HH','j':'JH','k':'K','l':'L','m':'M',
    'n':'N','p':'P','r':'R','s':'S','t':'T','v':'V','w':'W','y':'Y','z':'Z',
    'sh':'SH','ch':'CH','th':'TH','dh':'DH','ng':'NG','ee':'IY1','ay':'EY1',
    'eye':'AY1','oh':'OW1','oo':'UW1','book':'UH1','er':'ER1','ar':'AA1 R',
    'or':'AO1 R','aw':'AO1','ow':'AW1','oy':'OY1','x':'K S','qu':'K W','schwa':'AH0','ul':'AH0 L'
}

# Stop consonants need an audible release for the requested "cuh/buh/tuh" mode.
# Speak a phonetic respelling instead of sending an isolated consonant token.
SPOKEN_SOUNDS = {
    'k':'kuh', 'b':'buh', 'd':'duh', 'g':'guh', 'j':'juh', 'p':'puh', 't':'tuh'
}
PHONEME_LABELS = {
    'a':'aah','e':'eh','i':'ih','o':'ah','u':'uh','f':'fff','h':'hhh','l':'lll',
    'm':'mmm','n':'nnn','r':'rrr','s':'sss','v':'vvv','w':'wuh','y':'yuh','z':'zzz',
    'sh':'shh','ch':'chuh','th':'thh','dh':'thuh','ng':'ng','ee':'ee','ay':'ay',
    'eye':'eye','oh':'oh','oo':'oo','book':'uh','er':'er','ar':'ar','or':'or',
    'aw':'aw','ow':'ow','oy':'oy','x':'ks','qu':'kwuh','schwa':'uh','ul':'ul'
}

def model_for_sound(sound):
    return 'eleven_multilingual_v2' if sound in SPOKEN_SOUNDS else 'eleven_flash_v2'

def speech_for_sound(sound):
    if not isinstance(sound,str) or sound not in SOUNDS:
        raise ValueError('Unknown letter sound')
    if sound in SPOKEN_SOUNDS:
        return SPOKEN_SOUNDS[sound]
    return '<phoneme alphabet="cmu-arpabet" ph="'+SOUNDS[sound]+'">'+PHONEME_LABELS[sound]+'</phoneme>'
