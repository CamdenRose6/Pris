import base64
import json
import tempfile
import unittest
import urllib.error
from pathlib import Path
from unittest.mock import patch

import images
from test_images import PNG


@patch.dict('os.environ', {'IMAGE_PROVIDER':'cloudflare', 'CLOUDFLARE_ACCOUNT_ID':'a'*32, 'CLOUDFLARE_API_TOKEN':'test-cf-token'}, clear=True)
class CloudflareImagesTests(unittest.TestCase):
    def setUp(self):
        directory=tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        patcher=patch.object(images,'CACHE',Path(directory.name))
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_flux_response_saved_and_reused(self):
        with patch('urllib.request.urlopen') as provider:
            provider.return_value.__enter__.return_value.read.return_value=json.dumps({'success':True,'result':{'image':base64.b64encode(PNG).decode()}}).encode()
            result=images.generate({'word':'cat'})
            self.assertEqual(result['provider'],'cloudflare')
            self.assertEqual(result['model'],images.FLUX_MODEL)
            self.assertTrue(images.generate({'word':'cat'})['cached'])
            self.assertEqual(provider.call_count,1)
            request=provider.call_args.args[0]
            self.assertIn('/ai/run/@cf/black-forest-labs/flux-1-schnell',request.full_url)
            self.assertNotIn('test-cf-token',request.full_url)
            self.assertEqual((images.CACHE/result['imageUrl'].split('/')[-1]).read_bytes(),PNG)

    def test_failure_never_falls_back_to_google(self):
        with patch.dict('os.environ',{'GEMINI_API_KEY':'available-but-not-used'}):
            with patch('urllib.request.urlopen',side_effect=urllib.error.HTTPError('https://example.com',429,'quota',{},None)) as provider:
                with self.assertRaisesRegex(images.ImageError,'no paid fallback'):
                    images.generate({'word':'cat'})
                self.assertEqual(provider.call_count,1)
                self.assertIn('api.cloudflare.com',provider.call_args.args[0].full_url)

    def test_bad_account_id_rejected_before_request(self):
        with patch.dict('os.environ',{'CLOUDFLARE_ACCOUNT_ID':'not/an/account'}):
            with patch('urllib.request.urlopen') as provider:
                with self.assertRaisesRegex(images.ImageError,'account ID'):
                    images.generate({'word':'cat'})
                provider.assert_not_called()

    def test_invalid_provider_image_is_rejected(self):
        with patch('urllib.request.urlopen') as provider:
            provider.return_value.__enter__.return_value.read.return_value=json.dumps({'success':True,'result':{'image':'invalid base64!'}}).encode()
            with self.assertRaises(images.ImageError):images.generate({'word':'cat'})
