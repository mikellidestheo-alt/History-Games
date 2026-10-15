# The Editor's Desk: a Cold War historiography game

A browser game for **Cambridge International AS & A Level History (9489), Paper 3: Historical Interpretations, The origins and development of the Cold War**.

Students play a junior editor at Meridian Press, a fictional American academic publisher. Over four working days (1953, 1967, 1979 and 1997), manuscripts by fictional historians arrive on the desk. Students read each extract, identify the interpretation, then decide whether to publish it under that year's political pressure.

**Link to share with students:**
https://mikellidestheo-alt.github.io/History-Games/cold-war-editor/

It works on iPad and iPhone (Safari), as well as on laptops. Students can tap **Share → Add to Home Screen** to install it like an app. After the first visit it also works offline.

---

## How to play

1. On the title screen, students type their name and tap **Start work**. Progress saves automatically on the device, so **Continue** picks up where they left off. **Restart game** starts again from Day 1.
2. Each day opens with a **morning briefing**: the year, the political climate and the board's **directive** (what Meridian Press is willing to publish that year).
3. At the desk, each of the five manuscripts shows a **dossier** (the author's background) and the **extract**. The **rulebook** can be opened at any time. It holds the day's directive, the definitions of the interpretations available that day, the five approaches and a tip. Anything new since the previous day is marked **NEW**.
4. For every manuscript the student completes five steps, in order:
   - **A. Flag the main argument**: tap the sentence that carries the historian's central claim, then confirm. Students can change their choice until they confirm.
   - **B. Classify**: choose the interpretation (only the day's options are shown).
   - **C. Flag the concession**: tap the sentence where the historian admits a point for the other side, or tap **No concession** if there isn't one. The main-argument sentence can't be chosen here.
   - **D. Approach**: choose the approach. This step is skipped if they chose "Not an argument about blame".
   - **E. Stamp**: PUBLISH or REJECT, according to the day's directive.

   Before stamping, students can tap any finished letter (A–D) in the progress boxes to go back and change that answer. Their other answers stay selected, so they just confirm forward again. Once a manuscript is stamped, it is final.
5. During the day the only feedback is the board's tally, which updates when each stamp lands. At the end of the day there is a full **review**: each extract with sentence numbers, the main argument, concessions and sub-messages highlighted, the student's answers beside the correct ones, the explanation, the historical anchors and (if they got A, B or C wrong) the trap that caught them. A board memo follows, then the day's integrity score.
6. After Day 4 the **final report** gives the overall integrity percentage and rank, board compliance, the trap the student fell into most often, and the debrief. **Show my results card** produces a one-screen summary for students to screenshot and show you.

**On iPhone** the desk uses tabs (Dossier / Extract / Rulebook), with the decision panel fixed at the bottom. **On iPad** everything sits on one desk.

**Settings** (gear icon): sound (off by default), text size (normal / large) and an optional day timer. The timer gives 3 minutes per manuscript with a gentle reminder and never submits for the student.

## How scoring works

The points come from `meta.scoring` in the JSON file.

| Step | Counts towards | Points (current file) |
|---|---|---|
| A. Main argument | Scholarly Integrity | 1 (any sentence listed in `key.mainArgument` is correct) |
| B. Interpretation | Scholarly Integrity | 2 |
| C. Concession | Scholarly Integrity | 1 (any sentence listed in `key.concessions`; if that list is empty, **No concession** is correct) |
| D. Approach | Scholarly Integrity | 1 (`key.approach` or anything in `key.approachAlsoAccept`) |
| E. Stamp | Board Compliance | 1 |

- **Scholarly Integrity** is hidden during the day and revealed in the end-of-day review. The rank on the final report comes from `endings.integrityBands`.
- **Board Compliance** is whether the stamp matches what the directive requires for the manuscript's *true* interpretation (`key.stamp`), whatever the student classified it as.
- **"Not an argument about blame"** follows `meta.scoring.notes`. If it is correct and the student picks it, step D is skipped and its point awarded. If the student picks it wrongly, step D is skipped and its point is lost. If the correct answer is "not_blame" but the student picks another interpretation, they still see step D; no approach can be correct there, so that point is lost.
- The "most common trap" counts the manuscripts where the student got step A, B or C wrong, grouped by each manuscript's `trap`. The warm-up `none` is not counted.

## Editing or adding manuscripts

All the content lives in **`cold-war-editor/data/manuscripts.json`**. The game reads it every time it starts, so you never need to touch the code. To edit it on GitHub: open the file, tap the pencil icon (Edit), make your change and tap **Commit changes**. Students see the change the next time they open the game online. GitHub Pages can take a minute or two to update.

The game shows all text exactly as written. A few rules:

- Each manuscript belongs to a day through `"day"`. The game shows a day's manuscripts in the order they appear in the file. A day can have more or fewer than five.
- Sentence numbers in `key` count from **1**. If you reorder sentences, update the numbers in `key` and in the `explanation`.
- A sentence cannot be both a main argument and a concession. Leave `concessions` empty (`[]`) for an extract that concedes nothing; students then need to choose **No concession**.
- Vary where the main argument sits (first, middle or last sentence), so students cannot score by always tapping the same position.
- `key.school` must be one of that day's `schoolOptions`, otherwise students cannot choose it.
- `key.stamp` must match the directive: `"PUBLISH"` if `key.school` is in the day's `publishSchools`, otherwise `"REJECT"`.
- `key.approach` must be one of the `approaches`, or `null` when the school is `not_blame`.
- `trap` must be a key in `traps`.

**Checking your edits.** If anything breaks these rules, the title screen shows a **"Content check: … problems found"** box listing exactly what is wrong. Nothing is changed automatically. If the file has a JSON syntax error (a missing comma or quote, for example), the game shows "The manuscripts could not be loaded". Paste the file into a JSON checker such as jsonlint.com to find the error.

### Annotated example entry

JSON does not allow comments, so the notes are shown here after `//`. **Do not** paste the `//` notes into the real file.

```jsonc
{
  "id": "1-2",                     // unique id; any text, but keep it unique
  "day": 1,                        // which day it appears on (matches "day" in days)
  "dossier": {
    "name": "Dr Margaret Ellery",  // write "[Redacted]" to show a blacked-out field
    "role": "Lecturer in Modern History, Harwell University",
    "nationality": "American",
    "yearWritten": 1953,           // a number, or null when redacted
    "sources": [
      "Memoirs of American and British wartime diplomats",
      "Translations of Soviet speeches"
    ],
    "redacted": false              // true = anonymised dossier (blacked-out portrait)
  },
  "sentences": [                   // one string per sentence; numbered 1, 2, 3… in the key
    "Critics of American policy are fond of listing its mistakes, and some of their charges are fair.",
    "Washington was slow to explain its aims, and its talk of an 'open door' in Eastern Europe must have sounded to Moscow like interference.",
    "But misjudgements of tone do not start a cold war.",
    "The conflict came because the Soviet leadership believed, as a matter of doctrine, that no lasting peace with capitalist states was possible.",
    "…"
  ],
  "wordCount": 112,                // for your reference; not used by the game
  "key": {
    "mainArgument": [4],           // sentence(s) accepted as the main argument
    "concessions": [1, 2],         // any of these scores in step C; [] means "No concession" is correct
    "subMessages": [],             // highlighted in green in the review
    "school": "traditionalist",    // a key from "schools", and in this day's schoolOptions
    "approach": "Ideology",        // one of "approaches"; null if school is "not_blame"
    "approachAlsoAccept": [],      // other approaches that also score
    "stamp": "PUBLISH"             // what the day's directive requires for this school
  },
  "trap": "concession",            // a key from "traps"; shown if the student gets A, B or C wrong
  "explanation": "Sentences 1–2 concede American mistakes, but sentence 3 dismisses them…",
  "anchors": [                     // real events, listed in the review
    "Stalin's election speech (February 1946)"
  ]
}
```

To **add** a manuscript, copy an existing entry, paste it after the last one in `"manuscripts"` (with a comma between entries), give it a new `id` and edit the fields. To **add a day**, add an entry to `"days"` with a new `day` number and give some manuscripts that `day`.

## Privacy and storage

There are no accounts, no tracking and no server. Names and progress stay only in the browser on that device (localStorage). If storage is blocked, the game still works but cannot save progress between visits.

## For maintainers

- Plain static files: `index.html`, `css/`, `js/`, `data/`, `icons/`, `manifest.webmanifest`, `sw.js`. No build step and no external libraries.
- `sw.js` caches the game for offline use. It always fetches every file from the network first, so online devices get your latest content and code on their next visit; the cache is only used offline. If you add or rename files, update the list and raise `VERSION` in `sw.js`.
- `tests/validate-content.mjs` runs the content checks: `node cold-war-editor/tests/validate-content.mjs`.
- `tests/e2e.mjs` plays the whole game at iPhone and iPad sizes with Playwright. Start a local server from the repository root (`python3 -m http.server 8765`), then run `node cold-war-editor/tests/e2e.mjs`.
- `tools/make_icons.py` regenerates the home-screen icons (needs Python and Pillow).
- All art is original and drawn in code (inline SVG and CSS). Sounds are generated with the Web Audio API.
