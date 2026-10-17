# WordRing

A reading-first literacy prototype for young learners, built during a one-day hackathon. Start with one large word card, try reading aloud, hear a natural voice, and flip for a picture and sentence clue.

## Get running in two minutes

Requirements: **Python 3.10+**, Git, and a modern browser. Node.js 20+ is optional for the JavaScript syntax check. There are no third-party Python packages or npm dependencies to install.

```sh
git clone https://github.com/CamdenRose6/Word-Ring.git
cd Word-Ring
python3 server.py
```

On Windows, use `py -3 server.py` if `python3` is unavailable. Open **http://127.0.0.1:8765/**. Keep the terminal running; Ctrl+C stops the server.

**No keys are needed to work on the interface:** the sample word set, manual word entry, folders, and quizzes work locally. Browser speech is the fallback when ElevenLabs is not configured.

## What works today

- Default **Read words** tab with one word at a time, card flipping, previous/next controls, and position indicator.
- Whole-word and sentence narration, voice selection, and a slower reading option.
- ElevenLabs natural speech, with a browser-voice fallback and a server-memory cache of up to 50 clips.
- Manual word entry, folders, and word/picture/combined library views.
- Sample quizzes with hints and retry feedback.
- Browser-local saving of cards and voice preferences.
- A server adapter for Gemma through an OpenAI-compatible chat completions endpoint; the live Gemma connection still needs configuring and testing.

## Optional AI configuration

Copy `.env.example` to `.env` in the project root (`cp .env.example .env` on macOS/Linux, `Copy-Item .env.example .env` in PowerShell). Fill only the settings you need, then restart the server. Exported environment variables take precedence over `.env`.

| Variable | Purpose |
| --- | --- |
| `ELEVENLABS_API_KEY` | Your ElevenLabs key with Text to Speech access |
| `ELEVENLABS_VOICE_ID` | ID of a voice your account can use through the API |
| `GEMMA_API_URL` | Full OpenAI-compatible chat completions URL for your Gemma provider |
| `GEMMA_API_KEY` | Key for that provider |
| `GEMMA_MODEL` | Exact Gemma model ID from that provider |

### Natural voice

The current model is `eleven_multilingual_v2`. Choose a warm, clear English voice, fill in both ElevenLabs settings, and restart. Refresh the browser and select **Natural AI voice** under Reading voice.

For the current integration, enable **Text to Speech → Access** on a restricted API key; other endpoint permissions can remain **No Access**. A library voice may require a paid plan; if the provider rejects it, choose a default voice available to your account or use an eligible plan. See the [ElevenLabs quickstart](https://elevenlabs.io/docs/eleven-api/quickstart).

Only the requested word or sentence is sent to ElevenLabs. Generation can incur provider charges. Clips are cached in memory and disappear when the server restarts. Device fallback quality depends on installed browser/system voices.

### Gemma

Gemma is intended to generate grade-level vocabulary, definitions, example sentences, image prompts, quiz questions, and hints. The server validates the response structure. Adults still need to review instructional accuracy. The fixed sample set does **not** change with the grade selector.

**Never commit `.env` or put keys in browser code.** Each partner should use their own credentials or receive authorized shared credentials through a private channel. Credentials are deliberately absent from this repository.

## Project map

```text
public/index.html       App layout and dialogs
public/style.css        Responsive styles
public/app.js           Cards, reading flow, quizzes, local saving, audio playback
server.py               Local HTTP server and server-side AI adapters
.env.example            Configuration template without secrets
tests/                  Python tests; provider calls are mocked
.github/workflows/      Automated Python tests and JavaScript syntax checks
docs/HANDOFF.md          Architecture, API contracts, and next work
CONTRIBUTING.md          Partner workflow and verification checklist
```

## Checks

Run from the project root:

```sh
python3 -m unittest discover -s tests
node --check public/app.js
```

Python tests make no real provider calls and require no keys. GitHub Actions runs both checks for pushes and pull requests.

## Troubleshooting

- **Port already in use:** stop the other WordRing terminal with Ctrl+C, then start again.
- **Old interface or voice:** refresh the browser after changes. Restart the Python server after changing `.env` or `server.py`.
- **Voice falls back to device:** check both ElevenLabs settings, key permissions, available credits, and whether your selected voice is permitted for API use.
- **Gemma not connected:** all three Gemma settings must be filled; the endpoint must serve the specified Gemma model using the expected API format.
- **Cards differ between computers:** data is saved in each browser's localStorage, not in Git or a shared database. Do not clear site data unless you want to discard local cards.
- **No audio:** press a playback button first, check device volume, or choose a different device voice.

## Still to build

Image generation is not connected; pictures are labeled emoji placeholders. Nano Banana 2 is the planned image provider. Letter/phoneme audio, speech scoring, accounts, cloud sync, and deployment are not implemented. This is a local development server, not a production server; keep it bound to localhost.
