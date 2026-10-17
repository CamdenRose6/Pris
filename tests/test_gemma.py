import json
import unittest
from unittest.mock import patch

from server import gemma_configured, request_gemma, validate


class GemmaTests(unittest.TestCase):
    @patch.dict('os.environ', {'GEMINI_API_KEY':'test-key'}, clear=True)
    def test_google_key_configures_gemma(self):
        self.assertTrue(gemma_configured())

    @patch.dict('os.environ', {}, clear=True)
    def test_missing_settings_leave_sample_mode(self):
        self.assertFalse(gemma_configured())

    @patch.dict('os.environ', {'GEMINI_API_KEY':'test-key'}, clear=True)
    def test_google_adapter_excludes_thoughts_and_keeps_key_in_header(self):
        result={'candidates':[{'finishReason':'STOP','content':{'parts':[{'text':'private thought','thought':True},{'text':'{"cards":[]}' }]}}]}
        with patch('urllib.request.urlopen') as provider:
            provider.return_value.__enter__.return_value.read.return_value=json.dumps(result).encode()
            self.assertEqual(request_gemma('lesson'),'{"cards":[]}')
            req=provider.call_args.args[0]
            self.assertIn('gemma-4-26b-a4b-it:generateContent',req.full_url)
            self.assertNotIn('test-key',req.full_url)

    @patch.dict('os.environ', {'GEMINI_API_KEY':'test-key'}, clear=True)
    def test_truncated_output_is_rejected(self):
        with patch('urllib.request.urlopen') as provider:
            provider.return_value.__enter__.return_value.read.return_value=json.dumps({'candidates':[{'finishReason':'MAX_TOKENS'}]}).encode()
            with self.assertRaises(ValueError): request_gemma('lesson')

    @patch.dict('os.environ', {'GEMINI_API_KEY':'google-key','GEMMA_API_URL':'https://provider.example/chat/completions','GEMMA_API_KEY':'other-key','GEMMA_MODEL':'gemma'}, clear=True)
    def test_explicit_compatible_provider_takes_precedence(self):
        with patch('urllib.request.urlopen') as provider:
            provider.return_value.__enter__.return_value.read.return_value=json.dumps({'choices':[{'message':{'content':'lesson'}}]}).encode()
            self.assertEqual(request_gemma('lesson'),'lesson')
            self.assertEqual(provider.call_args.args[0].full_url,'https://provider.example/chat/completions')

    def test_non_object_model_output_is_rejected(self):
        for value in ([], {'cards':[None]}, {'cards':[{'word':'cat','definition':'animal','sentence':'A cat naps.','imagePrompt':'cat','hint':'meow','quiz':[]}]}):
            with self.assertRaises(ValueError): validate(value)
