import base64
import io
import json
import tempfile
import unittest
import urllib.error
from pathlib import Path
from unittest.mock import patch

import images
from server import Handler

PNG = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII=')


class ImageTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        patcher = patch.object(images, 'CACHE', Path(self.directory.name))
        patcher.start()
        self.addCleanup(patcher.stop)

    def provider_result(self):
        return {'candidates':[{'finishReason':'STOP','content':{'parts':[{'inlineData':{'mimeType':'image/png','data':base64.b64encode(PNG).decode()}}]}}]}

    @patch.dict('os.environ', {}, clear=True)
    def test_missing_key_is_explicit(self):
        with self.assertRaises(images.ImageError) as error:
            images.generate({'word':'cat'})
        self.assertEqual(error.exception.status, 503)

    def test_invalid_inputs_never_call_provider(self):
        with patch('urllib.request.urlopen') as provider:
            for data in ([], {}, {'word':' '}, {'word':'a'*101}, {'word':'cat','imagePrompt':42}):
                with self.assertRaises(images.ImageError): images.generate(data)
            provider.assert_not_called()

    @patch.dict('os.environ', {'GEMINI_API_KEY':'test-only'})
    def test_image_is_saved_and_reused_without_api_key(self):
        with patch('urllib.request.urlopen') as provider:
            provider.return_value.__enter__.return_value.read.return_value=json.dumps(self.provider_result()).encode()
            first=images.generate({'word':'cat'})
            with patch.dict('os.environ', {}, clear=True):
                second=images.generate({'word':'cat'})
            self.assertFalse(first['cached'])
            self.assertTrue(second['cached'])
            self.assertEqual(first['imageUrl'],second['imageUrl'])
            self.assertEqual((images.CACHE / first['imageUrl'].split('/')[-1]).read_bytes(),PNG)
            self.assertEqual(provider.call_count,1)
            request=provider.call_args.args[0]
            self.assertIn('gemini-3.1-flash-image:generateContent',request.full_url)
            self.assertNotIn('test-only',request.full_url)

    def test_blocked_or_non_image_output_is_rejected(self):
        for result in ({'promptFeedback':{'blockReason':'SAFETY'}}, {'candidates':[{'finishReason':'SAFETY'}]}, {'candidates':[{'content':{'parts':[{'text':'No image'}]}}]}):
            with self.assertRaises(images.ImageError): images.decode_image(result)

    def test_invalid_image_bytes_are_rejected(self):
        result=self.provider_result()
        result['candidates'][0]['content']['parts'][0]['inlineData']['data']=base64.b64encode(b'not an image').decode()
        with self.assertRaises(images.ImageError): images.decode_image(result)

    @patch.dict('os.environ', {'GEMINI_API_KEY':'test-only'})
    def test_quota_error_is_actionable_and_not_cached(self):
        with patch('urllib.request.urlopen',side_effect=urllib.error.HTTPError('https://example.com',429,'quota',{},None)):
            with self.assertRaisesRegex(images.ImageError,'quota'):
                images.generate({'word':'cat'})
        self.assertEqual(list(images.CACHE.iterdir()),[])

    def test_generated_route_rejects_path_traversal(self):
        handler=Handler.__new__(Handler)
        handler.path='/generated/../../.env'
        handler.reply=lambda status,value:setattr(handler,'result',status)
        handler.do_GET()
        self.assertEqual(handler.result,404)

    def test_generated_route_returns_saved_bytes(self):
        filename='a'*64+'.png'
        (images.CACHE/filename).write_bytes(PNG)
        handler=Handler.__new__(Handler)
        handler.path='/generated/'+filename
        handler.wfile=io.BytesIO()
        handler.send_response=lambda status:setattr(handler,'status',status)
        handler.send_header=lambda *args:None
        handler.end_headers=lambda:None
        handler.do_GET()
        self.assertEqual(handler.status,200)
        self.assertEqual(handler.wfile.getvalue(),PNG)
