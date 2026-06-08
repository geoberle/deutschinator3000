---
name: create-exercise
description: Create a new exercise set for the Deutschinator 3000 grammar trainer. Asks questions about the topic, generates exercises, and hooks the new file into the manifest.
trigger: When user wants to create a new exercise set, add exercises, or says "create exercise", "neue Übung", "Aufgaben erstellen".
---

# Create Exercise Skill

Generate a new exercise set JSON file for Deutschinator 3000 and register it in the manifest.

## Gathering Phase

Before generating anything, ask the user these questions **one at a time**. Use AskUserQuestion for each. Provide your recommended answer.

1. **Type**: Multiple choice or word-tap? (multiple-choice = pick from options, word-tap = tap words in a sentence)
2. **Topic**: What grammar topic? (e.g., Zeitformen, Aktiv/Passiv, Kasus, Konjunktiv, Satzglieder, Adverbien)
3. **Question**: What is the question asked per exercise? (e.g., "In welcher Zeitform steht dieser Satz?" or "Welches Wort ist das Adverb?")
4. **Options** (multiple-choice only): What are the fixed answer options?
5. **Count**: How many exercises? (recommend 12-15)
6. **Difficulty**: School level / age range? (e.g., 4. Klasse, 6. Klasse, Gymnasium)

## Exercise File Formats

Each exercise set is a self-contained JSON file in `exercises/`. Two types supported:

### Type: multiple-choice (default)

User picks one option from a list. No `type` field needed (backward compat).

```json
{
  "id": "kebab-case-id",
  "name": "Human-readable name",
  "question": "The question shown above each sentence",
  "exercises": [
    {
      "sentence": "A German sentence to analyze.",
      "options": ["Option A", "Option B", "Option C"],
      "correct": 0,
      "explanation": "Short explanation. Use «guillemets» for inline quotes."
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
      "explanation": "«draußen» ist ein Lokaladverb (Wo? → draußen)."
    }
  ]
}
```

- `words`: pre-tokenized sentence. Each element = one tappable pill. Punctuation attached to the word it follows (e.g., `"draußen."` not `"draußen"` + `"."`).
- `correct`: array of indices into `words`. Supports multi-word answers (e.g., `[3, 4, 5]` for "auf dem Sofa") and non-contiguous selections (e.g., `[1, 5]` for trennbare Verben).
- `classify` (optional): two-step exercise. After correct word selection, MC classification appears. Has `question`, `options`, and `correct` (index). If absent, exercise is single-step word-tap only.
- No `sentence` or `options` fields at exercise level (classify has its own options).

### Critical Rules for Exercise Content

- **Sentence quality**: Use natural, age-appropriate German sentences. Vary subjects, tenses, complexity.
- **Balance**: Distribute correct answers. Don't cluster same position repeatedly.
- **Explanations**: Always explain the WHY. Point out the key grammatical signal. Keep it 1-2 sentences.
- **Quoting**: Use «guillemets» (« and ») when quoting words in explanations. NEVER use ASCII double quotes inside JSON string values — they break the JSON.
- **Validate JSON**: After writing the file, validate it with `python3 -c "import json; json.load(open('exercises/FILENAME.json'))"`.
- **Option order** (multiple-choice): Keep options in a logical/consistent order across all exercises.
- **Word tokenization** (word-tap): Split on spaces. Keep punctuation attached to the preceding word. Each token becomes one tappable pill.

## Manifest Format

The manifest at `exercises/index.json` is an array of set descriptors:

```json
[
  {
    "id": "zeitformen",
    "name": "Zeitformen erkennen",
    "description": "Erkenne die Zeitform des Satzes",
    "file": "zeitformen.json",
    "count": 15
  }
]
```

## Generation Steps

1. Ask all gathering questions (one at a time)
2. Generate the exercise JSON file at `exercises/{id}.json`
3. Validate the JSON with Python
4. Read `exercises/index.json`, add the new entry, write it back
5. Report: filename, exercise count, topic summary

## Validation Checklist

Before finishing, verify:
- [ ] JSON is valid (python3 validation passes)
- [ ] No ASCII double quotes inside string values (use «guillemets» for inline quotes)
- [ ] `correct` index/indices match the right answer for every exercise
- [ ] Answer distribution is roughly balanced (position of correct words varies)
- [ ] Exercise count in manifest matches actual count in file
- [ ] `id` in the exercise file matches `id` in the manifest entry
