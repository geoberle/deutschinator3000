#!/usr/bin/env python3
"""Validate all exercise files against the manifest."""

import json
import sys
from pathlib import Path

BASE = Path(__file__).parent / "exercises"
errors = 0


def err(msg):
    global errors
    print(f"  ERROR: {msg}")
    errors += 1


# Load manifest
with open(BASE / "index.json") as f:
    manifest = json.load(f)

print(f"Manifest: {len(manifest)} entries\n")

for entry in manifest:
    eid = entry["id"]
    fname = entry["file"]
    path = BASE / fname
    print(f"[{eid}] {fname}")

    if not path.exists():
        err(f"File not found: {path}")
        continue

    with open(path) as f:
        data = json.load(f)

    # ID match
    if data.get("id") != eid:
        err(f"ID mismatch: manifest={eid}, file={data.get('id')}")

    # Count match
    actual = len(data.get("exercises", []))
    if actual != entry["count"]:
        err(f"Count mismatch: manifest={entry['count']}, actual={actual}")

    set_type = data.get("type", "multiple-choice")

    # Question exists (not required for classify/word-bank — steps carry their own)
    if set_type not in ("classify", "word-bank") and not data.get("question"):
        err("Missing 'question' field")

    for i, ex in enumerate(data.get("exercises", [])):
        prefix = f"  Exercise {i+1}: "
        ex_type = ex.get("type", set_type)

        if ex_type == "word-tap":
            words = ex.get("words")
            if not words or not isinstance(words, list):
                err(f"{prefix}Missing or invalid 'words' array")
                continue
            correct = ex.get("correct")
            if not correct or not isinstance(correct, list):
                err(f"{prefix}Missing or invalid 'correct' array")
                continue
            for idx in correct:
                if idx < 0 or idx >= len(words):
                    err(f"{prefix}correct index {idx} out of range (0-{len(words)-1})")
            classify = ex.get("classify")
            if classify:
                if not classify.get("question"):
                    err(f"{prefix}classify missing 'question'")
                copts = classify.get("options")
                if not copts or not isinstance(copts, list):
                    err(f"{prefix}classify missing or invalid 'options'")
                else:
                    cidx = classify.get("correct")
                    if not isinstance(cidx, int):
                        err(f"{prefix}classify 'correct' is not an integer")
                    elif cidx < 0 or cidx >= len(copts):
                        err(f"{prefix}classify correct {cidx} out of range (0-{len(copts)-1})")
        elif ex_type == "classify":
            if not ex.get("sentence"):
                err(f"{prefix}Missing 'sentence'")
            steps = ex.get("steps")
            if not steps or not isinstance(steps, list):
                err(f"{prefix}Missing or invalid 'steps' array")
                continue
            for si, step in enumerate(steps):
                sp = f"{prefix}step {si+1}: "
                if not step.get("question"):
                    err(f"{sp}missing 'question'")
                sopts = step.get("options")
                if not sopts or not isinstance(sopts, list):
                    err(f"{sp}missing or invalid 'options'")
                else:
                    sc = step.get("correct")
                    if not isinstance(sc, int):
                        err(f"{sp}'correct' is not an integer")
                    elif sc < 0 or sc >= len(sopts):
                        err(f"{sp}correct {sc} out of range (0-{len(sopts)-1})")
        elif ex_type == "word-bank":
            if not ex.get("sentence"):
                err(f"{prefix}Missing 'sentence'")
            steps = ex.get("steps")
            if not steps or not isinstance(steps, list):
                err(f"{prefix}Missing or invalid 'steps' array")
                continue
            for si, step in enumerate(steps):
                sp = f"{prefix}step {si+1}: "
                if not step.get("question"):
                    err(f"{sp}missing 'question'")
                answer = step.get("answer")
                if not answer or not isinstance(answer, list):
                    err(f"{sp}missing or invalid 'answer' array")
        else:
            if not ex.get("sentence"):
                err(f"{prefix}Missing 'sentence'")
            options = ex.get("options")
            if not options or not isinstance(options, list):
                err(f"{prefix}Missing or invalid 'options' array")
                continue
            correct = ex.get("correct")
            if not isinstance(correct, int):
                err(f"{prefix}'correct' is not an integer")
            elif correct < 0 or correct >= len(options):
                err(f"{prefix}correct index {correct} out of range (0-{len(options)-1})")

        if not ex.get("explanation"):
            err(f"{prefix}Missing 'explanation'")

    print(f"  {actual} exercises, type={set_type} — OK" if errors == 0 else "")

# Check for orphan files
manifest_files = {e["file"] for e in manifest}
for p in BASE.glob("*.json"):
    if p.name not in ("index.json", "challenges.json") and p.name not in manifest_files:
        err(f"Orphan file not in manifest: {p.name}")

print(f"\n{'All valid!' if errors == 0 else f'{errors} error(s) found.'}")
sys.exit(1 if errors else 0)
