# Working on WordRing

Read README.md and docs/HANDOFF.md first. Keep the main experience focused on learning to read: the word is visible first, narration is available, and picture clues are optional.

## Partner workflow

1. Ask the repository owner for collaborator access if you need to push branches. Otherwise fork the repository and open a pull request.
2. Clone the repository and run the app using README.md. You can develop without API keys.
3. Start from current main and create a branch for your change:

   ```sh
   git switch main
   git pull --ff-only
   git switch -c codex/describe-your-change
   ```

4. Coordinate changes to `public/app.js` and `server.py`, which currently contain most of the app logic. Use a separate branch per feature and keep pull requests small.
5. Run the documented checks, manually exercise the affected flow, then commit and push your branch. Open a pull request to main with what changed and how you checked it.

## Verify before a pull request

- `python3 -m unittest discover -s tests` passes.
- `node --check public/app.js` passes if JavaScript changed.
- Read words opens first; previous/next and flip work, including empty folders.
- Manual words save and survive a browser refresh.
- Audio stops when changing cards; missing AI credentials leave usable fallback behavior.
- Check narrow and desktop layouts for any UI changes.
- `git diff --cached` contains no API keys, `.env`, personal data, or generated cache files.

## Configuration and data

Keep secrets server-side. Update `.env.example` and README.md when introducing a setting. Do not change the `wordring-v1` browser storage format without a migration or backwards-compatible reader. Real AI calls are optional manual checks; tests should mock providers to avoid billing or requiring teammates' credentials.

## Suggested work areas

- Image provider integration and image persistence/cache.
- Gemma provider configuration and validated lesson generation.
- Reading interactions, accessibility, and child-friendly layout.
- Content review and demo rehearsal.

Agree on ownership before overlapping edits. Repository collaborator invitations remain under the owner's control.
