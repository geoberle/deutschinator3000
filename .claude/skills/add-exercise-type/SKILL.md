---
name: add-exercise-type
description: Guide for adding a new exercise question type to Deutschinator 3000. Covers data format, rendering, answer handling, URL encoding, review mode, validation, CSS, and skill docs.
trigger: When adding a new exercise type, new question format, or new interaction pattern to the app.
---

# Add Exercise Type

Step-by-step guide for adding a new exercise question type. The app uses a dispatch architecture — each type is self-contained across 6 integration points.

## Architecture Overview

Type resolution: `exercise.type || set.type || "multiple-choice"`. Each exercise self-describes its type. Mixed types per set are supported.

All type-specific logic lives in dispatch functions in `app.js`. The quiz flow, progress dots, summary, sharing, and navigation are type-agnostic.

## Integration Points (all in `app.js`)

### 1. Render function (quiz mode)

Add a `renderX(ex)` function and wire it into `renderExercise()`.

**Pattern**: Return `{ html: string, bind: function }`. `html` is the exercise content markup. `bind` attaches event listeners after innerHTML is set.

```javascript
// In renderExercise():
function renderExercise(ex) {
  var type = exType(ex);
  if (type === "word-tap") return renderWordTap(ex);
  if (type === "your-type") return renderYourType(ex);  // ADD
  return renderMC(ex);
}

// New render function:
function renderYourType(ex) {
  var html = '...your markup...';
  html += '<div id="feedback"></div>';  // REQUIRED — feedback/Weiter appended here
  return { html: html, bind: function () {
    // Attach click/tap handlers
    // These handlers must eventually call:
    //   results.push(correct);
    //   chosenAnswers.push(answer);
    //   then update progress dot and call showFeedback()
  }};
}
```

**Rules**:
- Must include `<div id="feedback"></div>` — the framework appends explanation + Weiter button here
- Must set `answered = true` when the user commits an answer (prevents double-submission)
- Must push to `results` (boolean) and `chosenAnswers` (the raw answer value)
- Must color the progress dot: `dots[index].className = "progress-dot " + (correct ? "dot-correct" : "dot-wrong")`
- Call `showFeedback(correct, ex.explanation)` for simple types, or build custom feedback flow (like word-tap's two-step classify)

**Reference**: `renderMC()` for simple type, `renderWordTap()` for complex type with multi-step.

### 2. Correctness check

Add a case in `isCorrect(ex, answer)`.

```javascript
function isCorrect(ex, answer) {
  var type = ex.type || ...;
  if (type === "your-type") return yourTypeCorrect(answer, ex);  // ADD
  if (type === "word-tap") return isWordTapCorrect(answer, ex);
  return answer === ex.correct;
}
```

The function receives the raw `answer` from `chosenAnswers` and the exercise object. Returns boolean.

### 3. Answer encoding (share URLs)

Update `encodeAnswer(a)` to handle your answer format.

**Constraint**: The encoded answer must be a string containing NO commas (`,` separates exercises) and NO pipes (`|` separates order from answers). Colons (`:`) and plus (`+`) are used by word-tap. Choose a different separator if needed.

Current encoding formats:
- MC: `"2"` (option index as string)
- word-tap: `"3"` or `"1:4"` (colon-separated word indices)
- word-tap+classify: `"3+0"` (word indices + classify choice)
- classify: `"1:0"` (colon-separated step indices, `-1` for unattempted)

```javascript
function encodeAnswer(a) {
  if (isYourType(a)) return yourEncode(a);  // ADD
  if (a && typeof a === "object" && !Array.isArray(a)) {
    return a.words.join(":") + "+" + a.classify;
  }
  return Array.isArray(a) ? a.join(":") : String(a);
}
```

### 4. Answer decoding (share URLs)

Update `decodeAnswer(str, ex)` to reconstruct your answer from the encoded string.

```javascript
function decodeAnswer(str, ex) {
  var type = ex.type || ...;
  if (type === "your-type") return yourDecode(str);  // ADD
  if (type === "word-tap") { ... }
  return Number(str);
}
```

### 5. Review rendering (shared result navigation)

Add a `renderReviewX(ex, chosen)` function and wire it into `renderReviewExercise()`.

**Pattern**: Return `{ html: string, correct: boolean, bind: function }`. Shows the exercise with the user's answer pre-filled and highlighted green/red.

```javascript
function renderReviewExercise(ex, chosen) {
  var type = reviewExType(ex);
  if (type === "your-type") return renderReviewYourType(ex, chosen);  // ADD
  if (type === "word-tap") return renderReviewWordTap(ex, chosen);
  return renderReviewMC(ex, chosen);
}

function renderReviewYourType(ex, chosen) {
  var correct = isCorrect(ex, chosen);
  var html = '...markup with .correct/.wrong classes pre-applied...';
  return { html: html, correct: correct, bind: function () {} };
}
```

**Rules**:
- All interactive elements must have `.answered` class (cursor: default, no hover)
- Correct answers: `.correct` class (green)
- Wrong answers: `.wrong` class (red)
- Missed correct answers: `.word-missed` or similar (green dashed)
- No event listeners needed — review is read-only

### 6. Question resolution

Already handled by the framework: `ex.question || currentSet.question` (quiz) or `ex.question || reviewSet.question` (review). No changes needed unless your type has a different question pattern.

## Data Format

Define your exercise JSON shape. Document it in `.claude/skills/create-exercise/SKILL.md`.

**Required fields for all types**:
- `explanation` (string): shown after answering, explains the correct answer
- `correct` (any): the ground truth answer (format depends on type)

**Optional fields**:
- `type` (string): exercise type identifier. Omit to inherit from set level
- `question` (string): override set-level question for this exercise

## CSS

Add styles for your new elements in `style.css`. Follow existing patterns:
- Interactive elements: `border: 2px solid #e0e0e0`, `border-radius: 8px`, `min-height: 48px` (mobile tap target)
- Selected state: blue (`#1976d2` border, `#e3f2fd` background)
- Correct: green (`#2e7d32` border, `#e8f5e9` background)
- Wrong: red (`#c62828` border, `#ffebee` background)
- Answered/disabled: `cursor: default`, add `.answered` class
- Animations: `transition: border-color 0.15s, background-color 0.15s`
- Mobile: `-webkit-tap-highlight-color: transparent` on tappable elements

## Validation

Update `validate.py` to check your type's required fields:

```python
if ex_type == "your-type":
    # Check required fields exist and have correct types
    # Check correct indices/values are in valid range
    # Check for classify sub-object if applicable
```

## Checklist

Before declaring done:

- [ ] `renderExercise()` dispatches to new render function
- [ ] `isCorrect()` handles new answer format
- [ ] `encodeAnswer()` encodes new answer format (no commas or pipes)
- [ ] `decodeAnswer()` reconstructs answer from string
- [ ] `renderReviewExercise()` dispatches to new review render function
- [ ] CSS styles for all states (default, hover, selected, correct, wrong, answered)
- [ ] `validate.py` checks new type's required fields
- [ ] `create-exercise` skill SKILL.md documents new type's JSON format
- [ ] Playwright test: quiz flow (render → interact → feedback → Weiter)
- [ ] Playwright test: review mode shows correct/wrong highlighting
- [ ] Playwright test: mobile viewport renders correctly
- [ ] Existing MC and word-tap exercises still work (regression)
- [ ] `?v=N` bumped in `index.html` if deploying
