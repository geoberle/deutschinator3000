---
name: create-exercise
description: Create a new exercise set for the Deutschinator 3000 grammar trainer. Asks questions about the topic, generates exercises, and hooks the new file into the manifest.
trigger: When user wants to create a new exercise set, add exercises, or says "create exercise", "neue Übung", "Aufgaben erstellen".
---

# Create Exercise Skill

Generate a new exercise set JSON file for Deutschinator 3000 and register it in the manifest.

## Gathering Phase

Before generating anything, ask the user these questions **one at a time**. Use AskUserQuestion for each. Provide your recommended answer.

1. **Goal** (required): What should the kid learn? One sentence in German. This becomes the `goal` field and is shown on the exercise card.
2. **Authoring rationale** (required): Why does this exercise exist? Design reasoning, pedagogical intent. In German. Becomes `authoring.rationale`.
3. **Authoring constraints** (optional): Scope limitations (e.g., "Nur Präsens und Präteritum"). Becomes `authoring.constraints`.
4. **Type(s)**: Which exercise types? Can be one or mixed. (multiple-choice = pick from options, word-tap = tap words in a sentence, word-tap+classify = tap word then classify it, classify = multi-step classification of a sentence, satzglieder = assign categories to sentence chunks)
5. **Topic**: What grammar topic? (e.g., Zeitformen, Aktiv/Passiv, Kasus, Konjunktiv, Satzglieder, Adverbien)
6. **Question**: Default question for the set. Individual exercises can override this with their own `question` field.
7. **Options** (multiple-choice only): What are the fixed answer options?
8. **Count**: How many exercises? (recommend 12-15)
9. **Difficulty**: School level / age range? (e.g., 4. Klasse, 6. Klasse, Gymnasium)

## Exercise File Formats

Each exercise set is a self-contained JSON file in `exercises/`.

### Type resolution

Type is resolved per exercise: `exercise.type || set.type || "multiple-choice"`. This means:
- Set-level `type` applies to all exercises that don't specify their own
- Individual exercises can override with their own `type` field
- **Mixed types in one set are supported** — e.g., some MC, some word-tap

### Question resolution

Question is resolved per exercise: `exercise.question || set.question`. This means:
- Set-level `question` is the default shown above each exercise
- Individual exercises can override with their own `question` field
- Useful in mixed sets or when exercises need different prompts

### Type: multiple-choice (default)

User picks one option from a list.

```json
{
  "id": "kebab-case-id",
  "name": "Human-readable name",
  "goal": "Was das Kind lernen soll — ein Satz auf Deutsch.",
  "authoring": {
    "rationale": "Warum diese Übung existiert — pädagogische Begründung.",
    "constraints": "Optionale Einschränkungen (z.B. nur bestimmte Zeitformen)."
  },
  "question": "Default question for all exercises",
  "exercises": [
    {
      "sentence": "A German sentence to analyze.",
      "options": ["Option A", "Option B", "Option C"],
      "correct": 0,
      "explanation": "«singen» = Gegenwartsform, passiert jetzt.\n**Merke:** Einfaches Verb ohne Hilfsverb = Präsens."
    },
    {
      "question": "Override question for this specific exercise",
      "sentence": "Another sentence.",
      "options": ["Option A", "Option B"],
      "correct": 1,
      "explanation": "«lief» = einfache Vergangenheit von «laufen».\n**Merke:** Ein Wort, Vergangenheit, kein Hilfsverb = Präteritum."
    }
  ]
}
```

### Type: word-tap

User taps words in a sentence to select them. Used for Satzglieder, Wortarten, etc.

```json
{
  "id": "kebab-case-id",
  "name": "Human-readable name",
  "type": "word-tap",
  "question": "Welches Wort ist das Adverb?",
  "exercises": [
    {
      "words": ["Der", "Hund", "schläft", "draußen."],
      "correct": [3],
      "classify": {
        "question": "Welche Art von Adverb ist das?",
        "options": ["Lokaladverb", "Temporaladverb", "Modaladverb", "Kausaladverb"],
        "correct": 0
      },
      "explanation": "«draußen» beantwortet die Frage: Wo?\n**Merke:** Wo/Wohin/Woher → Lokaladverb."
    }
  ]
}
```

- `words`: pre-tokenized sentence. Each element = one tappable pill. Punctuation attached to the word it follows (e.g., `"draußen."` not `"draußen"` + `"."`).
- `correct`: array of indices into `words`. Supports multi-word answers (e.g., `[3, 4, 5]` for "auf dem Sofa") and non-contiguous selections (e.g., `[1, 5]` for trennbare Verben).
- `classify` (optional): two-step exercise. After correct word selection, MC classification appears. Has `question`, `options`, and `correct` (index). If absent, exercise is single-step word-tap only.
- No `sentence` or `options` fields at exercise level (classify has its own options).

### Type: classify

User classifies a sentence across multiple dimensions in sequence (e.g., voice + tense). Steps are presented one at a time. Correct step keeps the answer visible and advances to the next step. Wrong step bails out immediately (remaining steps marked unattempted).

```json
{
  "id": "aktiv-passiv-zeiten-1",
  "name": "Aktiv/Passiv + Zeitform 1",
  "type": "classify",
  "exercises": [
    {
      "sentence": "Der Kuchen wird von der Mutter gebacken.",
      "steps": [
        { "question": "Aktiv oder Passiv?", "options": ["Aktiv", "Vorgangspassiv", "Zustandspassiv"], "correct": 1 },
        { "question": "Welche Zeitform?", "options": ["Präsens", "Präteritum", "Perfekt", "Plusquamperfekt", "Futur I"], "correct": 0 }
      ],
      "explanation": "«wird gebacken» → jemand backt gerade.\n**Merke:** «werden» + Partizip II = Vorgangspassiv Präsens."
    }
  ]
}
```

- `steps`: array of classification steps, each with `question`, `options`, and `correct` (index). Steps are per-exercise (not set-level) so different exercises can have different options.
- No set-level `question` — each step carries its own question.
- Scoring is binary: all steps correct = right, any step wrong = wrong.
- Supports any number of steps (2 is typical).
- Answer encoding: colon-separated step indices (e.g., `"1:0"`). Unattempted steps = `-1` (e.g., `"2:-1"`).

### Type: word-bank

User builds a sentence by tapping words from a shuffled pool into an answer area. Supports multi-step (e.g., build Vorgangspassiv then Zustandspassiv), scaffolding (pre-placed leading words), and distractors.

```json
{
  "id": "aktiv-passiv-umwandeln-1",
  "name": "Passiv bilden 1",
  "type": "word-bank",
  "exercises": [
    {
      "sentence": "Die Mutter backt den Kuchen.",
      "steps": [
        {
          "question": "Bilde das Vorgangspassiv:",
          "answer": ["Der", "Kuchen", "wird", "gebacken"],
          "distractors": ["ist", "backt"],
          "scaffold": 2
        },
        {
          "question": "Bilde das Zustandspassiv:",
          "answer": ["Der", "Kuchen", "ist", "gebacken"],
          "distractors": ["wird", "backt"],
          "scaffold": 2
        }
      ],
      "explanation": "«wird gebacken» = Vorgang, «ist gebacken» = fertig.\n**Merke:** Vorgangspassiv mit «werden», Zustandspassiv mit «sein»."
    }
  ]
}
```

- `steps`: array of build steps, each with `question`, `answer`, `distractors`, and optional `scaffold`.
- `answer`: the correct sentence as a word array in order. **Do NOT include trailing punctuation (period) on the last word** — it reveals which word goes last. A period is auto-appended by the UI.
- `distractors`: extra words mixed into the pool. Keep to 1-2 for ADHD-friendliness.
- `scaffold` (optional): number of leading words from `answer` pre-placed in the answer area. These appear as muted/locked pills. Reduces working memory load.
- Keep sentences short (4-5 words in answer). Fewer words = less cognitive load.
- Scoring is binary per exercise. Answer encoding: per-step correctness (`1`/`0`/`-1`).

### Type: satzglieder

User assigns grammatical categories (Satzglieder) to pre-chunked sentence parts via tap-to-open popover. Supports non-adjacent chunks (e.g., split Prädikat: "hat … gekauft"). Categories are per-exercise-set, shown as color-coded badges with abbreviation labels.

```json
{
  "id": "satzglieder-1",
  "name": "Satzglieder bestimmen 1",
  "type": "satzglieder",
  "categories": ["S — Subjekt", "P — Prädikat", "O4 — Akkusativobjekt", "O3 — Dativobjekt", "TO — Temporaladverbiale", "LO — Lokaladverbiale"],
  "question": "Bestimme die Satzglieder",
  "exercises": [
    {
      "sentence": "Er hat gestern einen Hund gekauft",
      "chunks": [
        { "indices": [0], "correct": "S — Subjekt" },
        { "indices": [1, 5], "correct": "P — Prädikat" },
        { "indices": [2], "correct": "TO — Temporaladverbiale" },
        { "indices": [3, 4], "correct": "O4 — Akkusativobjekt" }
      ],
      "explanation": "**Er** → Wer hat gekauft? → S (Subjekt)\n**hat … gekauft** → Was geschieht? → P (Prädikat, zweiteilig!)\n**gestern** → Wann? → TO (Temporaladverbiale)\n**einen Hund** → Wen/Was? → O4 (Akkusativobjekt)"
    }
  ]
}
```

- `categories`: array of category labels at set level. Format: `"ABBREV — Full Name"`. Shown in popover with full name, shown as badge with abbreviation only after assignment. Standard abbreviations: S (Subjekt), P (Prädikat), O4 (Akkusativobjekt), O3 (Dativobjekt), O2 (Genitivobjekt), PO (Präpositionalobjekt), TO (Temporaladverbiale), LO (Lokaladverbiale), MO (Modaladverbiale), KA (Kausaladverbiale).
- `chunks`: array of sentence parts. Each chunk has `indices` (word positions in sentence split on spaces) and `correct` (must match a category string exactly).
- `indices` can be non-adjacent (e.g., `[1, 5]` for split Prädikat). Consecutive indices render as one visual pill. Non-adjacent indices of the same chunk share color and highlight on hover.
- `correct` must be an exact string match to one of the `categories` entries.
- Every word index in the sentence must appear in exactly one chunk.
- Scoring is all-or-nothing: every chunk must have the correct category assigned.
- Answer encoding: colon-separated category indices (e.g., `"0:1:6:2"`).

### Mixed-type set example

```json
{
  "id": "grammatik-mix",
  "name": "Grammatik-Mix",
  "exercises": [
    {
      "type": "multiple-choice",
      "question": "In welcher Zeitform steht der Satz?",
      "sentence": "Ich habe das Buch gelesen.",
      "options": ["Präsens", "Präteritum", "Perfekt"],
      "correct": 2,
      "explanation": "«habe» + «gelesen» → zwei Teile.\n**Merke:** «haben/sein» + Partizip II = Perfekt."
    },
    {
      "type": "word-tap",
      "question": "Welches Wort ist das Verb?",
      "words": ["Die", "Katze", "schläft.", ],
      "correct": [2],
      "explanation": "«schläft» beantwortet: Was tut die Katze?\n**Merke:** Das Verb sagt, was jemand tut oder was passiert."
    }
  ]
}
```

### Optional: `reveal` — Post-Solve Word Highlighting

Any exercise with a `sentence` field (MC, classify, word-bank) can include `"reveal": [indices]` to highlight key words after the kid answers. The highlighted words appear with an amber background — useful for drawing attention to trigger words like «werden»/«sein» in passive exercises.

```json
{
  "sentence": "Das Fenster wird geöffnet.",
  "reveal": [2],
  ...
}
```

- `reveal` is an array of zero-based word indices (sentence split on spaces)
- Highlight appears immediately on answer (correct or wrong)
- Also shown in review mode
- Future: `highlight` (separate field) reserved for pre-solve highlighting

### Critical Rules for Exercise Content

- **Sentence quality**: Use natural, age-appropriate German sentences. Vary subjects, tenses, complexity.
- **Balance**: Distribute correct answers. Don't cluster same position repeatedly.
- **Explanations**: Markdown-enabled via snarkdown. Structure for ADHD:
  - **Line 1:** What happened in THIS sentence — concrete, specific (e.g., `«wird geöffnet» → jemand öffnet das Fenster gerade.`)
  - **Line 2:** `**Merke:**` + the abstract grammar rule (e.g., `**Merke:** «werden» + Partizip II = Vorgangspassiv.`)
  - **Line 3 (optional):** Only for complex topics that genuinely need it
  - Use `\n` for line breaks between lines
  - Keep «guillemets» plain — no extra bold/code on quoted words
  - Max 3 lines. Most exercises need only 2. Short, direct, no filler.
  - Example: `"explanation": "«wird geöffnet» → jemand öffnet das Fenster gerade.\n**Merke:** «werden» + Partizip II = Vorgangspassiv."`
- **Quoting**: Use «guillemets» (« and ») when quoting words in explanations. NEVER use ASCII double quotes inside JSON string values — they break the JSON.
- **Validate**: After writing the file and updating the manifest, run `python3 validate.py` to check all exercises (JSON validity, type resolution, correct indices, orphan files).
- **Option order** (multiple-choice): Keep options in a logical/consistent order across all exercises.
- **Word tokenization** (word-tap): Split on spaces. Keep punctuation attached to the preceding word. Each token becomes one tappable pill.

## Manifest Format

The manifest at `exercises/index.json` is an array of set descriptors:

```json
[
  {
    "id": "zeitformen",
    "name": "Zeitformen erkennen",
    "goal": "Die Zeitform in Sätzen sicher erkennen.",
    "description": "Erkenne die Zeitform des Satzes (Präsens, Präteritum, Perfekt, Plusquamperfekt, Futur I)",
    "file": "zeitformen.json",
    "count": 15,
    "category": "Zeiten"
  }
]
```

- `goal`: shown on the exercise card in the menu (learning intent — why)
- `description`: shown on the first question when starting the exercise (task instruction — what to do)

**Ordering matters**: The home screen renders entries in manifest order. Category headers are shown when the category changes from the previous entry. Sets with the same `category` MUST be adjacent in the array — otherwise the category header renders multiple times.

## Generation Steps

1. Ask all gathering questions (one at a time)
2. Generate the exercise JSON file at `exercises/{id}.json`
3. Read `exercises/index.json`, add the new entry, write it back
4. Run `python3 validate.py` — must pass with 0 errors
5. Report: filename, exercise count, topic summary

## Validation Checklist

Before finishing, verify:
- [ ] `python3 validate.py` passes with 0 errors
- [ ] No ASCII double quotes inside string values (use «guillemets» for inline quotes)
- [ ] `correct` index/indices match the right answer for every exercise
- [ ] Answer distribution is roughly balanced (position of correct words varies)
- [ ] Exercise count in manifest matches actual count in file
- [ ] `id` in the exercise file matches `id` in the manifest entry
