# PRIS demo test and rehearsal checklist

Tested October 17, 2026 on the local app at http://127.0.0.1:8765/.

## Results

- PASS: 72 Python tests and 39 JavaScript tests (111 total).
- PASS: Teacher sign-in, ring library, six-student classroom and progress dashboard render.
- PASS: Choosing Everyone in the class changes the assignment action and student count. No new assignment was submitted during this browser check; automated tests cover bulk assignment.
- PASS: Add content shows pronunciation-only content for Kindergarten and spelling plus comprehension for Grade 3. Automated tests cover K–5 content rules.
- PASS: Alex signs in and sees only assigned rings, with saved completion counts.
- PASS: Reading cards retain clickable letter-sound buttons and Next navigation on completed words.
- PASS: Completed Grade 3 cards show completion; the partially completed fourth card resumes at its reading questions and blocks Next until completion.
- PASS: Student progress and ring request screens load. Existing requests remain intact.
- PASS: Settings reports Gemma, FLUX.1 Schnell, and natural AI voice configured. Configuration labels do not prove live provider availability or quota.
- PASS: No browser console errors were recorded during the walkthrough.
- Previous responsive check: 390px mobile layout has no horizontal overflow; desktop layout also reviewed.

No existing cards, assignments, answers, or progress were changed during this test. Tests that exercise writes use temporary databases or mocks. Sign-in/out changes sessions only. No live AI calls or microphone recordings were made.

## Final live checks — presenter to complete

Do these once on the actual presentation computer, browser and network:

- [ ] Check the speaker volume and tap a letter to hear its sound.
- [ ] Open an unfinished K–1 word, press Read it aloud, allow microphone access, and say the target word clearly. Confirm it is recognized correctly.
- [ ] On a different unfinished word, try a clearly different word. After the first recognized mismatch, confirm the optional picture button appears. After the second, confirm the word-audio button appears. Unclear speech should ask for another try without counting a failure.
- [ ] If demonstrating fresh generation, generate a small Gemma set before presenting and review the content. Live calls may use credits or fail if quota/network is unavailable.
- [ ] Confirm any AI pictures used in the demo have been approved. Label emoji examples as placeholders.
- [ ] Keep a short screen recording or screenshots ready as a fallback.

Live microphone, voice quality, and AI provider response quality remain unverified by this automated run. They need the live checks above.

## Four-minute presentation route

1. **PRIS (20 seconds):** “Where Worlds Meet. Same standard. Different experience.”
2. **Teacher (50 seconds):** Show My Rings and Add content. Switch from Kindergarten to Grade 3 to show the different learning activities. Explain Gemma creates grade-appropriate vocabulary and the reading passages/questions; teachers review content and pictures.
3. **Student reading (60 seconds):** Sign in as Alex. Open First reading words. Use an unfinished word to demonstrate clickable phonics and reading aloud. Explain the picture-first, audio-second help sequence.
4. **Older learner (60 seconds):** Open Grade 3 problem set. Completed cards can be advanced with Next. Demonstrate an unfinished spelling/reading activity or the saved reading-question checkpoint. Both activities are required to complete a card.
5. **Teacher progress (50 seconds):** Return to the teacher dashboard. Show words completed, the class comparison, and automatic Needs attention labels. Explain the comparison uses completion percentage rather than a diagnosis of reading ability.

Already completed words cannot demonstrate a fresh microphone attempt. Choose an unfinished word. Do not promise the public domain is live: this demo runs locally.

## Access and rerun

Use the existing credentials in `.wordring/demo-classroom-logins.txt`. Keep that file private and out of the presentation recording.

From the project directory:

```sh
python3 -m unittest discover -s tests
npm run check
```

Start locally with `python3 server.py` if it is not already running. Keep the running server terminal open during the demo. An internet connection is still needed for live AI services.
