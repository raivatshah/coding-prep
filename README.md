# Coding Prep

An interactive, single-page coding interview prep guide focused on Python and pattern recognition.

Run the local app:

```bash
npm start
```

Then open `http://127.0.0.1:8765/index.html`. The page includes:

- Pattern notes and Python templates
- CS fundamentals quiz
- Pattern flashcards with local spaced-repetition progress
- Algorithm visualizers for BFS, DFS, DP, and sliding window
- Daily drill prompts to turn the guide into a repeatable practice loop
- Pattern Coach for translating problem wording into likely techniques
- Pattern Ladders that turn each pattern into anchor, core, twist, and pressure-test rungs
- Pattern Studio for recognition, contrast pairs, invariants, template mutations, trap cards, and pattern atlas drills
- Problem Tracker with LeetCode range sync, metadata autofill, confidence, notes, review dates, and import/export
- Persistent checklist progress stored in `localStorage`

Run the QA audit:

```bash
npm test
```

The audit checks that Pattern Studio cards do not reveal hidden answers before the user selects or reveals a card, and that the deck covers the main interview patterns broadly enough.

## Suggested Study Loop

1. Start with **Today's Drill** on the overview page.
2. Solve one problem without looking at notes.
3. Compare your approach with the relevant pattern section.
4. Do a few flashcards or quiz cards.
5. End by checking edge cases and stating complexity out loud.

Use the **Problem Tracker** after LeetCode practice. Sync by lookback range first, then add the human part LeetCode cannot know: confidence, mistake, key insight, and next review date.

Use **Pattern Ladders** when a pattern still feels fuzzy. Start at rung 1, clear the pass rule, then move upward only when the invariant and trap feel obvious.

Use **Pattern Studio** for short reps before full problems. It trains the fast decision point: what pattern fits, what invariant makes it work, and what nearby pattern would be wrong.

## LeetCode Sync

The local server exposes a tiny proxy at `/api/leetcode/*` so the browser can fetch LeetCode GraphQL data without CORS issues. Vercel deployments use matching serverless functions in `api/`, so the browser calls the same paths locally and in production.

The sync imports public recent submissions by username, filters them by lookback range, groups repeated submissions into unique problems, and fills title, difficulty, ID, and topic tags.

LeetCode's public recent-submission feed may cap the raw submissions it returns. The tracker reports both raw submissions read and unique problems synced so the count is less surprising.

Optional private-profile cookies can be supplied through environment variables for deeper paginated history. With these set, the sync uses your authenticated submission list instead of the capped public recent feed:

```bash
LEETCODE_SESSION=... LEETCODE_CSRF_TOKEN=... npm start
```

For Vercel, set those same names as encrypted project environment variables only if you are comfortable letting the deployed serverless function use that account session. For private interview prep, local cookies are the safer default.

## Why This Structure

Interview prep works best when reference material becomes active recall:

- Notes explain the patterns.
- Flashcards test recognition.
- Visualizers make algorithm state changes concrete.
- Daily drills keep practice small enough to repeat consistently.

## Next Improvements

- Split `index.html` into separate `styles.css`, `app.js`, and data files once the feature set stabilizes.
- Add mock interview mode with timed prompts and post-solve reflection.
- Add full-progress import/export for checklist, flashcards, quiz state, and tracker together.
- Add a deeper LeetCode sync view for calendars, tag-level gaps, and contest history.
