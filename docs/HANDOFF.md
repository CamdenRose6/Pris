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

The Python server is for local development. Do not expose it publicly as a production service. Version 6 adds local account sessions, role/ownership checks, login throttling, and SQLite persistence; production authentication, deployment, and operations remain unfinished. Audio tests mock the provider; they verify behavior, not pronunciation quality. Instructional content and letter sounds need human review before use with children. Fonts load from Google Fonts; system font fallbacks work without that connection.

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

`POST /api/speech` accepts optional `sound`, an allowlisted ID from `phonics.py`. Sound synthesis uses `eleven_v4` with direct IPA only (hard c/k → `/k/`, short a → `/æ/`). The earlier SSML and spoken teaching sequences were removed because the reported issue is incorrect generated audio. Ordinary narration retains Multilingual v2. Voice settings for sounds use stability 0.5, similarity 0.75, speed 1.0 or 0.85. Cache keys include model and text so previous clips cannot collide.

Optional `.wordring/phonics/reviewed/<sound-id>.mp3` and `.slow.mp3` recordings override synthesis before credential checks. No reviewed recordings are bundled. The frontend requests mapped sounds even without provider credentials so local recordings work. Failures never substitute a letter name.

Live v4 candidate audio for hard c and short a was generated with the configured voice under `.wordring/phonics/candidates/`. It has not been approved for perceptual correctness. Tests cover direct IPA, vowel distinctions, absence of teaching narration, request routing, cache behavior, recording precedence, and path rejection. Run Python unittest discovery and `node --test tests/*.cjs`.

## Voice-driven reading workflow

New modules: `reading_check.py` (Scribe adapter + conservative transcript comparison), `public/reading-flow.js` (pure attempt state), and `public/reading-recorder.js` (MediaRecorder lifecycle/controller). `public/app.js` gates help based on session-local per-card progress. Existing phonics/approved-image flows remain intact. No target word is included in the Scribe request, so the recognizer is not primed to output the answer.

`POST /api/reading-check` accepts JSON `{word, audio, mime}`. Audio is base64, at most 2 MB decoded/3 MB HTTP body, with an allowed audio MIME type. The server constructs multipart data for ElevenLabs `scribe_v2`, English, no diarization or event tags. Returns `{outcome: correct|retry|unclear, transcript, message}`. A retry requires word tokens with finite logprobs >= -1; low/missing confidence is unclear. This is an uncalibrated recognition heuristic, not pronunciation assessment. Unambiguous homophones and simple article prefixes can match; long utterances are unclear rather than being accepted because they contain the target.

Clickable-letter teaching is available from the first attempt. One retry reveals picture help; two reveal word/sentence audio. Correct unlocks Next; Skip is explicit and does not count as success. Recording is explicitly started, capped at 8s, cancellable, and guarded by epoch/card IDs so late recordings/results cannot score another card. Tracks and AudioContext are released; uploads can be aborted. Silence metering is optional; missing or blocked microphone/provider errors do not count. Local files and localStorage contain no recordings/transcripts. Provider retention is not overridden.

Speech to Text permission is enabled on the live key. Live synthetic tests accepted “cat” for target “cat” and returned a retry for “dog” against target “cat”. The missing-permission error and state behavior are also tested. Human microphone capture and recognition with children remain unverified; complete a browser microphone test before claiming those work.

Letter-sound exception: b and d use the short respellings `buh` and `duh` with the existing voice model because isolated `/b/` and `/d/` were read aloud as “slash b slash” and “slash d slash”. The d request includes a `[warmly]` delivery tag and a full stop to aim for a gentler tone; listening review is still needed. Other sounds retain their existing IPA requests. Reviewed local recordings still take precedence.

## Version 6 classroom handoff

`classroom.py` owns SQLite schema creation, password hashing, hashed expiring sessions, teacher libraries, student membership, immutable assignment snapshots, and saved progress. The database is `.wordring/classroom.sqlite3`, outside static files and ignored by Git. Connections use parameterized SQL, foreign keys, transactions, and close after each operation. There is no PostgreSQL adapter yet.

API routes:
- `GET /api/account/me`: current public user or null; no-store.
- `POST /api/account/register`: `{name,username,password}`, creates a teacher (12+ character password).
- `POST /api/account/login`: `{username,password}`, teacher or student login.
- `POST /api/account/logout`: revokes session and clears cookie.
- `GET /api/classroom/workspace`: teacher library, or student assignments plus progress.
- `POST /api/classroom/library`: teacher-only `{cards,folders}`; validated fields, 200-card/40-folder local limit.
- `POST /api/classroom/students`: teacher-only `{name,username,password}` (student password 8+ characters).
- `POST /api/classroom/assign`: teacher-only `{studentId,cardIds}`; ownership checked, existing assignments retain progress.
- `GET /api/classroom/dashboard`: teacher’s own students, assigned words, attempts, misses, earned status.
- `POST /api/reading-check`: signed-in students supply `cardId`; server resolves the target from their assignment and persists only outcome/counts/earned timestamp. Client-supplied target spelling is ignored. Invalid assignment IDs cannot reach the provider. Existing guest reading remains available without account persistence.

Authenticated classroom requests and reading submissions carry `X-WordRing-User` matching the cookie’s current user; stale tabs fail rather than writing/scoring under another session. Account writes require JSON and an allowed local Host/same Origin when present. Registration/login have a shared per-IP limit of 20 requests per 10 minutes, held in process memory. This is a local safeguard, not a production abuse-control system. Guest AI endpoints remain available for the existing local demo.

`public/classroom-ui.js` handles sign-in, teacher student management, imports/assignments, and dashboard. `app.js` keeps guest/account state separate and queues teacher library saves. Sign-out waits for pending saves; a failed save can be retried using Save words. Workspace changes cancel recording/audio/image requests and invalidate late lesson/image results. `reading-recorder.js` restores saved progress and forwards server outcomes into My Ring. Existing `wordring-v1` format is unchanged.

Manual browser verification: teacher registration, guest import, student creation, assignment, student sign-in, assigned-only reading, My Ring visibility, and progress restoration after server/browser reload. Progress fixture was synthetic; automated handler tests mock the recognizer and verify the target is resolved server-side and successful outcomes persist. No real student data or new AI calls were needed. Production deployment/authentication and password recovery remain future work; no DigitalOcean services were created.

## Version 7 teacher workspace

Teacher login and page reload open Classroom. Teacher navigation hides Read words, Practice time, and My word garden. The former folder list is labeled My Rings with a binder-ring SVG icon; ring selection opens the existing card editor, and Add ring preserves the existing folder data format. Teachers create words/review pictures within a ring and assign them through Classroom. Teacher routing blocks student reading/practice views; guest and student navigation is unchanged. No account credentials or stored classroom data were changed.

Teacher ring deletion: right-click a named ring (or focus it and press Shift+F10) to open Delete ring. A confirmation lists its card count and explains that existing student assignments/progress remain. The teacher library is saved before updating the screen; failed saves leave the ring visible and allow retry. Pending generation is cancelled during deletion to prevent late results restoring removed content. The My Rings heading opens the ring overview and has no delete action. Named rings support deletion in both the sidebar and overview. Students/guests do not receive the menu. Browser verification opened and cancelled the confirmation; no demo rings were removed. Tests exercise successful/failed saves, cancellation, role/account guards, and preservation of assigned student progress.

My Rings is a native sidebar button for teachers. It opens a grid of rings with card counts; selecting a tile opens its cards. The redundant All rings sidebar row is removed. The assignment dropdown still offers All rings when assigning every card. Guest/student folder navigation is unchanged.

Whole-class assignment: `POST /api/classroom/assign` accepts `{allStudents:true,cardIds}` instead of `studentId`. The server selects only the authenticated teacher’s current students and inserts all assignment snapshots in one transaction. Response includes total new student-word `assigned` rows, `students`, and `wordsPerStudent`. Existing rows are ignored, preserving progress. Invalid/mixed targets, empty classes, and unknown cards fail before inserting rows. The Student dropdown appends Everyone in the class, retains individual selection as the default, and updates the count and submit label when selected. Tests cover ownership isolation, idempotence, saved progress, and invalid batches. Browser verification selected the option without submitting new demo assignments.

Student progress model: `public/student-progress.js` computes unweighted class-average completion percentages, per-student status, and a cumulative 14-local-calendar-day series of correct assignment rows with valid `earnedAt` timestamps. No-assignment students are excluded from the mean; no completions in the class yields Ready to start. Otherwise below mean is attention (bold red), and at/above mean is on-track. This rule was selected by the user; there is no separate manual attention flag or diagnostic assessment. Teacher dashboard word records now include `earnedAt` from existing SQLite data. `classroom-ui.js` renders named cards with accessible SVG charts, read/assigned counts, comparison status, and collapsible word details. Missing/future dates are excluded from plotted history and disclosed, rather than assigned invented dates. Current assignment totals determine the denominator and graph scale; assignment changes can change the comparison. Browser checks covered six zero-history demo students and narrow/desktop layouts. Unit tests cover unequal assignment counts, status boundaries, empty classes, dated/undated history, and rendered attention labels.

## Version 8 implementation

`ring_requests.py` stores ideas and decisions in the new `ring_requests` table created by `classroom.Store`. Routes share the existing authenticated session, local-origin checks, and `X-WordRing-User` account guard:
- `GET /api/classroom/requests`: teacher’s classroom requests or student’s own requests (latest 200).
- `POST /api/classroom/requests`: student-only `{topic}`, 1–80 characters; five pending maximum, no duplicate pending topic. Teacher ownership is resolved from the student account in SQLite.
- `POST /api/classroom/request-review`: teacher-only `{requestId,decision:approved|denied}`. Ownership and stable decision are enforced.
- `POST /api/classroom/request-ring`: teacher-only `{requestId,ring}`. The idea must be approved and the ring must already exist in that teacher’s library. Approval and linking do not assign words to students.

`public/ring-requests.js` renders both role-specific Request tabs, suggested ideas, teacher decisions, and creation controls. `createRequestedRing` in app.js handles manual lists or explicit Gemma batch creation. `/api/lesson` accepts integer `count` 1–8 (default 5) plus up to 200 excluded words for subsequent batches. New ring creation is capped by the existing collection limits and saves only after all batches finish. Generation rejects duplicate returned spellings; cancellation/account changes prevent late UI saves. Creation and subsequent request linking are separate writes; if linking fails, the UI reports the saved ring name instead of claiming nothing was created. Pictures use the existing explicit create/review flow in the teacher editor.

Student sign-in/reload now opens My Ring with assigned ring tiles and per-ring earned-word counts. Clicking a tile opens the reading flow; My Ring returns home. Read words and Practice time are hidden for students, while guest practice is retained. The binder-ring SVG appears in student navigation. Student assignments remain immutable snapshots, including previously assigned rings removed from the teacher library.

Verified with the demo student and teacher: assigned-ring landing, opening/returning from reading, idea submission, teacher approval, manual three-word ring creation and link. The synthetic QA request and unassigned QA ring were removed afterward. No new AI or image calls were used in this verification. Tests cover request ownership/privacy, decisions and limits, API routing, lesson count/exclusion preferences, manual/batched creation, capacity limits, failed persistence and cancellation. Existing accounts, credentials, student assignments and progress are preserved.

## Version 9 implementation

`learning.py` validates optional `comprehension: {passage,questions}` on teacher cards. Passages are 1–1200 characters; one or two questions each have 1–300-character text, three 1–100-character choices, and integer answer 0–2. Grade strings 2–5 select the advanced flow. Library drafts may omit comprehension, but `Store.assign` requires valid content and an approved image or sample emoji before assigning advanced cards. The assignment JSON snapshots this content. `/api/lesson` includes comprehension instructions for these grades and rejects missing/malformed returned content.

`activities.py` handles `POST /api/classroom/activity-check` through existing authenticated classroom routing. Payload is `{cardId,activity:spelling|comprehension,answer,questionIndex?}`. Ownership and activity grade are resolved from the assignment; students cannot award success or supply target words/keys. Spelling uses NFKC normalization, casefold and outer trimming only. Comprehension requires spelling completion and enforces question order. Wrong answers remain retryable. A transaction updates the new `activity_progress` table and assignment attempts/misses; `correct` and `earned_at` are set only after spelling plus all comprehension questions. Replayed successful components do not add attempts. Grade 2+ voice checks are blocked before transcription, and `Store.record_result` cannot award advanced completion. Old completed assignments remain completed; no existing progress is erased.

Student workspaces include saved `activityProgress` on advanced cards. `public/learning-content.js` supplies validation/phase helpers and `public/activities.js` renders spelling, pronunciation help, passages, choices, retry feedback and completion. Recorder controls are inactive for advanced cards, and navigation/account changes abort late UI work. Grade 2+ cards are labeled Spelling + comprehension in the ring overview. The editor dialog supports manual authoring and explicit Gemma regeneration; generated content is reviewed in the dialog before Save activities.

Manual verification used a temporary Grade 2 fox card: teacher authored two questions, assigned to the demo student, correct spelling advanced to comprehension, wrong comprehension answer allowed retry, reload resumed at question 2, and final correct answer earned the card. The temporary card, its assignment and component progress were removed afterward. Existing student progress (including the demo reader’s existing successes), teacher rings and requests were preserved. Spelling-retry pronunciation is exercised by a mocked voice/controller test; this browser check made no new AI calls.


### Student ring removal

Click a student's name in Student progress to expand assigned rings. The × beside a ring calls authenticated teacher-only `POST /api/classroom/unassign-ring` with `studentId` and `ring`. Names are grouped from saved assignment snapshots, including rings no longer present in the teacher library. Only that teacher's own students can be changed.

Assignments now have an `active` column, added automatically for existing databases. Removal marks matching assignments inactive; it preserves their scores and activity component progress. Student workspace, teacher dashboard, reading checks and activity checks exclude inactive assignments. Reassigning the same card IDs reactivates their existing snapshots and progress. Teacher library content and other students are unaffected. The UI refreshes class metrics after removal and keeps the student's ring list expanded. Students already on a reading page must refresh to update its list; scoring an inactive assignment is rejected immediately.

### Picture alternatives

Teacher cards open Picture options. Generate another picture requests `/api/image` with a fresh `variation` identifier so it gets a separate cache entry; the original approved clue remains until replacement approval. Provider failures preserve existing pictures. Teachers can instead select or paste one emoji and save it as the clue; that clears both approved and pending AI picture references on the teacher card and cancels an in-flight generation. Saved student assignment snapshots are unchanged. Emoji validation, approved/pending transitions, and cache variation behavior have mocked automated coverage; no live provider call is needed to run tests.


### Bundled approved phonics

`assets/phonics/` includes the previously approved a, d, and k recordings plus the selected first utterance of p option 3. Normal and slow p both use that exact 0.679-second clip. Local `.wordring/phonics/reviewed` files override bundled clips, then generated speech is used for remaining sounds. Partners receive the approved clips without receiving local caches or credentials.
