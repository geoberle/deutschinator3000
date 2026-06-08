---
name: create-exercise
description: Create a new exercise set for the Deutschinator 3000 grammar trainer. Asks questions about the topic, generates exercises, and hooks the new file into the manifest.
trigger: When user wants to create a new exercise set, add exercises, or says "create exercise", "neue Übung", "Aufgaben erstellen".
---

# Create Exercise Skill

Generate a new exercise set JSON file for Deutschinator 3000 and register it in the manifest.

## Gathering Phase

Before generating anything, ask the user these questions **one at a time**. Use AskUserQuestion for each. Provide your recommended answer.

1. **Topic**: What grammar topic? (e.g., Zeitformen, Aktiv/Passiv, Kasus, Konjunktiv, Satzglieder)
2. **Question**: What is the question asked per exercise? (e.g., "In welcher Zeitform steht dieser Satz?")
3. **Options**: What are the fixed answer options? (e.g., ["Präsens", "Präteritum", "Perfekt", "Plusquamperfekt", "Futur I"])
4. **Count**: How many exercises? (recommend 12-15)
5. **Difficulty**: School level / age range? (e.g., 4. Klasse, 6. Klasse, Gymnasium)

## Exercise File Format

Each exercise set is a self-contained JSON file in `exercises/`:

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
      "explanation": "Short explanation of why this is the correct answer. Use «guillemets» for inline quotes of words from the sentence (NOT regular double quotes — those break JSON)."
    }
  ]
}
```

### Critical Rules for Exercise Content

- **Sentence quality**: Use natural, age-appropriate German sentences. Vary subjects, tenses, complexity.
- **Balance**: Distribute correct answers roughly evenly across all options. Don't cluster.
- **Explanations**: Always explain the WHY. Point out the key grammatical signal (verb form, word order, etc.). Keep it 1-2 sentences.
- **Quoting**: Use «guillemets» (« and ») when quoting words from the sentence in explanations. NEVER use ASCII double quotes inside JSON string values — they break the JSON.
- **Validate JSON**: After writing the file, validate it with `python3 -c "import json; json.load(open('exercises/FILENAME.json'))"`.
- **Option order**: Keep options in a logical/consistent order across all exercises in the set.

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
- [ ] `correct` index matches the right option for every exercise
- [ ] Answer distribution is roughly balanced
- [ ] Exercise count in manifest matches actual count in file
- [ ] `id` in the exercise file matches `id` in the manifest entry
