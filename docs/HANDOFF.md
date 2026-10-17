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

Returns `{ "cards": [...], "source": "gemma" }`. The server requests structured JSON from the configured OpenAI-compatible provider, reads `choices[0].message.content`, and validates 1–8 cards. Required fields are `word`, `definition`, `sentence`, `imagePrompt`, `hint`, and a three-choice `quiz`. Missing configuration returns 503; invalid model output or provider failure returns 502.

## Integration status

- **ElevenLabs:** real narration was successfully tested on the owner's local configuration. Partner clones require their own authorized settings. Do not assume the owner's key is included.
- **Gemma:** adapter implemented; live provider configuration and real lesson generation still need verification.
- **Images:** emoji placeholders only. Planned provider is Google Nano Banana 2; no image API route, key, generation, or persistent assets exist yet. Start by adding a server-side adapter and wiring the resulting images into both library cards and flipped reading cards.

## Next milestones

1. Confirm chosen narration voice on short words and sentences; review pronunciation with the team.
2. Connect the team's Gemma endpoint and verify grade-appropriate responses against the schema.
3. Integrate illustration generation with saved/cached output so card navigation never generates a fresh image.
4. Review sample content for beginning readers and assemble a short end-to-end demo.

## Known constraints

The Python server is for local development. Do not expose it publicly as a production service. There is no authentication, rate limiting, user isolation, or durable backend storage. Audio tests mock the provider; they verify behavior, not pronunciation quality. Instructional content and letter sounds need human review before use with children. Fonts load from Google Fonts; system font fallbacks work without that connection.
