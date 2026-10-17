# PRIS — Where Worlds Meet

A literacy prototype built during a one-day hackathon. Teachers create rings, assign content, and track progress. Kindergarten–Grade 1 students read words aloud with clickable phonics and staged clues; Grade 2+ rings include spelling and reading comprehension. PRIS was previously named WordRing; internal storage and API names remain compatible.

## Get running in two minutes

Requirements: **Python 3.10+**, Git, and a modern browser. Node.js 20+ is optional for the JavaScript syntax check. There are no third-party Python packages or npm dependencies to install.

```sh
git clone https://github.com/CamdenRose6/Pris.git
cd Pris
python3 server.py
```

On Windows, use `py -3 server.py` if `python3` is unavailable. Open **http://127.0.0.1:8765/**. Keep the terminal running; Ctrl+C stops the server.

**Sign in to get started:** the signed-out screen shows only login and teacher registration. Create a teacher account, then create student logins from Classroom. Existing local accounts and classroom data remain on their original computer; credentials and databases are never committed.

**No keys are needed for manual content or the example rings.** Live Gemma generation, image generation, and speech recognition require the settings in `.env.example`. Copy it to `.env` and add your own provider credentials. Reviewed a, d, k, and p sounds are bundled in `assets/phonics/`; other sounds need the voice service. The bundled p is the selected first utterance, with no repeat.

To add the two example lessons after creating your teacher account:

```sh
python3 scripts/import_demo_lessons.py --teacher YOUR_TEACHER_USERNAME
```

Refresh PRIS afterward. This adds `lesson k-1` (Grade 1) and `lesson 4-5` (Grade 5), with six emoji cards each, without assigning them automatically. The Grade 5 examples include spelling and two reasoning questions per passage. Re-running skips rings with the same names. See [the rehearsal checklist](docs/DEMO_TEST_CHECKLIST.md).

## What works today

- Default **Read words** tab with one word at a time, a separate picture-clue button, previous/next controls, and position indicator.
- Cloudflare FLUX.1 Schnell illustration generation on each card (optional paid Nano Banana 2 provider), with a persistent local image cache.
- Whole-word and sentence narration. Settings holds voice selection, normal/slower speed, and a voice preview.
- AI image previews with explicit approval before pictures appear in either card view.
- ElevenLabs natural speech, with a browser-voice fallback and a server-memory cache of up to 50 clips.
- Manual word entry, folders, and word/picture/combined library views.
- Sample quizzes with hints and retry feedback.
- Browser-local saving of cards and voice preferences.
- Live Gemma 4 lesson generation through Google’s Gemini API, plus an optional OpenAI-compatible provider adapter.

## Optional AI configuration

Copy `.env.example` to `.env` in the project root (`cp .env.example .env` on macOS/Linux, `Copy-Item .env.example .env` in PowerShell). Fill only the settings you need, then restart the server. Exported environment variables take precedence over `.env`.

| Variable | Purpose |
| --- | --- |
| `ELEVENLABS_API_KEY` | Your ElevenLabs key with Text to Speech access |
| `ELEVENLABS_VOICE_ID` | ID of a voice your account can use through the API |
| `GEMINI_API_KEY` | Google AI Studio key for Gemma 4; also used for optional paid Nano Banana 2 images |
| `GEMMA_API_URL` | Full OpenAI-compatible chat completions URL for your Gemma provider |
| `GEMMA_API_KEY` | Key for that provider |
| `GEMMA_MODEL` | Exact Gemma model ID from that provider |

### Natural voice

The current model is `eleven_multilingual_v2`. Choose a warm, clear English voice, fill in both ElevenLabs settings, and restart. Refresh the browser and select **Natural AI voice** under Reading voice.

For the current integration, enable **Text to Speech → Access** and **Speech to Text → Access** on a restricted API key; other endpoint permissions can remain **No Access**. A library voice may require a paid plan; if the provider rejects it, choose a default voice available to your account or use an eligible plan. See the [ElevenLabs quickstart](https://elevenlabs.io/docs/eleven-api/quickstart).

Only the requested word or sentence is sent to ElevenLabs. Generation can incur provider charges. Clips are cached in memory and disappear when the server restarts. Device fallback quality depends on installed browser/system voices.

### Gemma

Gemma generates grade-level vocabulary, definitions, example sentences, image prompts, quiz questions, and hints. With `GEMINI_API_KEY` set, WordRing uses `gemma-4-26b-a4b-it` through the same Google API used by the [organizers’ demo](https://hack-days-gemma-mlh.pages.dev/). No additional Gemma settings are needed. Google currently lists Gemma input/output as free, subject to quota; image generation is separate and paid. An explicit complete `GEMMA_API_URL`, `GEMMA_API_KEY`, and `GEMMA_MODEL` configuration overrides the Google adapter. A kindergarten pet lesson was successfully tested through the live endpoint. The server validates the response structure. Adults still need to review instructional accuracy. The fixed sample set does **not** change with the grade selector.

**Never commit `.env` or put keys in browser code.** Each partner should use their own credentials or receive authorized shared credentials through a private channel. Credentials are deliberately absent from this repository.

## Project map

```text
public/index.html       App layout and dialogs
public/style.css        Responsive styles
public/app.js           Cards, reading flow, quizzes, local saving, audio playback
public/image-review.js  Image approval state and migration helpers
server.py               Local HTTP server and server-side AI routes
images.py               Cloudflare/Google image adapters and persistent cache
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
node --check public/image-review.js
node --test tests/*.cjs
```

Python tests make no real provider calls and require no keys. GitHub Actions runs both checks for pushes and pull requests.

## Troubleshooting

- **Port already in use:** stop the other WordRing terminal with Ctrl+C, then start again.
- **Old interface or voice:** refresh the browser after changes. Restart the Python server after changing `.env` or `server.py`.
- **Voice falls back to device:** check both ElevenLabs settings, key permissions, available credits, and whether your selected voice is permitted for API use.
- **Gemma not connected:** set `GEMINI_API_KEY` and restart. For an alternate compatible provider, set all three `GEMMA_*` variables. A quota or permission failure is shown in the create dialog.
- **Cards differ between computers:** guest cards are saved in each browser’s localStorage; signed-in classroom data is saved in the local server’s SQLite database, not in Git. Do not clear site data unless you want to discard local cards.
- **No audio:** press a playback button first, check device volume, or choose a different device voice.

## Still to build

FLUX.1 Schnell is the default image provider; live generation requires Cloudflare account settings. Paid Nano Banana 2 remains an explicit optional provider. Cards without generated pictures show labeled emoji placeholders. Letter sounds, word recognition, and local classroom accounts are implemented. Cloud deployment and cross-server synchronization are not implemented. This is a local development server, not a production server; keep it bound to localhost.

## Optional paid Nano Banana 2 pictures

Set `IMAGE_PROVIDER=google` explicitly before using this paid option.

1. Create a Gemini API key in [Google AI Studio](https://aistudio.google.com/apikey) with access to image generation and any required billing/quota.
2. Put `GEMINI_API_KEY=your-key` in your local `.env` and restart WordRing.
3. In My word garden, click **Create picture**, inspect the preview, and click **Approve picture**. Then flip the reading card to see it.

The server calls `gemini-3.1-flash-image` through Google's `generateContent` API, requesting a square 1K illustration with a shared storybook style. Only the word and illustration prompt are sent. Generation may incur charges. It happens only on an explicit button click; navigating or flipping cards does not trigger paid calls.

Images are saved to ignored `.wordring/images/` files; the card stores only a local URL. Identical prompts reuse saved pictures, including after a restart. Image files and credentials are not in Git. Partners can generate their own pictures. Back up `.wordring/images/` separately if you want to keep local artwork. If files are removed, the card lets you create the picture again. Review generated pictures for accuracy before using them with children.

The adapters are covered by mocked tests. A live image test still needs the local Google key; passing tests does not establish model access or image quality.

## Free-tier Cloudflare pictures (default)

WordRing defaults to `IMAGE_PROVIDER=cloudflare` and uses FLUX.1 Schnell. Keep the Cloudflare account on Workers Free to use the daily free allowance with requests stopping at the limit. On a paid Cloudflare plan, usage above the free allocation can be billed; the app does not independently enforce a billing cap. See [Cloudflare pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/).

1. In the Cloudflare dashboard, open **Workers AI → Use REST API**.
2. Create the Workers AI token using the provided template (Workers AI Read and Edit for the selected account).
3. Copy the account ID and token into `.env` as `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`.
4. Leave `IMAGE_PROVIDER=cloudflare`, restart the server, refresh WordRing, and select Create picture in My word garden. Review the preview and approve it before it appears on a reading card.

Codex MCP authorization and WordRing API credentials are separate. Do not copy Codex OAuth tokens into the app. Keep the app token in ignored `.env`. Only the word and illustration prompt are sent to Cloudflare. Generated files reuse the existing local cache; image model metadata is saved with the card. A Cloudflare failure does not trigger any Google request.

The Cloudflare adapter has mocked coverage, and live FLUX generation has been verified with the owner’s local credentials. Partner clones still require their own authorized account ID and API token.

## Version 3: simple reading and image review

Reading keeps the large word, flip clue, audio buttons, and navigation. Voice, speed, previews, and service details live in Settings. Picture generation and approval live in My word garden.

Generated pictures are saved as pending and shown only in the review dialog. **Approve picture** enables a picture for both library and reading cards; **Keep word only** discards the pending AI picture (sample emoji clues may remain). Closing the review leaves it waiting. Approval is saved in this browser. Older generated pictures without an approval flag move to the review queue once, preserving their files and keeping the reading view free of unreviewed AI artwork. This is a review convenience, not a parental authentication gate.

## Clickable letters and picture clues

**Show picture clue / Hide picture clue** toggles the approved illustration and sentence while the word remains visible. Each letter is a keyboard-accessible button. Mapped letters play only their sound, using `eleven_v4` and server-owned IPA transcriptions. Hard c/k requests `/k/`; short a requests `/æ/`, distinct from long a `/eɪ/`. There are no spoken lessons or example words in the synthesis request. Whole-word/sentence narration continues to use `eleven_multilingual_v2`.

Shared spellings (sh in fish, ir in bird) highlight together and play one sound from either letter. Silent letters are identified without speech. `public/phonics.js` holds explicit word mappings; `phonics.py` holds the sound allowlist and IPA. Unknown or ambiguous words use explicitly labeled letter names rather than guessed phonics. The baseline is broad American English, without modeling regional variation.

Sound playback uses the configured ElevenLabs voice even when a device voice is selected for ordinary narration. Sound-service failures never substitute letter names. The voice must have access to Eleven v4. The changed model and request text create new cache identities, so old Flash v2 clips are not reused. Normal sounds use speed 1.0, slower sounds 0.85.

### Audio validation and recordings

Live v4 test clips for hard c and short a were generated in `.wordring/phonics/candidates/`. They are candidates, not approved recordings. API success and automated tests do not establish perceptual correctness. Listen before declaring the pronunciation fixed. [ElevenLabs documents direct IPA support and voice-dependent pronunciation](https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices).

An optional reviewed MP3 at `.wordring/phonics/reviewed/<sound-id>.mp3` overrides synthesis without API credentials. Only install recordings after listening review; none are bundled or automatically approved. An optional `<sound-id>.slow.mp3` supplies slower playback; otherwise the normal recording is used without stretching it. Files are limited to 4 MB and allowlisted sound IDs. These files are ignored by Git and require separate backup. Test candidates are never automatically played by the app.

## Voice reading: attempt → picture → word audio

In Read words, **Read it aloud** records up to 8 seconds. Tap Done speaking to submit early, or Cancel to discard. The first confident nonmatching word unlocks an optional picture clue; a second unlocks whole-word/sentence audio. Clickable letter sounds are available immediately. A correct match unlocks Next word. Skip for now allows moving on without a correct result. Progress is session-local, independent per card, and resets on reload.

Silence, low-confidence/missing-confidence transcripts, cancelled recordings, and service failures do not increase the unsuccessful-attempt count. The UI shows what the recognizer heard. Case, punctuation, simple article prefixes, and a small unambiguous homophone list are normalized. This checks recognition of the intended word, not phoneme-by-phoneme pronunciation or reading ability. There is no target-word bias in the transcription request. The confidence threshold is conservative and heuristic, not calibrated for children; test with intended learners before relying on it.

Enable **Speech to Text → Access** on the existing ElevenLabs key. WordRing uses `scribe_v2`; calls may consume provider credits. There is no new API key setting. If permission, quota, or billing is unavailable, the attempt is not scored and a useful error appears.

Recordings start only after an explicit click and the browser's microphone permission. Browser media tracks stop on submission, cancellation, navigation, and page exit. WordRing does not persist recordings or transcripts; audio is uploaded through the local server to ElevenLabs, whose own retention and privacy terms apply. Do not mistake lack of app persistence for zero provider retention. Use localhost for development; production microphone capture requires HTTPS. Permission must be given by the person using the browser; tests use synthetic data and mocked microphone objects.

Approve picture clues in My word garden before practice. If a word has neither an approved image nor a sample emoji, its unlocked picture button reports that no clue is ready. Letter sounds are available from the first attempt. Whole-word and sentence narration remain locked until two unsuccessful attempts, including via keyboard shortcuts.

Verification: the initial read-first screen and automated progression/cancellation tests pass. Live synthetic speech was accepted for “cat” when the target was “cat”; “dog” returned a retry for that target. Human microphone capture and recognition with children remain to be verified in the browser.

Letter-sound exception: b and d use the short respellings `buh` and `duh` with the existing voice model because isolated `/b/` and `/d/` were read aloud as “slash b slash” and “slash d slash”. The d request includes a `[warmly]` delivery tag and a full stop to aim for a gentler tone; listening review is still needed. Other sounds retain their existing IPA requests. Reviewed local recordings still take precedence.

## Version 6: local classrooms

Open **Sign in → Create a teacher account**. Teachers open directly to Classroom, create student logins, and organize words in **My Rings**. Select a ring in the sidebar to add words and approve pictures, then assign a ring or all ring words to a student. Teacher navigation contains Classroom, Settings, and My Rings; reading and practice remain in the student/guest experience. **Import this browser’s guest words** copies the existing guest library into the teacher account; guest data is preserved separately. **Save words** retries a failed account save.

Students sign in with the username/password their teacher created. Read words shows only their assignments. Letter sounds are available immediately; one unsuccessful checked reading unlocks the optional picture, two unlock whole-word audio. A correct recognition earns the card into **My Ring**. Skip, silence, unclear recognition, and provider failures do not award a word. Teacher **Refresh progress** shows saved outcomes and checked-attempt counts. My Ring is a collection of successfully recognized words, not a validated mastery assessment.

Account data lives in ignored `.wordring/classroom.sqlite3` (SQLite, included in Python). Restarting the server or browser preserves accounts, assignments, and student progress. Teachers’ libraries save to this database, rather than browser localStorage. Guest practice continues to use `wordring-v1` localStorage. Student/teacher account data is not copied into guest mode on sign-out. Assignments are snapshots: edits/removal in the teacher library do not silently change an existing assignment or reset earned progress; assign a new card to change a word. Approve pictures before assigning.

Passwords use a unique random salt and PBKDF2-HMAC-SHA256 (600,000 iterations); plaintext passwords are not stored. See [Python’s password key-derivation documentation](https://docs.python.org/3/library/hashlib.html#key-derivation). Session tokens are stored as hashes and sent via HttpOnly, SameSite=Strict cookies with 12-hour expiry. Account endpoints reject cross-origin writes. Students cannot create lessons, generate pictures, modify libraries, or inspect other students’ progress; teachers see only their own students. The server chooses the assigned target word and saves the recognition outcome itself. There is no client endpoint for awarding arbitrary success. Audio/transcripts are not saved in the classroom database.

**Local prototype limits:** teacher registration is open on the local server, without email verification, password recovery, or invitations. Usernames are unique across the installation. Do not use real student data yet. This remains a localhost-only development server: HTTPS, production authentication/recovery, privacy review, operational backups, durable image storage, and deployment configuration are still needed before school use. SQLite is for this local prototype; DigitalOcean App Platform needs durable external storage (for example PostgreSQL plus object storage), not its disposable container filesystem. No paid resources were provisioned.

To back up locally, stop the server and copy the entire `.wordring/` directory to private storage; it contains the database and picture/audio assets. Keep it out of Git. Automated tests use temporary databases and mocked recognition. Browser verification used synthetic teacher/student accounts and a seeded successful reading, not a child’s microphone recording.

Teachers can right-click a named ring under **My Rings → Delete ring…**, then confirm. This removes that ring and its cards from the teacher library; existing student assignments and earned progress remain. Keyboard users can focus a ring and press **Shift+F10**. A failed save keeps the ring intact.

Click the teacher’s **My Rings** sidebar heading to see all rings and their card counts. Select a ring to edit its cards. The separate All rings sidebar entry has been removed.

To assign a ring to the whole class, choose **Everyone in the class** in the Student dropdown, select the ring, and click **Assign to everyone**. This assigns to all current students in that teacher’s classroom; future students need a separate assignment. Existing assignments and earned progress are preserved.

## Student progress cards

Classroom shows each student’s name, assigned words read/total, and a 14-day cumulative chart built from saved successful-reading dates. Expand View assigned words for per-word attempts. Empty histories stay flat; no sample progress is invented.

On track means the student’s completed-assignment percentage is at or above the arithmetic mean of those percentages for current classmates with assignments. Below that average shows bold red Needs attention. Students without assignments are excluded from the mean. When nobody has completed any assigned words, students show Ready to start instead. This is a current comparison: changing assignments can change completion percentages. Refresh progress reloads the data.

## Version 8: student rings and ideas

Students sign in directly to **My Ring**, where assigned rings show earned-word progress. Select a ring to read its cards; the My Ring button returns to the overview. Reading and practice are no longer separate student navigation items. Correctly read words still count toward saved progress.

In **Request a ring**, students choose an idea such as Sports, Movies, Superheroes, or Animals, or enter their own topic. Requests are stored locally in the classroom database and visible only to that student and their teacher. Students can have up to five pending ideas; identical pending topics are rejected.

Teachers use the **Requests** tab to approve or deny ideas. Approval alone does not generate content or assign cards. For an approved idea, choose a grade level and a word count, then generate with Gemma or enter a manual comma-separated word list. Creation supports up to 200 words, subject to the existing 200-card/40-ring collection limits. Gemma generates batches of up to eight cards and can consume provider credits; no AI call is made by approval alone. If generation fails or repeats words, no partial ring is saved. Large sets may take multiple requests to complete.

The created ring opens in the teacher editor. Use **Create picture** on individual cards and approve the pictures before assigning the ring through Classroom. No images are generated automatically. The Requests tab links back to the created ring. Students see the idea’s status and are told when its ring has been assigned. This sends no email or external notification.

## Version 9: spelling and comprehension in Grade 2+ rings

Every Grade 2–5 card now includes **both** activities, in order:
1. **Spelling:** show an approved picture (or sample emoji clue) without showing the spelling. The student types the word. A wrong spelling plays the existing reading voice and offers Hear the word again; retries are unlimited. Correct spelling advances to the reading passage.
2. **Reading comprehension:** show a short passage and one or two questions, each with three choices. Wrong choices allow another try. All questions must be answered correctly before the card is earned and Next word unlocks.

The server checks the assigned spelling and answer keys; a successful voice transcription cannot bypass these activities. Spelling ignores letter case and outer whitespace, but does not accept a different spelling, homophone, article prefix, or added punctuation. Component completion and unsuccessful attempts persist across reloads. Earlier kindergarten/Grade 1 read-aloud practice continues as before.

For teachers, choose **Grade 2 or above** when creating cards. Gemma generates a short comprehension passage and questions with each card. **Set up activities / Edit activities** opens a manual editor for the passage, one or two questions, three choices per question, and the correct choice; it also offers explicit Gemma generation followed by review and Save activities. Create and approve the picture clue before assignment. Draft cards missing a picture or valid comprehension content cannot be assigned. Existing Grade 2+ draft cards need activity setup; assignments continue to use snapshots, so edit before assigning or create a new card for changed content.

A card’s saved grade selects its activity mode (currently supported grades K–5). If a ring mixes grades, each card uses its own saved grade. The teacher’s progress chart counts an advanced card only after both components are complete. Activity answers and incorrect-attempt counts are stored locally; typed answers themselves are not stored in the classroom database.

## Grade 4–5 comprehension

New Grade 4 lessons target 100–140 words in two paragraphs, with an inference question and a supporting-evidence question. Grade 5 targets 140–180 words and asks students to evaluate explanations or claims, then select evidence or identify a limitation. Both use three plausible answer choices per question, rather than obvious distractors or simple word identification. Generation rejects passages below 90 words for Grade 4 or 120 for Grade 5 and requires two questions; this structural check does not guarantee question quality, so teacher review still matters.

The Grade 4–5 sample button now provides three longer activities about a garden experiment, a bridge decision, and bird observations, with distinct questions for each grade. Grades 2–3 retain shorter, direct-comprehension activities. Existing saved cards and assigned rings are preserved; regenerate an existing card’s passage through Edit activities to update it.
