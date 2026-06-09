---
name: manage-challenge
description: Update the daily challenge for Deutschinator 3000. Asks which exercise sets to include and writes challenges.json.
trigger: When user wants to update the daily challenge, change the Tagesübung, set up today's exercises, or says "manage challenge", "update challenge", "Tagesübung ändern".
---

# Manage Daily Challenge

Update the daily challenge by selecting which exercise sets to include.

## Gathering Phase

Ask the user these questions **one at a time** using AskUserQuestion:

1. **Which sets?** Show the current exercise sets from `exercises/index.json` and ask which to include in the challenge. Present as a multi-select list. Default to the current challenge sets if `exercises/challenges.json` exists.
2. **Name** (optional): What to call the challenge? Default: "Tagesübung". Only ask if the user seems to want a custom name.

## File Format

`exercises/challenges.json` — single object (NOT an array):

```json
{
  "id": "passiv-tag-1",
  "name": "Tagesübung",
  "sets": ["aktiv-passiv", "passiv-arten-1", "aktiv-passiv-zeiten-1"]
}
```

- `id`: unique identifier. Progress is stored in localStorage keyed by this. Changing the ID resets progress. Use a new ID when the challenge content changes (e.g., `"passiv-tag-1"`, `"passiv-tag-2"`)
- `name`: display name shown on the challenge card and celebration screen
- `sets`: array of exercise set IDs (must match `id` fields in `exercises/index.json`)
- Order matters — sets are played in the order listed
- Progress persists in localStorage: kid can close browser and resume where they left off. Progress clears on completion or when `id` changes.

## Steps

1. Read `exercises/index.json` to list available sets
2. Read `exercises/challenges.json` to show current selection (if exists)
3. Ask which sets to include (multi-select)
4. Write `exercises/challenges.json`
5. Bump `?v=N` in `index.html` if deploying

## Rules

- Set IDs must exist in `exercises/index.json`
- At least 1 set required
- Keep it to 2-4 sets for a manageable daily session (ADHD-friendly)
- Order = play order. Put easier/shorter sets first for warm-up
