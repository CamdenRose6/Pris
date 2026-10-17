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

def speech_for_sound(sound):
    if not isinstance(sound,str) or sound not in SOUNDS:
        raise ValueError('Unknown letter sound')
    return '<phoneme alphabet="cmu-arpabet" ph="'+SOUNDS[sound]+'">sound</phoneme>'
