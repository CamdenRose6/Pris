# Partner handoff

## Product priority

Teach reading first. The base tab shows a large word with optional spoken pronunciation. Flipping reveals a supporting picture and sentence. Quizzes and vocabulary expansion are secondary. Preserve Gemma's eventual role as the learning-content engine.

## Architecture

A dependency-free Python `ThreadingHTTPServer` serves `public/` and handles the API routes below. Browser JavaScript calls relative `/api/` URLs. Only `public/` is served, keeping the root `.env` outside the static file tree. The app binds to `127.0.0.1:8765`.

`load_local_settings()` reads allowlisted key/value settings without executing shell syntax. It runs when starting `server.py`; exported settings take precedence. Changes require a server restart.

### Browser data

- `wordring-v1`: JSON object with `cards` and `folders` arrays.
- Each card has an `id`, `word`, `folder`, `grade`, and `source` (`sample`, `manual`, or `gemma`). Generated/sample cards additionally have `definition`, `sentence`, `imagePrompt`, `hint`, and `quiz`. Sample cards may have an `emoji`.
- Quiz format: `{ "question": "…", "choices": ["…", "…", "…"], "answer": 0 }`. `answer` is the zero-based correct choice index.
- `wordring-voice` and `wordring-slow`: local voice preferences.

Manual cards do not have quizzes. There is no backend learner database, cross-device sync, or shared progress store.

## API contracts

### GET /api/status

Returns `{ "gemma": false, "naturalSpeech": false }` with flags based on configured settings. These flags indicate configuration presence, not a successful provider health check. Never return credentials.

### POST /api/speech

Request: `{ "text": "The cat sleeps in the sun.", "slow": false }`.

Accepts 1–600 characters. Returns MP3 bytes (`audio/mpeg`) from ElevenLabs using `eleven_multilingual_v2`. Normal speed is 0.95; slow mode is 0.85. A locked, process-local cache stores up to 50 clips keyed by voice, model, text, and speed. It is not durable. Missing credentials return 503; provider errors return 502. The browser can fall back to device speech.

### POST /api/lesson

Request: `{ "grade": "2", "topic": "Animals", "words": "cat, bird" }`. `words` is optional.

Returns `{ "cards": [...], "source": "gemma" }`. The server requests JSON from Google Gemma 4 by default, extracts non-thought text from candidates, and validates 1–8 cards. The alternate compatible adapter reads `choices[0].message.content`. Required fields are `word`, `definition`, `sentence`, `imagePrompt`, `hint`, and a three-choice `quiz`. Missing configuration returns 503; invalid model output or provider failure returns 502.

## Integration status

- **ElevenLabs:** real narration was successfully tested on the owner's local configuration. Partner clones require their own authorized settings. Do not assume the owner's key is included.
- **Gemma:** live Google Gemma 4 (`gemma-4-26b-a4b-it`) lesson generation verified with a kindergarten pet set. Uses `GEMINI_API_KEY` by default. A complete explicit `GEMMA_*` compatible-provider configuration takes precedence. Google responses must finish with STOP; thought parts are excluded before parsing/validation.
- **Images:** Cloudflare FLUX.1 Schnell is the default provider; Nano Banana 2 remains opt-in via `IMAGE_PROVIDER=google`. Both card views are implemented. Set `GEMINI_API_KEY` locally for a live test. `images.py` persists files under ignored `.wordring/images/`; browser cards store an optional `imageUrl`. Tests mock Google; live image generation remains to be verified.

## Next milestones

1. Confirm chosen narration voice on short words and sentences; review pronunciation with the team.
2. Review generated reading sets for grade appropriateness; test a range of grades and custom words.
3. Configure the Google image key, run a real illustration, and review content and visual quality.
4. Review sample content for beginning readers and assemble a short end-to-end demo.

## Known constraints

The Python server is for local development. Do not expose it publicly as a production service. There is no authentication, rate limiting, user isolation, or durable backend storage. Audio tests mock the provider; they verify behavior, not pronunciation quality. Instructional content and letter sounds need human review before use with children. Fonts load from Google Fonts; system font fallbacks work without that connection.

### POST /api/image (provider selection)

Request: `{ "word": "cat", "imagePrompt": "A friendly cat" }`. Word: 1–100 characters; optional imagePrompt: at most 600 characters. Returns `{ "imageUrl": "/generated/<sha256>.png", "model": "gemini-3.1-flash-image", "cached": false }` (extension can also be jpg/webp). Uses the Gemini generateContent endpoint, IMAGE/TEXT response modalities, 1:1 aspect ratio, and 1K size. No generation runs during navigation.

A content hash of the model and full prompt keys the disk cache. Requests are serialized to avoid duplicate concurrent generation. Files are saved atomically; only validated image formats are accepted. `/generated/` serves only hash-based filenames and never arbitrary paths. Missing key: 503; malformed request: 400; provider/no-image errors: 502 with a user-actionable message and no credentials. `GET /api/status` also returns `imageGeneration`, indicating key presence rather than provider health. Missing local image files fall back to a placeholder and allow regeneration.

Cloudflare configuration: `IMAGE_PROVIDER=cloudflare` (default), `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`. Model: `@cf/black-forest-labs/flux-1-schnell`. REST endpoint: `/client/v4/accounts/<account>/ai/run/<model>`, Bearer token, prompt and 4 steps. Decodes `result.image` base64 and validates bytes before saving. Response includes `provider` and `model`; browser stores `imageModel` for accurate labeling. Provider-specific cache keys prevent mixing models. There is no fallback to paid Google generation. Status also returns `imageProvider` and `imageLabel`. Live Cloudflare generation was verified using the owner’s local credentials. The prompt was simplified after a visual check to avoid unwanted card titles and lettering; review generated artwork before use.

## Version 3 UI and image approval

Settings is a fourth navigation section. `voiceSelect` and `speechSpeed` are located there; speed still uses the existing `wordring-slow` localStorage key and maps Normal/Slower to the existing speech API's slow boolean. Reading has no picture-generation controls or voice configuration. My word garden handles word creation and image review.

`public/image-review.js` provides the tested approval lifecycle. New responses populate `pendingImageUrl` and `pendingImageModel`. Only `imageApproved === true` with a valid local generated-image URL is displayed. Approval promotes pending metadata to `imageUrl`/`imageModel` and clears pending fields. Discard clears pending metadata; cached files remain. Existing generated images lacking explicit approval migrate to pending once; sample emoji clues remain available. The dialog requires the preview to load before approval is enabled. Closing a dialog preserves pending review. This is local state, not an authenticated child/parent role boundary.

Run `node --test tests/test_image_review.cjs` for approval, discard, persisted-state migration, and invalid-URL coverage. GitHub Actions includes these checks.

## Clickable letter sounds

`readingCard` is now a noninteractive group; `flipCard` exclusively controls support visibility. `readingWord` always remains visible, with an accessible button for each alphabetic character. In known words, each button refers to an explicit grapheme group from `public/phonics.js`; shared letters play/highlight as one sound, and silent letters are explained. Unknown words expose letter-name buttons with explicit UI messaging.

`POST /api/speech` accepts optional `sound`, an allowlisted ID from `phonics.py`. It constructs server-owned SSML and selects `eleven_flash_v2` (the ordinary multilingual model does not support these phoneme tags). Raw client SSML is not accepted through sound IDs. The existing cache is keyed by voice, model, text, and speed, so phonics clips cannot collide with whole words. UI speech cancellation and request IDs also cover letter clicks. Phoneme audio has been verified to return MP3 from the live provider; model success does not prove educational accuracy.

Run `node --test tests/*.cjs` for spellings, group alignment, silent letters, irregular vowels, fallback behavior, and approval tests. Keep frontend sound IDs and the Python allowlist in sync when extending phonics.

Pronunciation correction: `phonics.SPOKEN_SOUNDS` routes stop consonants to literal teaching respellings using Multilingual v2 (k → kuh), while other sounds use Flash v2 phoneme tags with phonetic inner text. Mapped-sound failures never fall back to letter-name playback. Cache identity includes the changed model and text, so older /k/ clips are not reused.
