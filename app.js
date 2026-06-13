(function () {
  "use strict";

  var app = document.getElementById("app");

  var sets = [];
  var currentSet = null;
  var exercises = [];
  var exerciseOrder = [];
  var chosenAnswers = [];
  var index = 0;
  var results = [];
  var answered = false;
  var selectedWords = [];
  var classifyStepAnswers = [];
  var wordBankStepResults = [];
  var wordBankPlaced = [];
  var wordBankPool = [];
  var satzgliederAnswers = [];
  var wordBankCurrentStep = 0;

  var challengeDef = null;
  var challengeSetIndex = 0;
  var challengeScores = [];
  var challengeAttempts = {};
  var inChallengeHub = false;

  var rulesCache = {};

  var fixMode = false;
  var fixIndices = [];

  var quizInProgress = false;
  var quizHash = "";

  var reviewSet = null;
  var reviewExercises = [];
  var reviewAnswers = [];
  var reviewIndex = 0;

  // --- Exercise type dispatch ---

  function exType(ex) {
    return ex.type || (currentSet && currentSet.type) || "multiple-choice";
  }

  function reviewExType(ex) {
    return ex.type || (reviewSet && reviewSet.type) || "multiple-choice";
  }

  function renderSentence(sentence, reveal, show) {
    if (!reveal || !show) return '<div class="sentence">' + esc(sentence) + "</div>";
    var words = sentence.split(" ");
    var html = '<div class="sentence">';
    for (var i = 0; i < words.length; i++) {
      if (i > 0) html += " ";
      if (reveal.indexOf(i) > -1) {
        html += '<span class="reveal-word">' + esc(words[i]) + "</span>";
      } else {
        html += esc(words[i]);
      }
    }
    html += "</div>";
    return html;
  }

  function revealSentence(ex) {
    if (!ex.reveal) return;
    var sentenceEl = document.querySelector(".sentence");
    if (!sentenceEl) return;
    sentenceEl.outerHTML = renderSentence(ex.sentence, ex.reveal, true);
    var hintBtn = document.getElementById("hint-btn");
    if (hintBtn) hintBtn.remove();
  }

  // --- Render exercise (quiz mode) ---

  function renderExercise(ex) {
    var type = exType(ex);
    if (type === "word-tap") {
      return renderWordTap(ex);
    }
    if (type === "classify") {
      return renderClassify(ex);
    }
    if (type === "word-bank") {
      return renderWordBank(ex);
    }
    if (type === "satzglieder") {
      return renderSatzglieder(ex);
    }
    return renderMC(ex);
  }

  function renderHintBtn(ex) {
    if (!ex.reveal) return "";
    return '<div class="hint-btn" id="hint-btn">💡 Hinweis</div>';
  }

  function bindHintBtn(ex) {
    var btn = document.getElementById("hint-btn");
    if (!btn) return;
    btn.addEventListener("click", function () {
      revealSentence(ex);
      btn.remove();
    });
  }

  function renderMC(ex) {
    var html = '<div class="sentence">' + esc(ex.sentence) + "</div>" +
      renderHintBtn(ex) +
      '<div class="options" id="options"></div>' +
      '<div id="feedback"></div>';
    return { html: html, bind: function () {
      bindHintBtn(ex);
      var optionsEl = document.getElementById("options");
      for (var i = 0; i < ex.options.length; i++) {
        var btn = document.createElement("button");
        btn.className = "option-btn";
        btn.textContent = ex.options[i];
        btn.setAttribute("data-index", i);
        btn.addEventListener("click", onOptionClick);
        optionsEl.appendChild(btn);
      }
    }};
  }

  function renderWordTap(ex) {
    var html = "";
    if (ex.correct.length > 1) {
      html += '<div class="word-hint">(' + ex.correct.length + " Wörter)</div>";
    }
    html += '<div class="words" id="words">';
    for (var w = 0; w < ex.words.length; w++) {
      html += '<span class="word-pill" data-idx="' + w + '">' + esc(ex.words[w]) + "</span>";
    }
    html += "</div>" +
      '<button class="submit-btn" id="submit-btn">Prüfen</button>' +
      '<div id="feedback"></div>';
    return { html: html, bind: function () {
      selectedWords = [];
      var pills = document.querySelectorAll(".word-pill");
      for (var p = 0; p < pills.length; p++) {
        pills[p].addEventListener("click", onWordTap);
      }
      document.getElementById("submit-btn").addEventListener("click", onWordTapSubmit);
    }};
  }

  function renderClassify(ex) {
    var html = '<div class="sentence">' + esc(ex.sentence) + "</div>" +
      renderHintBtn(ex) +
      '<div id="classify-steps"></div>' +
      '<div id="feedback"></div>';
    return { html: html, bind: function () {
      bindHintBtn(ex);
      classifyStepAnswers = [];
      appendClassifyStep(ex, 0);
    }};
  }

  function appendClassifyStep(ex, stepIdx) {
    var step = ex.steps[stepIdx];
    var container = document.getElementById("classify-steps");
    var stepDiv = document.createElement("div");
    stepDiv.className = "classify-step";
    stepDiv.innerHTML =
      '<div class="classify-question">' + esc(step.question) + "</div>" +
      '<div class="options"></div>';
    container.appendChild(stepDiv);

    var optionsEl = stepDiv.querySelector(".options");
    for (var i = 0; i < step.options.length; i++) {
      var btn = document.createElement("button");
      btn.className = "option-btn";
      btn.textContent = step.options[i];
      btn.setAttribute("data-index", i);
      btn.setAttribute("data-step", stepIdx);
      btn.addEventListener("click", onClassifyStepClick);
      optionsEl.appendChild(btn);
    }
  }

  function onClassifyStepClick(e) {
    var stepIdx = parseInt(e.currentTarget.getAttribute("data-step"), 10);
    if (answered || classifyStepAnswers.length > stepIdx) return;

    var chosen = parseInt(e.currentTarget.getAttribute("data-index"), 10);
    var ex = exercises[index];
    var step = ex.steps[stepIdx];
    var stepCorrect = chosen === step.correct;

    classifyStepAnswers.push(chosen);

    if (stepIdx === 0) revealSentence(ex);

    var stepDiv = e.currentTarget.closest(".classify-step");
    var buttons = stepDiv.querySelectorAll(".option-btn");

    for (var i = 0; i < buttons.length; i++) {
      buttons[i].classList.add("answered");
      if (i === step.correct) buttons[i].classList.add("correct");
      if (i === chosen && !stepCorrect) buttons[i].classList.add("wrong");
    }

    if (!stepCorrect) {
      answered = true;
      for (var r = stepIdx + 1; r < ex.steps.length; r++) {
        classifyStepAnswers.push(-1);
      }
      finalizeClassify(false);
    } else if (stepIdx < ex.steps.length - 1) {
      setTimeout(function () {
        for (var b = buttons.length - 1; b >= 0; b--) {
          if (parseInt(buttons[b].getAttribute("data-index"), 10) !== step.correct) {
            buttons[b].remove();
          }
        }
        appendClassifyStep(ex, stepIdx + 1);
      }, 400);
    } else {
      answered = true;
      for (var b = buttons.length - 1; b >= 0; b--) {
        if (parseInt(buttons[b].getAttribute("data-index"), 10) !== step.correct) {
          buttons[b].remove();
        }
      }
      finalizeClassify(true);
    }
  }

  function finalizeClassify(correct) {
    var ex = exercises[index];

    if (fixMode) {
      if (correct) {
        var origIdx = fixIndices[index];
        results[origIdx] = true;
        chosenAnswers[origIdx] = classifyStepAnswers.slice();
      }
    } else {
      results.push(correct);
      chosenAnswers.push(classifyStepAnswers.slice());
    }

    var dots = document.querySelectorAll(".progress-dot");
    dots[index].className = "progress-dot " + (correct ? "dot-correct" : "dot-wrong");

    showFeedback(correct, ex.explanation);
  }

  function renderWordBank(ex) {
    var html = '<div class="sentence">' + esc(ex.sentence) + "</div>" +
      renderHintBtn(ex) +
      '<div id="word-bank-steps"></div>' +
      '<div id="feedback"></div>';
    return { html: html, bind: function () {
      bindHintBtn(ex);
      wordBankStepResults = [];
      appendWordBankStep(ex, 0);
    }};
  }

  function appendWordBankStep(ex, stepIdx) {
    var step = ex.steps[stepIdx];
    var scaffold = step.scaffold || 0;
    var pool = step.answer.slice(scaffold).concat(step.distractors || []);
    shuffle(pool);
    wordBankPool = pool;
    wordBankPlaced = [];
    wordBankCurrentStep = stepIdx;

    var container = document.getElementById("word-bank-steps");
    var stepDiv = document.createElement("div");
    stepDiv.className = "word-bank-step";

    var questionDiv = document.createElement("div");
    questionDiv.className = "classify-question";
    questionDiv.textContent = step.question;
    stepDiv.appendChild(questionDiv);

    var answerDiv = document.createElement("div");
    answerDiv.className = "word-bank-answer";
    answerDiv.id = "word-bank-answer";
    for (var s = 0; s < scaffold; s++) {
      var sp = document.createElement("span");
      sp.className = "word-pill word-scaffold";
      sp.textContent = step.answer[s];
      answerDiv.appendChild(sp);
    }
    var hint = document.createElement("span");
    hint.className = "word-bank-hint";
    hint.id = "word-bank-hint";
    hint.textContent = "Tippe die Wörter in der richtigen Reihenfolge.";
    answerDiv.appendChild(hint);
    var period = document.createElement("span");
    period.className = "word-bank-period";
    period.textContent = ".";
    answerDiv.appendChild(period);
    stepDiv.appendChild(answerDiv);

    var poolDiv = document.createElement("div");
    poolDiv.className = "word-bank-pool";
    poolDiv.id = "word-bank-pool";
    for (var p = 0; p < pool.length; p++) {
      var pill = document.createElement("span");
      pill.className = "word-pill";
      pill.textContent = pool[p];
      pill.setAttribute("data-pool-idx", p);
      pill.addEventListener("click", onWordBankTap);
      poolDiv.appendChild(pill);
    }
    stepDiv.appendChild(poolDiv);

    var submitBtn = document.createElement("button");
    submitBtn.className = "submit-btn";
    submitBtn.id = "word-bank-submit";
    submitBtn.textContent = "Prüfen";
    submitBtn.addEventListener("click", onWordBankSubmit);
    stepDiv.appendChild(submitBtn);

    container.appendChild(stepDiv);
  }

  function onWordBankTap(e) {
    if (answered) return;
    if (e.currentTarget.classList.contains("word-used")) return;
    var poolIdx = parseInt(e.currentTarget.getAttribute("data-pool-idx"), 10);
    e.currentTarget.classList.add("word-used");

    var answerDiv = document.getElementById("word-bank-answer");
    var pill = document.createElement("span");
    pill.className = "word-pill word-placed";
    pill.textContent = wordBankPool[poolIdx];
    pill.setAttribute("data-pool-idx", poolIdx);
    pill.addEventListener("click", onWordBankRemove);
    answerDiv.appendChild(pill);

    wordBankPlaced.push(poolIdx);

    var hint = document.getElementById("word-bank-hint");
    if (hint) hint.style.display = "none";
  }

  function onWordBankRemove(e) {
    if (answered) return;
    var poolIdx = parseInt(e.currentTarget.getAttribute("data-pool-idx"), 10);
    e.currentTarget.remove();

    var poolPills = document.querySelectorAll("#word-bank-pool .word-pill");
    for (var i = 0; i < poolPills.length; i++) {
      if (parseInt(poolPills[i].getAttribute("data-pool-idx"), 10) === poolIdx) {
        var target = poolPills[i];
        setTimeout(function () { target.classList.remove("word-used"); }, 60);
        break;
      }
    }

    var pos = wordBankPlaced.indexOf(poolIdx);
    if (pos > -1) wordBankPlaced.splice(pos, 1);

    if (wordBankPlaced.length === 0) {
      var hint = document.getElementById("word-bank-hint");
      if (hint) hint.style.display = "";
    }
  }

  function onWordBankSubmit() {
    if (answered) return;
    answered = true;

    var ex = exercises[index];
    var stepIdx = wordBankCurrentStep;
    var step = ex.steps[stepIdx];
    var scaffold = step.scaffold || 0;
    var expected = step.answer.slice(scaffold);

    var correct = wordBankPlaced.length === expected.length;
    if (correct) {
      for (var i = 0; i < expected.length; i++) {
        if (wordBankPool[wordBankPlaced[i]] !== expected[i]) {
          correct = false;
          break;
        }
      }
    }

    wordBankStepResults.push(correct ? 1 : 0);

    if (stepIdx === 0) revealSentence(ex);

    var answerDiv = document.getElementById("word-bank-answer");
    var poolDiv = document.getElementById("word-bank-pool");
    var submitBtn = document.getElementById("word-bank-submit");
    var hint = document.getElementById("word-bank-hint");
    if (hint) hint.remove();

    if (correct) {
      var pills = answerDiv.querySelectorAll(".word-pill");
      for (var g = 0; g < pills.length; g++) {
        pills[g].classList.add("answered", "word-correct");
      }
      poolDiv.remove();
      submitBtn.remove();
      answerDiv.removeAttribute("id");

      if (stepIdx < ex.steps.length - 1) {
        setTimeout(function () {
          answered = false;
          appendWordBankStep(ex, stepIdx + 1);
        }, 400);
      } else {
        finalizeWordBank(true);
      }
    } else {
      for (var r = stepIdx + 1; r < ex.steps.length; r++) {
        wordBankStepResults.push(-1);
      }
      var placedPills = answerDiv.querySelectorAll(".word-placed");
      for (var m = 0; m < placedPills.length; m++) {
        placedPills[m].classList.add("answered");
        if (m < expected.length && wordBankPool[wordBankPlaced[m]] === expected[m]) {
          placedPills[m].classList.add("word-correct");
        } else {
          placedPills[m].classList.add("word-wrong");
        }
      }
      answerDiv.removeAttribute("id");
      var corrDiv = document.createElement("div");
      corrDiv.className = "word-bank-answer word-bank-correction answered";
      for (var c = 0; c < step.answer.length; c++) {
        var cp = document.createElement("span");
        cp.className = "word-pill answered word-correct";
        cp.textContent = step.answer[c];
        corrDiv.appendChild(cp);
      }
      var cp2 = document.createElement("span");
      cp2.className = "word-bank-period";
      cp2.textContent = ".";
      corrDiv.appendChild(cp2);
      answerDiv.parentNode.insertBefore(corrDiv, answerDiv.nextSibling);
      poolDiv.remove();
      submitBtn.remove();
      finalizeWordBank(false);
    }
  }

  function finalizeWordBank(correct) {
    var ex = exercises[index];

    if (fixMode) {
      if (correct) {
        var origIdx = fixIndices[index];
        results[origIdx] = true;
        chosenAnswers[origIdx] = wordBankStepResults.slice();
      }
    } else {
      results.push(correct);
      chosenAnswers.push(wordBankStepResults.slice());
    }

    var dots = document.querySelectorAll(".progress-dot");
    dots[index].className = "progress-dot " + (correct ? "dot-correct" : "dot-wrong");

    showFeedback(correct, ex.explanation);
  }

  // --- Satzglieder exercise ---

  var SG_COLORS = [
    {bg: '#e3f2fd', border: '#1976d2', text: '#1565c0'},
    {bg: '#fce4ec', border: '#c62828', text: '#b71c1c'},
    {bg: '#e8f5e9', border: '#2e7d32', text: '#1b5e20'},
    {bg: '#fff3e0', border: '#e65100', text: '#bf360c'},
    {bg: '#f3e5f5', border: '#7b1fa2', text: '#6a1b9a'},
    {bg: '#e0f7fa', border: '#00838f', text: '#006064'},
    {bg: '#fff9c4', border: '#f9a825', text: '#f57f17'},
    {bg: '#efebe9', border: '#5d4037', text: '#3e2723'}
  ];

  function sgCategories(ex) {
    return ex.categories || (currentSet && currentSet.categories) || (reviewSet && reviewSet.categories) || [];
  }

  function buildSgBlocks(ex) {
    var words = ex.sentence.split(" ");
    var wordToChunk = [];
    for (var w = 0; w < words.length; w++) wordToChunk.push(-1);
    for (var c = 0; c < ex.chunks.length; c++) {
      for (var j = 0; j < ex.chunks[c].indices.length; j++) {
        wordToChunk[ex.chunks[c].indices[j]] = c;
      }
    }
    var blocks = [];
    var i = 0;
    while (i < words.length) {
      var chunkIdx = wordToChunk[i];
      var blockWords = [words[i]];
      while (i + 1 < words.length && wordToChunk[i + 1] === chunkIdx && chunkIdx !== -1) {
        i++;
        blockWords.push(words[i]);
      }
      blocks.push({chunkIdx: chunkIdx, text: blockWords.join(" ")});
      i++;
    }
    return blocks;
  }

  function renderSatzglieder(ex) {
    var blocks = buildSgBlocks(ex);
    var html = '<div class="sg-sentence" id="sg-sentence">';
    for (var b = 0; b < blocks.length; b++) {
      if (blocks[b].chunkIdx === -1) {
        html += '<span class="sg-word">' + esc(blocks[b].text) + '</span>';
      } else {
        html += '<div class="sg-block" data-chunk="' + blocks[b].chunkIdx + '">' +
          '<span class="sg-pill">' + esc(blocks[b].text) + '</span>' +
          '<span class="sg-label">&nbsp;</span>' +
          '</div>';
      }
    }
    html += '</div>' +
      '<button class="submit-btn" id="sg-submit" disabled>Prüfen</button>' +
      '<div id="feedback"></div>';
    return { html: html, bind: function () {
      satzgliederAnswers = [];
      for (var i = 0; i < ex.chunks.length; i++) satzgliederAnswers.push(-1);
      var pills = document.querySelectorAll('.sg-pill');
      for (var p = 0; p < pills.length; p++) {
        pills[p].addEventListener('click', onSgPillClick);
        pills[p].addEventListener('mouseenter', onSgPillEnter);
        pills[p].addEventListener('mouseleave', onSgPillLeave);
      }
      document.getElementById('sg-submit').addEventListener('click', onSgSubmit);
    }};
  }

  function onSgPillClick(e) {
    if (answered) return;
    e.stopPropagation();
    closeSgPopover();
    var block = e.currentTarget.closest('.sg-block');
    if (!block) return;
    var chunkIdx = parseInt(block.getAttribute('data-chunk'), 10);
    var ex = exercises[index];
    var categories = sgCategories(ex);

    var popover = document.createElement('div');
    popover.className = 'sg-popover';
    popover.id = 'sg-popover';
    for (var i = 0; i < categories.length; i++) {
      var btn = document.createElement('button');
      btn.className = 'sg-cat-btn';
      btn.textContent = categories[i];
      btn.setAttribute('data-cat', i);
      btn.setAttribute('data-chunk', chunkIdx);
      var color = SG_COLORS[i % SG_COLORS.length];
      btn.style.background = color.bg;
      btn.style.borderColor = color.border;
      btn.style.color = color.text;
      if (satzgliederAnswers[chunkIdx] === i) btn.classList.add('sg-cat-active');
      btn.addEventListener('click', onSgCategoryPick);
      popover.appendChild(btn);
    }
    document.body.appendChild(popover);

    var pillRect = e.currentTarget.getBoundingClientRect();
    var popWidth = popover.offsetWidth;
    var popHeight = popover.offsetHeight;
    var left = pillRect.left + pillRect.width / 2 - popWidth / 2;
    var top = pillRect.bottom + window.scrollY + 8;

    if (top + popHeight > window.scrollY + window.innerHeight) {
      top = pillRect.top + window.scrollY - popHeight - 8;
    }
    if (left + popWidth > window.innerWidth - 8) {
      left = window.innerWidth - popWidth - 8;
    }
    if (left < 8) left = 8;

    popover.style.left = left + 'px';
    popover.style.top = top + 'px';
    popover.style.visibility = 'visible';

    setTimeout(function () {
      document.addEventListener('click', closeSgPopoverOutside);
    }, 0);
  }

  function onSgPillEnter(e) {
    if (answered) return;
    var block = e.currentTarget.closest('.sg-block');
    if (!block) return;
    var chunkIdx = block.getAttribute('data-chunk');
    var allBlocks = document.querySelectorAll('.sg-block[data-chunk="' + chunkIdx + '"]');
    for (var i = 0; i < allBlocks.length; i++) allBlocks[i].classList.add('sg-highlight');
  }

  function onSgPillLeave(e) {
    var block = e.currentTarget.closest('.sg-block');
    if (!block) return;
    var chunkIdx = block.getAttribute('data-chunk');
    var allBlocks = document.querySelectorAll('.sg-block[data-chunk="' + chunkIdx + '"]');
    for (var i = 0; i < allBlocks.length; i++) allBlocks[i].classList.remove('sg-highlight');
  }

  function closeSgPopover() {
    var existing = document.getElementById('sg-popover');
    if (existing) existing.remove();
    document.removeEventListener('click', closeSgPopoverOutside);
  }

  function closeSgPopoverOutside(e) {
    if (!e.target.closest('.sg-popover') && !e.target.closest('.sg-pill')) {
      closeSgPopover();
    }
  }

  function onSgCategoryPick(e) {
    e.stopPropagation();
    var catIdx = parseInt(e.currentTarget.getAttribute('data-cat'), 10);
    var chunkIdx = parseInt(e.currentTarget.getAttribute('data-chunk'), 10);
    if (satzgliederAnswers[chunkIdx] === catIdx) {
      satzgliederAnswers[chunkIdx] = -1;
    } else {
      satzgliederAnswers[chunkIdx] = catIdx;
    }
    closeSgPopover();
    updateSgDisplay();
  }

  function updateSgDisplay() {
    var ex = exercises[index];
    var categories = sgCategories(ex);
    var blocks = document.querySelectorAll('.sg-block');
    for (var b = 0; b < blocks.length; b++) {
      var chunkIdx = parseInt(blocks[b].getAttribute('data-chunk'), 10);
      var catIdx = satzgliederAnswers[chunkIdx];
      var pill = blocks[b].querySelector('.sg-pill');
      var label = blocks[b].querySelector('.sg-label');
      if (catIdx >= 0) {
        var color = SG_COLORS[catIdx % SG_COLORS.length];
        pill.style.background = color.bg;
        pill.style.borderColor = color.border;
        label.textContent = categories[catIdx].split(' — ')[0];
        label.style.background = color.border;
        label.style.color = '';
        label.classList.add('sg-label-visible');
      } else {
        pill.style.background = '';
        pill.style.borderColor = '';
        label.innerHTML = '&nbsp;';
        label.style.background = '';
        label.style.color = '';
        label.classList.remove('sg-label-visible');
      }
    }
    var allAssigned = satzgliederAnswers.indexOf(-1) === -1;
    document.getElementById('sg-submit').disabled = !allAssigned;
  }

  function onSgSubmit() {
    if (answered) return;
    answered = true;
    closeSgPopover();
    var ex = exercises[index];
    var categories = sgCategories(ex);
    var correct = true;
    for (var i = 0; i < ex.chunks.length; i++) {
      if (satzgliederAnswers[i] !== categories.indexOf(ex.chunks[i].correct)) {
        correct = false;
        break;
      }
    }
    var blocks = document.querySelectorAll('.sg-block');
    for (var b = 0; b < blocks.length; b++) {
      var chunkIdx = parseInt(blocks[b].getAttribute('data-chunk'), 10);
      var pill = blocks[b].querySelector('.sg-pill');
      var label = blocks[b].querySelector('.sg-label');
      var correctCatIdx = categories.indexOf(ex.chunks[chunkIdx].correct);
      pill.classList.add('answered');
      if (satzgliederAnswers[chunkIdx] === correctCatIdx) {
        var clr = SG_COLORS[correctCatIdx % SG_COLORS.length];
        pill.style.background = clr.bg;
        pill.style.borderColor = clr.border;
        label.textContent = categories[correctCatIdx].split(' — ')[0];
        label.style.background = clr.border;
        label.style.color = '';
      } else {
        pill.style.borderColor = '#c62828';
        pill.style.background = '#ffebee';
        var wrongShort = categories[satzgliederAnswers[chunkIdx]].split(' — ')[0];
        var correctShort = categories[correctCatIdx].split(' — ')[0];
        label.innerHTML = '<s>' + esc(wrongShort) + '</s> → ' + esc(correctShort);
        label.style.background = '#c62828';
        label.style.color = '';
      }
      label.classList.add('sg-label-visible');
    }
    document.getElementById('sg-submit').style.display = 'none';
    finalizeSatzglieder(correct);
  }

  function finalizeSatzglieder(correct) {
    var ex = exercises[index];
    if (fixMode) {
      if (correct) {
        var origIdx = fixIndices[index];
        results[origIdx] = true;
        chosenAnswers[origIdx] = satzgliederAnswers.slice();
      }
    } else {
      results.push(correct);
      chosenAnswers.push(satzgliederAnswers.slice());
    }
    var dots = document.querySelectorAll('.progress-dot');
    dots[index].className = 'progress-dot ' + (correct ? 'dot-correct' : 'dot-wrong');
    showFeedback(correct, ex.explanation);
  }

  // --- Check correctness ---

  function isCorrect(ex, answer) {
    var type = ex.type || (currentSet && currentSet.type) || (reviewSet && reviewSet.type) || "multiple-choice";
    if (type === "word-tap") {
      return isWordTapCorrect(answer, ex);
    }
    if (type === "classify") {
      return isClassifyCorrect(answer, ex);
    }
    if (type === "word-bank") {
      return isWordBankCorrect(answer, ex);
    }
    if (type === "satzglieder") {
      return isSatzgliederCorrect(answer, ex);
    }
    return answer === ex.correct;
  }

  function isWordTapCorrect(answer, exercise) {
    var words, classifyChoice;
    if (answer && typeof answer === "object" && !Array.isArray(answer)) {
      words = answer.words;
      classifyChoice = answer.classify;
    } else {
      words = answer;
      classifyChoice = -1;
    }
    if (!arraysEqual(words, exercise.correct)) return false;
    if (exercise.classify) return classifyChoice === exercise.classify.correct;
    return true;
  }

  function isClassifyCorrect(answer, exercise) {
    if (!Array.isArray(answer)) return false;
    for (var i = 0; i < exercise.steps.length; i++) {
      if (answer[i] !== exercise.steps[i].correct) return false;
    }
    return true;
  }

  function isWordBankCorrect(answer, exercise) {
    if (!Array.isArray(answer)) return false;
    for (var i = 0; i < exercise.steps.length; i++) {
      if (answer[i] !== 1) return false;
    }
    return true;
  }

  function isSatzgliederCorrect(answer, exercise) {
    var categories = (currentSet && currentSet.categories) || (reviewSet && reviewSet.categories) || exercise.categories || [];
    if (!Array.isArray(answer)) return false;
    for (var i = 0; i < exercise.chunks.length; i++) {
      if (answer[i] !== categories.indexOf(exercise.chunks[i].correct)) return false;
    }
    return true;
  }

  // --- Encode / decode answers for share URLs ---

  function encodeAnswer(a) {
    if (a && typeof a === "object" && !Array.isArray(a)) {
      return a.words.join(":") + "+" + a.classify;
    }
    return Array.isArray(a) ? a.join(":") : String(a);
  }

  function decodeAnswer(str, ex) {
    var type = ex.type || (reviewSet && reviewSet.type) || "multiple-choice";
    if (type === "classify" || type === "word-bank" || type === "satzglieder") {
      return str.split(":").map(Number);
    }
    if (type === "word-tap") {
      if (str.indexOf("+") > -1) {
        var pts = str.split("+");
        return {words: pts[0].split(":").map(Number), classify: Number(pts[1])};
      }
      return str.split(":").map(Number);
    }
    return Number(str);
  }

  // --- Render review (shared result navigation) ---

  function renderReviewExercise(ex, chosen) {
    var type = reviewExType(ex);
    if (type === "word-tap") {
      return renderReviewWordTap(ex, chosen);
    }
    if (type === "classify") {
      return renderReviewClassify(ex, chosen);
    }
    if (type === "word-bank") {
      return renderReviewWordBank(ex, chosen);
    }
    if (type === "satzglieder") {
      return renderReviewSatzglieder(ex, chosen);
    }
    return renderReviewMC(ex, chosen);
  }

  function renderReviewMC(ex, chosen) {
    var correct = chosen === ex.correct;
    var html = renderSentence(ex.sentence, ex.reveal, true) +
      '<div class="options" id="options"></div>';
    return { html: html, correct: correct, bind: function () {
      var optionsEl = document.getElementById("options");
      for (var i = 0; i < ex.options.length; i++) {
        var btn = document.createElement("button");
        btn.className = "option-btn answered";
        btn.textContent = ex.options[i];
        if (i === ex.correct) btn.classList.add("correct");
        if (i === chosen && !correct) btn.classList.add("wrong");
        optionsEl.appendChild(btn);
      }
    }};
  }

  function renderReviewWordTap(ex, chosen) {
    var chosenWords = (chosen && typeof chosen === "object" && !Array.isArray(chosen)) ? chosen.words : chosen;
    var chosenClassify = (chosen && typeof chosen === "object" && !Array.isArray(chosen)) ? chosen.classify : -1;
    var correct = isWordTapCorrect(chosen, ex);

    var html = '<div class="words">';
    for (var w = 0; w < ex.words.length; w++) {
      var pillCls = "word-pill answered";
      var isTarget = ex.correct.indexOf(w) > -1;
      var wasSelected = chosenWords.indexOf(w) > -1;
      if (wasSelected && isTarget) pillCls += " word-correct";
      else if (wasSelected && !isTarget) pillCls += " word-wrong";
      else if (!wasSelected && isTarget) pillCls += " word-missed";
      html += '<span class="' + pillCls + '">' + esc(ex.words[w]) + "</span>";
    }
    html += "</div>";

    if (ex.classify) {
      html += '<div class="classify-question">' + esc(ex.classify.question) + "</div>" +
        '<div class="options">';
      for (var c = 0; c < ex.classify.options.length; c++) {
        var optCls = "option-btn answered";
        if (c === ex.classify.correct) optCls += " correct";
        if (c === chosenClassify && chosenClassify !== ex.classify.correct) optCls += " wrong";
        html += '<button class="' + optCls + '">' + esc(ex.classify.options[c]) + "</button>";
      }
      html += "</div>";
    }

    return { html: html, correct: correct, bind: function () {} };
  }

  function renderReviewClassify(ex, chosen) {
    var correct = isClassifyCorrect(chosen, ex);
    var html = renderSentence(ex.sentence, ex.reveal, true);

    for (var s = 0; s < ex.steps.length; s++) {
      var step = ex.steps[s];
      var chosenIdx = Array.isArray(chosen) ? chosen[s] : -1;
      var stepCorrect = chosenIdx === step.correct;
      var unattempted = chosenIdx === -1;

      html += '<div class="classify-question">' + esc(step.question) + "</div>";
      html += '<div class="options">';

      for (var i = 0; i < step.options.length; i++) {
        var cls = "option-btn answered";
        if (!unattempted) {
          if (i === step.correct) cls += " correct";
          if (i === chosenIdx && !stepCorrect) cls += " wrong";
        }
        html += '<button class="' + cls + '">' + esc(step.options[i]) + "</button>";
      }
      html += "</div>";

      if (unattempted) {
        html += '<div class="classify-unattempted">nicht beantwortet</div>';
      }
    }

    return { html: html, correct: correct, bind: function () {} };
  }

  function renderReviewWordBank(ex, chosen) {
    var correct = isWordBankCorrect(chosen, ex);
    var html = renderSentence(ex.sentence, ex.reveal, true);

    for (var s = 0; s < ex.steps.length; s++) {
      var step = ex.steps[s];
      var stepResult = Array.isArray(chosen) ? chosen[s] : -1;
      var stepCorrect = stepResult === 1;
      var unattempted = stepResult === -1;

      html += '<div class="classify-question">' + esc(step.question) + "</div>";
      html += '<div class="word-bank-answer answered">';
      for (var w = 0; w < step.answer.length; w++) {
        var cls = "word-pill answered";
        if (stepCorrect) cls += " word-correct";
        html += '<span class="' + cls + '">' + esc(step.answer[w]) + "</span>";
      }
      html += '<span class="word-bank-period">.</span>';
      html += "</div>";

      if (unattempted) {
        html += '<div class="classify-unattempted">nicht beantwortet</div>';
      }
    }

    return { html: html, correct: correct, bind: function () {} };
  }

  function renderReviewSatzglieder(ex, chosen) {
    var categories = sgCategories(ex);
    var correct = isSatzgliederCorrect(chosen, ex);
    var blocks = buildSgBlocks(ex);
    var html = '<div class="sg-sentence sg-review">';
    for (var b = 0; b < blocks.length; b++) {
      if (blocks[b].chunkIdx === -1) {
        html += '<span class="sg-word">' + esc(blocks[b].text) + '</span>';
      } else {
        var chunkIdx = blocks[b].chunkIdx;
        var correctCatIdx = categories.indexOf(ex.chunks[chunkIdx].correct);
        var chosenCatIdx = Array.isArray(chosen) ? chosen[chunkIdx] : -1;
        var isChunkCorrect = chosenCatIdx === correctCatIdx;
        var color = SG_COLORS[correctCatIdx % SG_COLORS.length];
        var pillStyle = 'background:' + color.bg + ';border-color:' + (isChunkCorrect ? color.border : '#c62828');
        var labelHtml;
        var correctShort = categories[correctCatIdx].split(' — ')[0];
        if (isChunkCorrect) {
          labelHtml = '<span class="sg-label sg-label-visible" style="background:' + color.border + '">' + esc(correctShort) + '</span>';
        } else {
          var wrongShort = chosenCatIdx >= 0 ? categories[chosenCatIdx].split(' — ')[0] : '—';
          labelHtml = '<span class="sg-label sg-label-visible" style="background:#c62828">' +
            '<s>' + esc(wrongShort) + '</s> → ' + esc(correctShort) +
            '</span>';
        }
        html += '<div class="sg-block">' +
          '<span class="sg-pill answered" style="' + pillStyle + '">' + esc(blocks[b].text) + '</span>' +
          labelHtml +
          '</div>';
      }
    }
    html += '</div>';
    return { html: html, correct: correct, bind: function () {} };
  }

  // --- Routing & home ---

  function init() {
    if (location.hash.startsWith("#share/")) {
      showSharedResult();
    } else if (location.hash.startsWith("#set/")) {
      startSetById(decodeURIComponent(location.hash.replace("#set/", "")));
    } else if (location.hash.startsWith("#challenge/")) {
      showChallengeHub(decodeURIComponent(location.hash.replace("#challenge/", "")));
    } else {
      showHome();
    }
  }

  function startSetById(setId) {
    fetch("exercises/index.json")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        sets = data;
        for (var i = 0; i < sets.length; i++) {
          if (sets[i].id === setId) { startSet(i); return; }
        }
        showHome();
      });
  }

  function challengeAllSets(ch) {
    if (ch.stages) {
      var all = [];
      for (var i = 0; i < ch.stages.length; i++) {
        for (var j = 0; j < ch.stages[i].sets.length; j++) {
          all.push(ch.stages[i].sets[j]);
        }
      }
      return all;
    }
    return ch.sets || [];
  }

  function showHome() {
    quizInProgress = false;
    setHeaderTitle(null);
    setHeaderBack(false);
    setHeaderRules(null);
    challengeDef = null;

    Promise.all([
      fetch("exercises/index.json").then(function (r) { return r.json(); }),
      fetch("exercises/challenges.json").then(function (r) {
        return r.ok ? r.json() : null;
      }).catch(function () { return null; })
    ]).then(function (both) {
      sets = both[0];
      var challenges = both[1];

      var html = "";

      if (challenges && challenges.length) {
        for (var ci = 0; ci < challenges.length; ci++) {
          var challenge = challenges[ci];
          if (!challenge || (!challenge.stages && (!challenge.sets || challenge.sets.length === 0))) continue;

          var allSetIds = challengeAllSets(challenge);
          var totalCount = 0;
          for (var c = 0; c < allSetIds.length; c++) {
            for (var s = 0; s < sets.length; s++) {
              if (sets[s].id === allSetIds[c]) { totalCount += sets[s].count; break; }
            }
          }

          var saved = challenge.id ? loadChallengeProgress(challenge.id) : null;
          var completed = isChallengeCompleted(challenge.id);
          var cardCls = "challenge-card";
          var iconHtml = "";
          var progressHtml = "";

          if (completed) {
            cardCls += " challenge-card-completed";
            iconHtml = '<span class="challenge-icon">✓</span>';
            progressHtml = '<div class="challenge-progress">Alle geschafft!</div>';
          } else if (saved && saved.scores) {
            var doneCount = 0;
            for (var dc = 0; dc < saved.scores.length; dc++) {
              if (isSetPassed(saved.scores[dc])) doneCount++;
            }
            if (doneCount > 0) {
              var stagesDone = 0;
              if (challenge.stages) {
                var pos = 0;
                for (var si = 0; si < challenge.stages.length; si++) {
                  var stageDone = true;
                  for (var sj = 0; sj < challenge.stages[si].sets.length; sj++) {
                    if (!isSetPassed(saved.scores[pos])) stageDone = false;
                    pos++;
                  }
                  if (stageDone) stagesDone++;
                }
                progressHtml = '<div class="challenge-progress">' +
                  stagesDone + " von " + challenge.stages.length + " Stufen geschafft — weiter geht's!</div>";
              } else {
                progressHtml = '<div class="challenge-progress">' +
                  doneCount + " von " + allSetIds.length + " geschafft — weiter geht's!</div>";
              }
            }
          }

          html += '<div class="' + cardCls + ' challenge-card-link" data-challenge-id="' + esc(challenge.id) + '">' +
            iconHtml +
            "<h2>" + esc(challenge.name) + "</h2>" +
            "<p>" + (challenge.stages ? challenge.stages.length + " Stufen · " : allSetIds.length + " Übungen · ") + totalCount + " Aufgaben</p>" +
            progressHtml +
            "</div>";
        }
      }

      var groups = [];
      var curGroup = null;
      for (var i = 0; i < sets.length; i++) {
        var cat = sets[i].category || "";
        if (!curGroup || cat !== curGroup.cat) {
          curGroup = { cat: cat, items: [] };
          groups.push(curGroup);
        }
        curGroup.items.push({ set: sets[i], index: i });
      }

      html += '<div class="set-list">';
      for (var g = 0; g < groups.length; g++) {
        var grp = groups[g];
        if (grp.cat) {
          var totalCount = 0;
          for (var c = 0; c < grp.items.length; c++) totalCount += grp.items[c].set.count;
          html += '<div class="set-category-header" data-group="' + g + '">' +
            '<span class="set-category-chevron">&#x25B8;</span>' +
            '<span class="set-category-name">' + esc(grp.cat) + '</span>' +
            '<span class="set-category-count">' + grp.items.length + ' Übungen · ' + totalCount + ' Aufgaben</span>' +
          '</div>';
          html += '<div class="set-category-body collapsed" data-group="' + g + '">';
        }
        for (var k = 0; k < grp.items.length; k++) {
          var s = grp.items[k];
          html +=
            '<div class="set-card" data-index="' + s.index + '">' +
              "<h2>" + esc(s.set.name) + "</h2>" +
              "<p>" + esc(s.set.goal || s.set.description) + "</p>" +
              '<div class="count">' + s.set.count + " Aufgaben</div>" +
            "</div>";
        }
        if (grp.cat) html += '</div>';
      }
      html += "</div>";
      app.innerHTML = html;

      var challengeCards = app.querySelectorAll(".challenge-card-link");
      for (var cc = 0; cc < challengeCards.length; cc++) {
        challengeCards[cc].addEventListener("click", function () {
          location.hash = "#challenge/" + encodeURIComponent(this.getAttribute("data-challenge-id"));
        });
      }

      var headers = app.querySelectorAll(".set-category-header");
      for (var h = 0; h < headers.length; h++) {
        headers[h].addEventListener("click", function () {
          var grpId = this.getAttribute("data-group");
          var body = app.querySelector('.set-category-body[data-group="' + grpId + '"]');
          var isOpen = this.classList.toggle("expanded");
          body.classList.toggle("collapsed", !isOpen);
        });
      }

      var cards = app.querySelectorAll(".set-card");
      for (var j = 0; j < cards.length; j++) {
        cards[j].addEventListener("click", onCardClick);
      }
    });
  }

  function showChallengeHub(challengeId) {
    quizInProgress = false;
    Promise.all([
      fetch("exercises/index.json").then(function (r) { return r.json(); }),
      fetch("exercises/challenges.json").then(function (r) { return r.json(); })
    ]).then(function (both) {
      sets = both[0];
      var challenges = both[1];
      challengeDef = null;
      if (challenges && challenges.length) {
        for (var ci = 0; ci < challenges.length; ci++) {
          if (challenges[ci].id === challengeId) { challengeDef = challenges[ci]; break; }
        }
      }
      if (!challengeDef) { showHome(); return; }

      var allSetIds = challengeAllSets(challengeDef);
      challengeDef.sets = allSetIds;
      inChallengeHub = true;

      var saved = challengeDef.id ? loadChallengeProgress(challengeDef.id) : null;
      challengeScores = [];
      for (var i = 0; i < allSetIds.length; i++) {
        challengeScores.push(saved && saved.scores && saved.scores[i] ? saved.scores[i] : null);
      }
      challengeAttempts = saved && saved.attempts ? saved.attempts : {};

      var nextIdx = -1;
      var doneCount = 0;
      for (var n = 0; n < challengeScores.length; n++) {
        if (isSetPassed(challengeScores[n])) doneCount++;
        else if (nextIdx === -1) nextIdx = n;
      }
      var allDone = doneCount === allSetIds.length;

      setHeaderTitle(challengeDef.name);
      setHeaderBack(false);
      setHeaderRules(null);
      var header = document.querySelector("header");
      var backBtn = document.createElement("button");
      backBtn.className = "header-back";
      backBtn.textContent = "←";
      backBtn.addEventListener("click", function () {
        location.hash = "";
        showHome();
      });
      header.prepend(backBtn);

      var html = "";

      if (allDone) {
        var totalCorrect = 0;
        var totalQuestions = 0;
        for (var t = 0; t < challengeScores.length; t++) {
          totalCorrect += challengeScores[t].correct;
          totalQuestions += challengeScores[t].total;
        }
        html += '<div class="celebration-header">' +
          '<div class="celebration-title">Geschafft!</div>' +
          '<div class="score">' + totalCorrect + " / " + totalQuestions + "</div>" +
          '<div class="score-label">richtig beantwortet</div>' +
          "</div>";
      }

      html += '<div class="challenge-sets">';

      if (challengeDef.stages) {
        var globalIdx = 0;
        for (var si = 0; si < challengeDef.stages.length; si++) {
          var stage = challengeDef.stages[si];
          var stageComplete = true;
          for (var sc = 0; sc < stage.sets.length; sc++) {
            if (!isSetPassed(challengeScores[globalIdx + sc])) stageComplete = false;
          }
          var prevStageComplete = si === 0 ? true : (function () {
            var prevStart = 0;
            for (var ps = 0; ps < si - 1; ps++) prevStart += challengeDef.stages[ps].sets.length;
            var prevEnd = prevStart + challengeDef.stages[si - 1].sets.length;
            for (var pc = prevStart; pc < prevEnd; pc++) {
              if (!isSetPassed(challengeScores[pc])) return false;
            }
            return true;
          })();
          var stageLocked = !prevStageComplete;

          var stageCls = "challenge-stage-header";
          if (stageComplete) stageCls += " challenge-stage-done";
          if (stageLocked) stageCls += " challenge-stage-locked";

          var stageIcon = stageComplete ? "✓" : "";
          html += '<div class="' + stageCls + '">' +
            '<span class="challenge-stage-name">' + esc(stage.name) + "</span>" +
            (stageIcon ? '<span class="challenge-stage-icon">' + stageIcon + "</span>" : "") +
            "</div>";

          for (var sj = 0; sj < stage.sets.length; sj++) {
            var idx = globalIdx + sj;
            var setId = allSetIds[idx];
            var setInfo = null;
            for (var s = 0; s < sets.length; s++) {
              if (sets[s].id === setId) { setInfo = sets[s]; break; }
            }
            if (!setInfo) { globalIdx++; continue; }

            var score = challengeScores[idx];
            var isDone = isSetMastered(score);
            var isAttempted = score && !isDone;
            var isNext = !isDone && !isAttempted && idx === nextIdx && !stageLocked;
            var isLocked = stageLocked || (!isDone && !isAttempted && !isNext);

            var rowCls = "challenge-row";
            if (isDone) rowCls += " challenge-done";
            else if (isAttempted) rowCls += " challenge-attempted";
            if (isNext) rowCls += " challenge-next";
            if (isLocked) rowCls += " challenge-locked";

            var icon = isDone ? "✓" : (isAttempted ? "↻" : (isNext ? "→" : "○"));
            var scoreHtml = (isDone || isAttempted) ? '<span class="challenge-row-score">' + score.correct + "/" + score.total + "</span>" : "";
            var actionHtml = "";
            if (isNext) actionHtml = '<button class="btn-primary challenge-start-btn" data-challenge-idx="' + idx + '">Starten</button>';
            else if (isAttempted) actionHtml = '<button class="btn-primary challenge-start-btn" data-challenge-idx="' + idx + '">Weiter</button>';

            html += '<div class="' + rowCls + '" data-challenge-idx="' + idx + '">' +
              '<span class="challenge-icon">' + icon + "</span>" +
              '<span class="challenge-row-name">' + esc(setInfo.name) + "</span>" +
              scoreHtml +
              actionHtml +
              "</div>";
          }
          globalIdx += stage.sets.length;
        }
      } else {
        for (var i = 0; i < allSetIds.length; i++) {
          var setId = allSetIds[i];
          var setInfo = null;
          for (var s = 0; s < sets.length; s++) {
            if (sets[s].id === setId) { setInfo = sets[s]; break; }
          }
          if (!setInfo) continue;

          var score = challengeScores[i];
          var isDone = isSetMastered(score);
          var isAttempted = score && !isDone;
          var isNext = !isDone && !isAttempted && i === nextIdx;
          var isLocked = !isDone && !isAttempted && !isNext;

          var rowCls = "challenge-row";
          if (isDone) rowCls += " challenge-done";
          else if (isAttempted) rowCls += " challenge-attempted";
          if (isNext) rowCls += " challenge-next";
          if (isLocked) rowCls += " challenge-locked";

          var icon = isDone ? "✓" : (isAttempted ? "↻" : (isNext ? "→" : "○"));
          var scoreHtml = (isDone || isAttempted) ? '<span class="challenge-row-score">' + score.correct + "/" + score.total + "</span>" : "";
          var actionHtml = "";
          if (isNext) actionHtml = '<button class="btn-primary challenge-start-btn" data-challenge-idx="' + i + '">Starten</button>';
          else if (isAttempted) actionHtml = '<button class="btn-primary challenge-start-btn" data-challenge-idx="' + i + '">Weiter</button>';

          html += '<div class="' + rowCls + '" data-challenge-idx="' + i + '">' +
            '<span class="challenge-icon">' + icon + "</span>" +
            '<span class="challenge-row-name">' + esc(setInfo.name) + "</span>" +
            scoreHtml +
            actionHtml +
            "</div>";
        }
      }

      html += "</div>";

      html += '<div class="challenge-hub-actions">' +
        '<div class="challenge-reset" id="btn-challenge-reset">Zurücksetzen</div>' +
        "</div>";

      app.innerHTML = html;

      var startBtns = document.querySelectorAll(".challenge-start-btn");
      for (var sb = 0; sb < startBtns.length; sb++) {
        startBtns[sb].addEventListener("click", function (e) {
          e.stopPropagation();
          var idx = parseInt(e.currentTarget.getAttribute("data-challenge-idx"), 10);
          challengeSetIndex = idx;
          inChallengeHub = false;
          var attempt = challengeAttempts[idx];
          if (attempt) {
            resumeAttempt(idx, attempt);
          } else {
            startSetById(challengeDef.sets[idx]);
          }
        });
      }

      var doneRows = document.querySelectorAll(".challenge-done");
      for (var d = 0; d < doneRows.length; d++) {
        doneRows[d].style.cursor = "pointer";
        doneRows[d].addEventListener("click", function (e) {
          var idx = parseInt(e.currentTarget.getAttribute("data-challenge-idx"), 10);
          challengeSetIndex = idx;
          inChallengeHub = false;
          startSetById(challengeDef.sets[idx]);
        });
      }

      document.getElementById("btn-challenge-reset").addEventListener("click", function () {
        var id = challengeDef.id;
        clearChallengeProgress();
        challengeScores = [];
        challengeAttempts = {};
        showChallengeHub(id);
      });
    });
  }

  function isSetPassed(score) {
    if (!score) return false;
    if (score.passed !== undefined) return score.passed;
    return true;
  }

  function isSetMastered(score) {
    return score && score.correct === score.total;
  }

  function saveChallengeProgress() {
    if (!challengeDef || !challengeDef.id) return;
    try {
      var data = {scores: challengeScores};
      var keys = Object.keys(challengeAttempts);
      if (keys.length > 0) data.attempts = challengeAttempts;
      localStorage.setItem("challenge-" + challengeDef.id, JSON.stringify(data));
    } catch (e) {}
  }

  function loadChallengeProgress(id) {
    try {
      var raw = localStorage.getItem("challenge-" + id);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function clearChallengeProgress() {
    if (!challengeDef || !challengeDef.id) return;
    try {
      localStorage.removeItem("challenge-" + challengeDef.id);
      localStorage.removeItem("challenge-completed-" + challengeDef.id);
    } catch (e) {}
  }

  function isChallengeCompleted(id) {
    try { return localStorage.getItem("challenge-completed-" + id) === "true"; }
    catch (e) { return false; }
  }

  function onCardClick(e) {
    var card = e.currentTarget;
    var idx = parseInt(card.getAttribute("data-index"), 10);
    location.hash = "#set/" + encodeURIComponent(sets[idx].id);
  }

  // --- Quiz flow ---

  function startSet(idx) {
    var set = sets[idx];
    fetch("exercises/" + set.file)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        currentSet = data;
        initQuiz(data);
        setHeaderTitle(data.name);
        setHeaderBack(true);
        setHeaderRules(data.rules);
        showQuestion();
      });
  }

  function resumeAttempt(setIdx, attempt) {
    var setId = challengeDef.sets[setIdx];
    var setInfo = null;
    for (var s = 0; s < sets.length; s++) {
      if (sets[s].id === setId) { setInfo = sets[s]; break; }
    }
    if (!setInfo) return;
    fetch("exercises/" + setInfo.file)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        currentSet = data;
        results = attempt.results.slice();
        exerciseOrder = attempt.exerciseOrder.slice();
        chosenAnswers = [];
        exercises = [];
        for (var j = 0; j < exerciseOrder.length; j++) {
          exercises.push(data.exercises[exerciseOrder[j]]);
        }
        fixMode = false;
        fixIndices = [];
        setHeaderTitle(data.name);
        setHeaderBack(true);
        setHeaderRules(data.rules);
        showSummary(true);
      });
  }

  function initQuiz(data) {
    exerciseOrder = [];
    for (var i = 0; i < data.exercises.length; i++) {
      exerciseOrder.push(i);
    }
    shuffle(exerciseOrder);
    exercises = [];
    for (var j = 0; j < exerciseOrder.length; j++) {
      exercises.push(data.exercises[exerciseOrder[j]]);
    }
    index = 0;
    results = [];
    chosenAnswers = [];
    answered = false;
    fixMode = false;
    fixIndices = [];
  }

  function showQuestion() {
    quizInProgress = true;
    if (index === 0 && !fixMode) quizHash = location.hash;
    var ex = exercises[index];
    var total = exercises.length;
    var question = ex.question || currentSet.question || "";

    var dotsResults;
    if (fixMode) {
      dotsResults = [];
      for (var d = 0; d < index; d++) {
        dotsResults.push(results[fixIndices[d]]);
      }
    } else {
      dotsResults = results;
    }

    var rendered = renderExercise(ex);
    app.innerHTML = renderProgressDots(total, dotsResults, index) +
      (question ? '<div class="question-label">' + esc(question) + "</div>" : "") +
      rendered.html;
    rendered.bind();
  }

  function onOptionClick(e) {
    if (answered) return;
    answered = true;

    var chosen = parseInt(e.currentTarget.getAttribute("data-index"), 10);
    var ex = exercises[index];
    var correct = chosen === ex.correct;

    if (fixMode) {
      var origIdx = fixIndices[index];
      if (correct) {
        results[origIdx] = true;
        chosenAnswers[origIdx] = chosen;
      }
    } else {
      results.push(correct);
      chosenAnswers.push(chosen);
    }

    var dots = document.querySelectorAll(".progress-dot");
    dots[index].className = "progress-dot " + (correct ? "dot-correct" : "dot-wrong");

    var buttons = document.querySelectorAll(".option-btn");
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].classList.add("answered");
      if (i === ex.correct) buttons[i].classList.add("correct");
      if (i === chosen && !correct) buttons[i].classList.add("wrong");
    }

    if (correct) {
      for (var j = buttons.length - 1; j >= 0; j--) {
        if (j !== ex.correct) buttons[j].remove();
      }
    }

    revealSentence(ex);
    showFeedback(correct, ex.explanation);
  }

  function onWordTap(e) {
    if (answered) return;
    var idx = parseInt(e.currentTarget.getAttribute("data-idx"), 10);
    var pos = selectedWords.indexOf(idx);
    if (pos > -1) {
      selectedWords.splice(pos, 1);
      e.currentTarget.classList.remove("selected");
    } else {
      selectedWords.push(idx);
      e.currentTarget.classList.add("selected");
    }
  }

  function onWordTapSubmit() {
    if (answered) return;
    answered = true;

    var ex = exercises[index];
    var wordsCorrect = arraysEqual(selectedWords, ex.correct);

    var pills = document.querySelectorAll(".word-pill");
    for (var i = 0; i < pills.length; i++) {
      pills[i].classList.add("answered");
      var idx = parseInt(pills[i].getAttribute("data-idx"), 10);
      var isTarget = ex.correct.indexOf(idx) > -1;
      var wasSelected = selectedWords.indexOf(idx) > -1;
      if (wasSelected && isTarget) pills[i].classList.add("word-correct");
      else if (wasSelected && !isTarget) pills[i].classList.add("word-wrong");
      else if (!wasSelected && isTarget) pills[i].classList.add("word-missed");
    }

    document.getElementById("submit-btn").style.display = "none";

    if (wordsCorrect && ex.classify) {
      var feedback = document.getElementById("feedback");
      feedback.innerHTML =
        '<div class="explanation explanation-correct">' +
          "<strong>" + randomPraise() + "</strong>" +
        "</div>" +
        '<div class="classify-question">' + esc(ex.classify.question) + "</div>" +
        '<div class="options" id="classify-options"></div>';

      var optionsEl = document.getElementById("classify-options");
      for (var c = 0; c < ex.classify.options.length; c++) {
        var btn = document.createElement("button");
        btn.className = "option-btn";
        btn.textContent = ex.classify.options[c];
        btn.setAttribute("data-index", c);
        btn.addEventListener("click", onClassifyClick);
        optionsEl.appendChild(btn);
      }
    } else {
      finalizeWordTap(wordsCorrect, -1);
    }
  }

  function onClassifyClick(e) {
    var chosen = parseInt(e.currentTarget.getAttribute("data-index"), 10);
    var ex = exercises[index];
    var classifyCorrect = chosen === ex.classify.correct;

    var buttons = document.querySelectorAll("#classify-options .option-btn");
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].classList.add("answered");
      if (i === ex.classify.correct) buttons[i].classList.add("correct");
      if (i === chosen && !classifyCorrect) buttons[i].classList.add("wrong");
    }

    finalizeWordTap(classifyCorrect, chosen);
  }

  function finalizeWordTap(correct, classifyChoice) {
    if (correct) playCorrectSound(); else playWrongSound();
    var ex = exercises[index];

    if (fixMode) {
      if (correct) {
        var origIdx = fixIndices[index];
        results[origIdx] = true;
        if (ex.classify) {
          chosenAnswers[origIdx] = {words: selectedWords.slice(), classify: classifyChoice};
        } else {
          chosenAnswers[origIdx] = selectedWords.slice();
        }
      }
    } else {
      results.push(correct);
      if (ex.classify) {
        chosenAnswers.push({words: selectedWords.slice(), classify: classifyChoice});
      } else {
        chosenAnswers.push(selectedWords.slice());
      }
    }

    var dots = document.querySelectorAll(".progress-dot");
    dots[index].className = "progress-dot " + (correct ? "dot-correct" : "dot-wrong");

    var isLast = index >= exercises.length - 1;
    var explanationHtml =
      '<div class="explanation ' + (correct ? "explanation-correct" : "explanation-wrong") + '">' +
        "<strong>" + (correct ? randomPraise() : randomEncourage()) + "</strong>" +
        marked.parse(ex.explanation) +
      "</div>" +
      '<button class="next-btn" id="next-btn">' +
        (isLast ? "Ergebnis anzeigen" : "Weiter") +
      "</button>";

    var feedback = document.getElementById("feedback");
    if (classifyChoice >= 0) {
      feedback.innerHTML += explanationHtml;
    } else {
      feedback.innerHTML = explanationHtml;
    }

    document.getElementById("next-btn").addEventListener("click", nextQuestion);
  }

  function showFeedback(correct, explanation) {
    if (correct) playCorrectSound(); else playWrongSound();
    var isLast = index >= exercises.length - 1;
    var feedback = document.getElementById("feedback");
    feedback.innerHTML =
      '<div class="explanation ' + (correct ? "explanation-correct" : "explanation-wrong") + '">' +
        "<strong>" + (correct ? randomPraise() : randomEncourage()) + "</strong>" +
        marked.parse(explanation) +
      "</div>" +
      '<button class="next-btn" id="next-btn">' +
        (isLast ? "Ergebnis anzeigen" : "Weiter") +
      "</button>";

    document.getElementById("next-btn").addEventListener("click", nextQuestion);
  }

  function nextQuestion() {
    index++;
    answered = false;
    if (index >= exercises.length) {
      if (fixMode) {
        fixMode = false;
        fixIndices = [];
        exercises = [];
        for (var j = 0; j < exerciseOrder.length; j++) {
          exercises.push(currentSet.exercises[exerciseOrder[j]]);
        }
        index = 0;
      }
      showSummary();
    } else {
      showQuestion();
    }
  }

  function startFixMode() {
    var wrongOriginalIndices = [];
    for (var i = 0; i < results.length; i++) {
      if (!results[i]) wrongOriginalIndices.push(i);
    }
    if (wrongOriginalIndices.length === 0) return;

    fixMode = true;
    fixIndices = wrongOriginalIndices;
    exercises = [];
    for (var j = 0; j < wrongOriginalIndices.length; j++) {
      var origIdx = wrongOriginalIndices[j];
      exercises.push(currentSet.exercises[exerciseOrder[origIdx]]);
    }
    index = 0;
    answered = false;
    setHeaderTitle(currentSet.name);
    setHeaderBack(true);
    showQuestion();
  }

  // --- Summary & sharing ---

  function renderProgressDots(total, resultsArr, currentIdx) {
    var html = '<div class="progress-dots">';
    for (var p = 0; p < total; p++) {
      var cls = "progress-dot";
      if (p < resultsArr.length) {
        cls += resultsArr[p] ? " dot-correct" : " dot-wrong";
      } else if (p === currentIdx) {
        cls += " dot-current";
      }
      html += '<div class="' + cls + '"></div>';
    }
    html += "</div>";
    return html;
  }

  function showSummary(skipCelebration) {
    quizInProgress = false;
    setHeaderTitle(null);
    setHeaderBack(false);
    setHeaderRules(null);
    var correctCount = 0;
    for (var i = 0; i < results.length; i++) {
      if (results[i]) correctCount++;
    }
    var total = results.length;

    var hasWrongs = correctCount < total;
    var actionsHtml = "";
    if (hasWrongs) {
      actionsHtml += '<button class="btn-primary" id="btn-fix">Fehler korrigieren</button>';
    }
    actionsHtml +=
      '<button class="btn-primary" id="btn-retry">Nochmal</button>' +
      '<button class="btn-share" id="btn-share">Ergebnis teilen</button>';

    if (challengeDef) {
      var passed = correctCount === total;
      challengeScores[challengeSetIndex] = {name: currentSet.name, correct: correctCount, total: total, passed: passed};
      if (passed) {
        delete challengeAttempts[challengeSetIndex];
      } else {
        challengeAttempts[challengeSetIndex] = {results: results.slice(), exerciseOrder: exerciseOrder.slice()};
      }
      saveChallengeProgress();
      var allChallengeDone = true;
      for (var cd = 0; cd < challengeScores.length; cd++) {
        if (!isSetPassed(challengeScores[cd])) { allChallengeDone = false; break; }
      }
      if (allChallengeDone && challengeDef.id) {
        try { localStorage.setItem("challenge-completed-" + challengeDef.id, "true"); } catch (e) {}
      }
      actionsHtml += '<button class="btn-primary" id="btn-to-hub">Zur Übersicht</button>';
    } else {
      actionsHtml += '<button class="btn-secondary" id="btn-back">Zurück</button>';
    }

    var ratio = correctCount / total;
    var wrongCount = total - correctCount;
    var summaryMsg = "";
    var summaryCls = "summary";

    if (ratio === 1) {
      summaryMsg = '<div class="summary-message summary-perfect">Perfekt! Alles richtig!</div>';
      summaryCls += " summary-celebrate";
    } else if (wrongCount === 1) {
      summaryMsg = '<div class="summary-message summary-almost">So nah dran! Nur 1 Fehler!</div>';
      summaryCls += " summary-celebrate";
    } else if (ratio >= 0.8) {
      summaryMsg = '<div class="summary-message summary-great">Stark! Fast alles richtig!</div>';
      summaryCls += " summary-celebrate";
    } else if (ratio >= 0.5) {
      summaryMsg = '<div class="summary-message summary-ok">Guter Anfang — weiter üben!</div>';
    } else {
      summaryMsg = '<div class="summary-message summary-try">Übung macht den Meister!</div>';
    }

    app.innerHTML =
      '<div class="' + summaryCls + '">' +
        renderProgressDots(total, results, -1) +
        summaryMsg +
        '<div class="score">' + correctCount + " / " + total + "</div>" +
        '<div class="score-label">richtig beantwortet</div>' +
        '<div class="summary-actions">' +
          actionsHtml +
        "</div>" +
      "</div>";

    if (!skipCelebration) {
      stopCelebration();
      if (ratio === 1) {
        playFanfare();
        celebrateMassiveFireworks();
      } else if (wrongCount === 1) {
        playJingle();
        celebrateFireworks();
      } else if (ratio >= 0.8) {
        celebrateConfetti();
      }
    }

    var fixBtn = document.getElementById("btn-fix");
    if (fixBtn) {
      fixBtn.addEventListener("click", function () {
        stopCelebration();
        startFixMode();
      });
    }
    document.getElementById("btn-retry").addEventListener("click", function () {
      stopCelebration();
      retrySet();
    });
    document.getElementById("btn-share").addEventListener("click", function () {
      shareResult(correctCount, total);
    });

    var hubBtn = document.getElementById("btn-to-hub");
    if (hubBtn) {
      hubBtn.addEventListener("click", function () {
        stopCelebration();
        advanceChallenge();
      });
    }

    var backBtn = document.getElementById("btn-back");
    if (backBtn) {
      backBtn.addEventListener("click", function () {
        stopCelebration();
        location.hash = "";
        showHome();
      });
    }
  }

  function retrySet() {
    var wrongPairs = [];
    for (var i = 0; i < results.length; i++) {
      if (!results[i]) wrongPairs.push({resultIdx: i, exerciseIdx: exerciseOrder[i]});
    }
    if (wrongPairs.length === 0) {
      initQuiz(currentSet);
    } else {
      shuffle(wrongPairs);
      fixMode = true;
      fixIndices = [];
      exercises = [];
      for (var j = 0; j < wrongPairs.length; j++) {
        fixIndices.push(wrongPairs[j].resultIdx);
        exercises.push(currentSet.exercises[wrongPairs[j].exerciseIdx]);
      }
      index = 0;
      answered = false;
    }
    setHeaderTitle(currentSet.name);
    setHeaderBack(true);
    showQuestion();
  }

  function advanceChallenge() {
    showChallengeHub(challengeDef.id);
  }

  function shareResult(correctCount, total) {
    var encodedAnswers = chosenAnswers.map(encodeAnswer).join(",");
    var payload = exerciseOrder.join(",") + "|" + encodedAnswers;
    var encoded = btoa(payload);
    var url =
      location.origin + location.pathname +
      "#share/" + encodeURIComponent(currentSet.id) + "/" + encoded;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(function () {
        showToast("Link kopiert!");
      });
    }
  }

  // --- Shared result & review mode ---

  function showSharedResult() {
    var parts = location.hash.replace("#share/", "").split("/");
    var setId = decodeURIComponent(parts[0]);
    var encoded = parts[1];

    fetch("exercises/index.json")
      .then(function (r) { return r.json(); })
      .then(function (manifest) {
        var entry = null;
        for (var i = 0; i < manifest.length; i++) {
          if (manifest[i].id === setId) { entry = manifest[i]; break; }
        }
        if (!entry) {
          showHome();
          return;
        }
        return fetch("exercises/" + entry.file)
          .then(function (r) { return r.json(); })
          .then(function (data) {
            var decoded = atob(encoded);
            var halves = decoded.split("|");
            var order = halves[0].split(",").map(Number);
            var answerStrs = halves[1].split(",");

            reviewSet = data;
            reviewExercises = [];
            for (var j = 0; j < order.length; j++) {
              reviewExercises.push(data.exercises[order[j]]);
            }

            reviewAnswers = [];
            for (var a = 0; a < answerStrs.length; a++) {
              reviewAnswers.push(decodeAnswer(answerStrs[a], reviewExercises[a]));
            }

            var reviewResults = [];
            for (var k = 0; k < reviewExercises.length; k++) {
              reviewResults.push(isCorrect(reviewExercises[k], reviewAnswers[k]));
            }

            var correctCount = 0;
            for (var m = 0; m < reviewResults.length; m++) {
              if (reviewResults[m]) correctCount++;
            }

            setHeaderTitle(null);
            setHeaderBack(false);
            setHeaderRules(null);
            app.innerHTML =
              '<div class="summary">' +
                renderProgressDots(reviewResults.length, reviewResults, -1) +
                '<div class="set-name">' + esc(data.name) + "</div>" +
                '<div class="score">' + correctCount + " / " + reviewResults.length + "</div>" +
                '<div class="score-label">richtig beantwortet</div>' +
                '<div class="summary-actions">' +
                  '<button class="btn-primary" id="btn-review">Antworten ansehen</button>' +
                  '<button class="btn-share" id="btn-try">Selbst üben</button>' +
                  '<button class="btn-secondary" id="btn-home">Zurück</button>' +
                "</div>" +
              "</div>";

            document.getElementById("btn-review").addEventListener("click", function () {
              reviewIndex = 0;
              showReviewQuestion();
            });
            document.getElementById("btn-try").addEventListener("click", function () {
              location.hash = "#set/" + encodeURIComponent(setId);
            });
            document.getElementById("btn-home").addEventListener("click", function () {
              location.hash = "";
              showHome();
            });
          });
      })
      .catch(function (err) {
        console.error("Share decode error:", err);
        app.innerHTML = '<p style="padding:2rem;color:#c62828;">Fehler beim Laden: ' + esc(String(err)) + '</p>';
      });
  }

  function showReviewQuestion() {
    setHeaderTitle(reviewSet.name);
    setHeaderBack(true);
    var ex = reviewExercises[reviewIndex];
    var chosen = reviewAnswers[reviewIndex];
    var total = reviewExercises.length;

    var reviewResults = [];
    for (var k = 0; k < total; k++) {
      reviewResults.push(isCorrect(reviewExercises[k], reviewAnswers[k]));
    }

    var dotsHtml = '<div class="progress-dots">';
    for (var p = 0; p < total; p++) {
      var cls = "progress-dot" +
        (reviewResults[p] ? " dot-correct" : " dot-wrong") +
        (p === reviewIndex ? " dot-active" : "");
      dotsHtml += '<div class="' + cls + '" data-review-idx="' + p + '"></div>';
    }
    dotsHtml += "</div>";

    var question = ex.question || reviewSet.question || "";
    var rendered = renderReviewExercise(ex, chosen);

    app.innerHTML = dotsHtml +
      (question ? '<div class="question-label">' + esc(question) + "</div>" : "") +
      rendered.html +
      '<div class="explanation ' + (rendered.correct ? "explanation-correct" : "explanation-wrong") + '">' +
        "<strong>" + (rendered.correct ? randomPraise() : randomEncourage()) + "</strong>" +
        marked.parse(ex.explanation) +
      "</div>" +
      '<div class="review-nav" id="review-nav"></div>';

    rendered.bind();

    var navEl = document.getElementById("review-nav");
    if (reviewIndex > 0) {
      var prevBtn = document.createElement("button");
      prevBtn.className = "btn-secondary";
      prevBtn.textContent = "Vorherige";
      prevBtn.addEventListener("click", function () {
        reviewIndex--;
        showReviewQuestion();
      });
      navEl.appendChild(prevBtn);
    }
    if (reviewIndex < total - 1) {
      var nextBtn = document.createElement("button");
      nextBtn.className = "btn-primary";
      nextBtn.textContent = "Nächste";
      nextBtn.addEventListener("click", function () {
        reviewIndex++;
        showReviewQuestion();
      });
      navEl.appendChild(nextBtn);
    }

    var dots = document.querySelectorAll("[data-review-idx]");
    for (var d = 0; d < dots.length; d++) {
      dots[d].style.cursor = "pointer";
      dots[d].addEventListener("click", onReviewDotClick);
    }
  }

  function onReviewDotClick(e) {
    reviewIndex = parseInt(e.currentTarget.getAttribute("data-review-idx"), 10);
    showReviewQuestion();
  }

  // --- Shared utilities ---

  function setHeaderTitle(title) {
    document.querySelector("header h1").textContent = title || "Deutschinator 3000";
  }

  function setHeaderBack(show) {
    var header = document.querySelector("header");
    var existing = header.querySelector(".header-back");
    if (existing) existing.remove();
    if (show) {
      var btn = document.createElement("button");
      btn.className = "header-back";
      btn.textContent = "←";
      btn.addEventListener("click", function () {
        if (reviewSet) {
          showSharedResult();
          return;
        }
        function doNavigate() {
          if (challengeDef && !inChallengeHub) {
            showChallengeHub(challengeDef.id);
          } else {
            location.hash = "";
            showHome();
          }
        }
        if (isQuizActive()) {
          showConfirmLeave(doNavigate);
        } else {
          doNavigate();
        }
      });
      header.prepend(btn);
    }
  }

  function setHeaderRules(rules) {
    var header = document.querySelector("header");
    var existing = header.querySelector(".header-rules");
    if (existing) existing.remove();
    if (rules && rules.length) {
      var btn = document.createElement("button");
      btn.className = "header-rules";
      btn.innerHTML = "&#x1F4D6;";
      btn.addEventListener("click", showRulesModal);
      header.appendChild(btn);
    }
  }

  function showRulesModal() {
    var rules = currentSet && currentSet.rules;
    if (!rules || !rules.length) return;

    var overlay = document.createElement("div");
    overlay.className = "rules-overlay";
    overlay.id = "rules-overlay";

    var modal = document.createElement("div");
    modal.className = "rules-modal";

    var closeBtn = document.createElement("button");
    closeBtn.className = "rules-close";
    closeBtn.innerHTML = "&times;";
    closeBtn.addEventListener("click", hideRulesModal);

    var content = document.createElement("div");
    content.className = "rules-content";
    content.innerHTML = "<p>Laden…</p>";

    modal.appendChild(closeBtn);
    modal.appendChild(content);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) hideRulesModal();
    });
    document.addEventListener("keydown", onRulesEscape);

    var fetches = [];
    for (var i = 0; i < rules.length; i++) {
      fetches.push(fetchRule(rules[i]));
    }
    Promise.all(fetches).then(function (texts) {
      content.innerHTML = marked.parse(texts.join("\n\n---\n\n"));
    });
  }

  function fetchRule(id) {
    if (rulesCache[id]) return Promise.resolve(rulesCache[id]);
    return fetch("rules/" + id + ".md")
      .then(function (r) { return r.text(); })
      .then(function (text) {
        rulesCache[id] = text;
        return text;
      });
  }

  function hideRulesModal() {
    var overlay = document.getElementById("rules-overlay");
    if (overlay) overlay.remove();
    document.removeEventListener("keydown", onRulesEscape);
  }

  function onRulesEscape(e) {
    if (e.key === "Escape") hideRulesModal();
  }

  function isQuizActive() {
    return quizInProgress && (answered || index > 0);
  }

  function showConfirmLeave(onConfirm) {
    var existing = document.getElementById("confirm-overlay");
    if (existing) existing.remove();

    var answeredCount = answered ? index + 1 : index;

    var overlay = document.createElement("div");
    overlay.className = "rules-overlay";
    overlay.id = "confirm-overlay";

    var modal = document.createElement("div");
    modal.className = "confirm-modal";
    modal.innerHTML =
      "<p>Du hast " + answeredCount + " von " + exercises.length + " Fragen beantwortet.<br>Wirklich abbrechen?</p>" +
      '<div class="confirm-actions">' +
        '<button class="btn-primary" id="confirm-stay">Weitermachen</button>' +
        '<button class="btn-secondary" id="confirm-leave">Abbrechen</button>' +
      "</div>";

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    document.getElementById("confirm-stay").addEventListener("click", function () {
      overlay.remove();
    });
    document.getElementById("confirm-leave").addEventListener("click", function () {
      overlay.remove();
      quizInProgress = false;
      onConfirm();
    });
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) overlay.remove();
    });
  }

  function showToast(msg) {
    var el = document.createElement("div");
    el.className = "toast";
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 2200);
  }

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function arraysEqual(a, b) {
    var sa = a.slice().sort(function (x, y) { return x - y; });
    var sb = b.slice().sort(function (x, y) { return x - y; });
    if (sa.length !== sb.length) return false;
    for (var i = 0; i < sa.length; i++) {
      if (sa[i] !== sb[i]) return false;
    }
    return true;
  }

  var PRAISE = ["Richtig!", "Super!", "Genau!", "Sehr gut!", "Perfekt!"];
  var ENCOURAGE = ["Knapp daneben!", "Fast!", "Nicht ganz.", "Schau mal:"];
  function randomPraise() {
    return PRAISE[Math.floor(Math.random() * PRAISE.length)];
  }
  function randomEncourage() {
    return ENCOURAGE[Math.floor(Math.random() * ENCOURAGE.length)];
  }

  var audioCtx = null;
  function getAudioCtx() {
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { return null; }
    }
    return audioCtx;
  }

  function playTone(freq, duration, type) {
    var ctx = getAudioCtx();
    if (!ctx) return;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = type || "sine";
    osc.frequency.value = freq;
    gain.gain.value = 0.12;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  }

  function playCorrectSound() {
    playTone(523, 0.1, "sine");
    setTimeout(function () { playTone(659, 0.15, "sine"); }, 80);
  }

  function playWrongSound() {
    playTone(311, 0.2, "triangle");
  }

  function playJingle() {
    var notes = [523, 659, 784];
    for (var i = 0; i < notes.length; i++) {
      (function (n, d) {
        setTimeout(function () { playTone(n, 0.15, "sine"); }, d);
      })(notes[i], i * 100);
    }
  }

  function playFanfare() {
    var notes = [392, 523, 659, 784, 1047];
    for (var i = 0; i < notes.length; i++) {
      (function (n, d) {
        setTimeout(function () { playTone(n, 0.25, "sine"); }, d);
      })(notes[i], i * 120);
    }
  }

  var fireworksInterval = null;

  function stopCelebration() {
    if (fireworksInterval) {
      clearInterval(fireworksInterval);
      fireworksInterval = null;
    }
  }

  function celebrateConfetti() {
    if (typeof confetti !== "function") return;
    confetti({ particleCount: 40, spread: 55, origin: { y: 0.7 } });
  }

  function celebrateFireworks() {
    if (typeof confetti !== "function") return;
    confetti({ particleCount: 60, spread: 70, origin: { x: 0.3, y: 0.6 } });
    setTimeout(function () {
      confetti({ particleCount: 60, spread: 70, origin: { x: 0.7, y: 0.5 } });
    }, 300);
    setTimeout(function () {
      confetti({ particleCount: 40, spread: 90, origin: { x: 0.5, y: 0.4 } });
    }, 600);
  }

  function celebrateMassiveFireworks() {
    if (typeof confetti !== "function") return;
    function burst() {
      confetti({
        particleCount: 80,
        spread: 100,
        origin: { x: Math.random() * 0.6 + 0.2, y: Math.random() * 0.4 + 0.3 }
      });
    }
    burst();
    setTimeout(burst, 200);
    setTimeout(burst, 500);
    fireworksInterval = setInterval(function () {
      burst();
      setTimeout(burst, 200 + Math.random() * 300);
    }, 1200);
  }

  function esc(str) {
    var d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  window.addEventListener("hashchange", function () {
    if (isQuizActive()) {
      var targetHash = location.hash;
      history.replaceState(null, "", quizHash);
      showConfirmLeave(function () {
        location.hash = targetHash;
      });
      return;
    }
    stopCelebration();
    reviewSet = null;
    if (!location.hash || location.hash === "#") {
      showHome();
    } else if (location.hash.startsWith("#share/")) {
      showSharedResult();
    } else if (location.hash.startsWith("#set/")) {
      startSetById(decodeURIComponent(location.hash.replace("#set/", "")));
    } else if (location.hash.startsWith("#challenge/")) {
      showChallengeHub(decodeURIComponent(location.hash.replace("#challenge/", "")));
    }
  });

  if (location.search.indexOf("debug") > -1) {
    var panel = document.createElement("div");
    panel.className = "debug-panel";
    panel.innerHTML =
      "<strong>Debug</strong>" +
      '<button data-action="confetti">Confetti (≥80%)</button>' +
      '<button data-action="fireworks">Fireworks (1 error)</button>' +
      '<button data-action="massive">Massive (100%)</button>' +
      '<button data-action="stop">Stop</button>' +
      '<button data-action="jingle">Jingle</button>' +
      '<button data-action="fanfare">Fanfare</button>' +
      '<button data-action="correct">Correct ♪</button>' +
      '<button data-action="wrong">Wrong ♪</button>';
    document.body.appendChild(panel);
    panel.addEventListener("click", function (e) {
      var action = e.target.getAttribute("data-action");
      if (action === "confetti") celebrateConfetti();
      if (action === "fireworks") celebrateFireworks();
      if (action === "massive") celebrateMassiveFireworks();
      if (action === "stop") stopCelebration();
      if (action === "jingle") playJingle();
      if (action === "fanfare") playFanfare();
      if (action === "correct") playCorrectSound();
      if (action === "wrong") playWrongSound();
    });
  }

  init();
})();
