import unittest
import phonics


class PhonicsTests(unittest.TestCase):
    def test_consonants_do_not_add_a_vowel_or_narration(self):
        for sound, expected in {'g':'ɡ','k':'k','t':'t','j':'dʒ','ch':'tʃ'}.items():
            with self.subTest(sound=sound):
                self.assertEqual(phonics.speech_for_sound(sound), f'/{expected}/')
                self.assertEqual(phonics.model_for_sound(sound), 'eleven_v4')

    def test_b_d_and_p_use_audible_respelling_without_slashes(self):
        self.assertEqual(phonics.speech_for_sound('p'), '[warmly] puh.')
        self.assertEqual(phonics.speech_for_sound('b'), 'buh')
        self.assertEqual(phonics.speech_for_sound('d'), '[warmly] duh.')

    def test_remaining_sounds_have_direct_ipa(self):
        self.assertEqual(set(phonics.IPA_SOUNDS), set(phonics.SOUNDS))
        for sound in set(phonics.SOUNDS) - {'b', 'd', 'p'}:
            request = phonics.speech_for_sound(sound)
            self.assertTrue(request.startswith('/') and request.endswith('/'))
            self.assertNotIn('<', request)
            self.assertNotIn(' ', request)

    def test_invalid_sounds_are_rejected(self):
        for sound in ['silent', 'unknown', '<phoneme>', None, {}, []]:
            with self.assertRaises(ValueError):
                phonics.speech_for_sound(sound)

    def test_short_vowels_are_distinct_from_letter_names(self):
        for sound, expected in {'a':'/æ/','e':'/ɛ/','i':'/ɪ/','o':'/ɑ/','u':'/ʌ/'}.items():
            self.assertEqual(phonics.speech_for_sound(sound), expected)
        self.assertEqual(phonics.speech_for_sound('ay'), '/eɪ/')

    def test_selected_p_recording_is_available_without_local_cache(self):
        import tempfile
        from pathlib import Path
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as directory, patch('phonics.RECORDINGS', Path(directory)):
            normal=phonics.recorded_sound('p')
            self.assertEqual(len(normal),10866)
            self.assertEqual(phonics.recorded_sound('p',True),normal)
            import hashlib
            self.assertEqual(hashlib.sha256(normal).hexdigest(), '5b0e5df3f07e68bfa08cf88deb39adb5f1621c3fbe90a6dd54d5d633ca542d41')
