import io
import json
import unittest
from unittest.mock import patch
from server import Handler, AUDIO_CACHE


class SpeechTests(unittest.TestCase):
    def setUp(self):
        import tempfile
        from pathlib import Path
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        recordings = patch('phonics.RECORDINGS', Path(directory.name))
        recordings.start()
        self.addCleanup(recordings.stop)
        bundled = patch('phonics.BUNDLED_RECORDINGS', Path(directory.name))
        bundled.start()
        self.addCleanup(bundled.stop)

    def handler(self, payload):
        body = json.dumps(payload).encode()
        handler = Handler.__new__(Handler)
        handler.headers = {'Content-Length': str(len(body))}
        handler.rfile = io.BytesIO(body)
        handler.wfile = io.BytesIO()
        handler.reply = lambda status, value: setattr(handler, 'result', (status, value))
        handler.send_response = lambda status: setattr(handler, 'status', status)
        handler.send_header = lambda *args: None
        handler.end_headers = lambda: None
        return handler

    @patch.dict('os.environ', {}, clear=True)
    def test_missing_credentials_are_explicit(self):
        handler = self.handler({'text': 'cat'})
        handler.create_speech()
        self.assertEqual(handler.result[0], 503)

    @patch.dict('os.environ', {'ELEVENLABS_API_KEY':'test', 'ELEVENLABS_VOICE_ID':'test'})
    def test_invalid_text_does_not_reach_provider(self):
        with patch('urllib.request.urlopen') as provider:
            handler = self.handler({'text':'x' * 601})
            handler.create_speech()
            self.assertEqual(handler.result[0], 400)
            provider.assert_not_called()

    @patch.dict('os.environ', {'ELEVENLABS_API_KEY':'test', 'ELEVENLABS_VOICE_ID':'test'})
    def test_repeat_play_uses_cache(self):
        AUDIO_CACHE.clear()
        with patch('urllib.request.urlopen') as provider:
            provider.return_value.__enter__.return_value.read.return_value = b'test-mp3'
            for _ in range(2):
                handler = self.handler({'text':'cat', 'slow':True})
                handler.create_speech()
                self.assertEqual(handler.status, 200)
                self.assertEqual(handler.wfile.getvalue(), b'test-mp3')
            self.assertEqual(provider.call_count, 1)
            payload = json.loads(provider.call_args.args[0].data)
            self.assertEqual(payload['voice_settings']['speed'], .85)
        AUDIO_CACHE.clear()

    @patch.dict('os.environ', {'ELEVENLABS_API_KEY':'test', 'ELEVENLABS_VOICE_ID':'test'})
    def test_c_uses_pure_consonant_without_added_vowel(self):
        AUDIO_CACHE.clear()
        with patch('urllib.request.urlopen') as provider:
            provider.return_value.__enter__.return_value.read.return_value = b'test-mp3'
            handler = self.handler({'sound':'k','text':'c'})
            handler.create_speech()
            self.assertEqual(handler.status,200)
            payload=json.loads(provider.call_args.args[0].data)
            self.assertEqual(payload['model_id'],'eleven_v4')
            self.assertEqual(payload['text'],'/k/')
            self.assertNotIn('kuh',payload['text'])
        AUDIO_CACHE.clear()

    @patch.dict('os.environ', {'ELEVENLABS_API_KEY':'test', 'ELEVENLABS_VOICE_ID':'test'})
    def test_vowel_uses_explicit_phoneme(self):
        AUDIO_CACHE.clear()
        with patch('urllib.request.urlopen') as provider:
            provider.return_value.__enter__.return_value.read.return_value = b'test-mp3'
            handler = self.handler({'sound':'a','text':'a'})
            handler.create_speech()
            payload=json.loads(provider.call_args.args[0].data)
            self.assertEqual(payload['model_id'],'eleven_v4')
            self.assertEqual(payload['text'],'/æ/')
            self.assertNotIn('>sound<',payload['text'])
        AUDIO_CACHE.clear()

    @patch.dict('os.environ', {'ELEVENLABS_API_KEY':'test', 'ELEVENLABS_VOICE_ID':'test'})
    def test_untrusted_phoneme_markup_is_rejected(self):
        with patch('urllib.request.urlopen') as provider:
            handler=self.handler({'sound':'<phoneme ph="BAD">','text':'c'})
            handler.create_speech()
            self.assertEqual(handler.result[0],400)
            provider.assert_not_called()

    @patch.dict('os.environ', {}, clear=True)
    def test_reviewed_sound_works_without_credentials_or_provider(self):
        import tempfile
        from pathlib import Path
        with tempfile.TemporaryDirectory() as directory, patch('phonics.RECORDINGS', Path(directory)), patch('urllib.request.urlopen') as provider:
            Path(directory, 'k.mp3').write_bytes(b'reviewed-hard-k')
            for slow in (False, True):
                handler = self.handler({'sound':'k', 'slow':slow})
                handler.create_speech()
                self.assertEqual(handler.status, 200)
                self.assertEqual(handler.wfile.getvalue(), b'reviewed-hard-k')
            Path(directory, 'k.slow.mp3').write_bytes(b'reviewed-slow-k')
            handler = self.handler({'sound':'k', 'slow':True})
            handler.create_speech()
            self.assertEqual(handler.wfile.getvalue(), b'reviewed-slow-k')
            provider.assert_not_called()

    @patch.dict('os.environ', {}, clear=True)
    def test_recording_path_cannot_be_controlled_by_client(self):
        handler = self.handler({'sound':'../../private'})
        handler.create_speech()
        self.assertEqual(handler.result[0], 400)
