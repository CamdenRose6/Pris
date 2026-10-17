import base64
import json
import unittest
import urllib.error
from unittest.mock import patch

import reading_check as reading


def recognition(text, confidence=-.1):
    return {'text':text,'words':[{'type':'word','text':word,'logprob':confidence} for word in text.split()]}


class ReadingCheckTests(unittest.TestCase):
    def test_correct_word_is_case_and_punctuation_insensitive(self):
        self.assertEqual(reading.evaluate('cat',recognition('Cat!'))['outcome'],'correct')

    def test_confident_different_word_is_retry(self):
        self.assertEqual(reading.evaluate('cat',recognition('dog'))['outcome'],'retry')

    def test_unclear_audio_never_counts_as_wrong(self):
        for result in ({'text':'','words':[]},recognition('dog',-2),{'text':'cat','words':[]},recognition('dog',float('nan'))):
            self.assertEqual(reading.evaluate('cat',result)['outcome'],'unclear')

    def test_sentence_containing_target_is_not_accepted(self):
        self.assertEqual(reading.evaluate('cat',recognition('I saw a cat today'))['outcome'],'unclear')

    def test_articles_and_homophones_do_not_penalize_readers(self):
        self.assertEqual(reading.evaluate('cat',recognition('a cat'))['outcome'],'correct')
        self.assertEqual(reading.evaluate('sun',recognition('son'))['outcome'],'correct')
        self.assertEqual(reading.evaluate('cat',recognition('cap'))['outcome'],'retry')

    @patch.dict('os.environ',{'ELEVENLABS_API_KEY':'test-only'},clear=True)
    def test_target_is_not_sent_to_bias_transcription(self):
        with patch('urllib.request.urlopen') as provider:
            provider.return_value.__enter__.return_value.read.return_value=json.dumps(recognition('cat')).encode()
            result=reading.check({'word':'cat','mime':'audio/webm;codecs=opus','audio':base64.b64encode(b'x'*100).decode()})
            self.assertEqual(result['outcome'],'correct')
            payload=provider.call_args.args[0].data
            self.assertIn(b'scribe_v2',payload)
            self.assertNotIn(b'cat',payload)
            self.assertNotIn(b'keyterms',payload)

    @patch.dict('os.environ',{'ELEVENLABS_API_KEY':'test-only'},clear=True)
    def test_permissions_error_has_actionable_message(self):
        with patch('urllib.request.urlopen',side_effect=urllib.error.HTTPError('https://example.com',403,'denied',{},None)):
            with self.assertRaisesRegex(reading.CheckError,'Speech to Text'):
                reading.check({'word':'cat','mime':'audio/webm','audio':base64.b64encode(b'x'*100).decode()})

    def test_bad_inputs_never_reach_provider(self):
        with patch('urllib.request.urlopen') as provider:
            for value in ([],{}, {'word':'cat','mime':'audio/webm','audio':'invalid'}, {'word':'cat','mime':'text/plain','audio':'x'}):
                with self.assertRaises(reading.CheckError):reading.check(value)
            provider.assert_not_called()
