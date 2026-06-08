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
  var wordBankCurrentStep = 0;

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
    return renderMC(ex);
  }

  function renderMC(ex) {
    var html = '<div class="sentence">' + esc(ex.sentence) + "</div>" +
      '<div class="options" id="options"></div>' +
      '<div id="feedback"></div>';
    return { html: html, bind: function () {
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
      '<div id="classify-steps"></div>' +
      '<div id="feedback"></div>';
    return { html: html, bind: function () {
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
    results.push(correct);
    chosenAnswers.push(classifyStepAnswers.slice());

    var dots = document.querySelectorAll(".progress-dot");
    dots[index].className = "progress-dot " + (correct ? "dot-correct" : "dot-wrong");

    showFeedback(correct, ex.explanation);
  }

  function renderWordBank(ex) {
    var html = '<div class="sentence">' + esc(ex.sentence) + "</div>" +
      '<div id="word-bank-steps"></div>' +
      '<div id="feedback"></div>';
    return { html: html, bind: function () {
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
        poolPills[i].classList.remove("word-used");
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
      answerDiv.innerHTML = "";
      answerDiv.classList.add("answered");
      for (var c = 0; c < step.answer.length; c++) {
        var cp = document.createElement("span");
        cp.className = "word-pill answered word-correct";
        cp.textContent = step.answer[c];
        answerDiv.appendChild(cp);
      }
      var cp2 = document.createElement("span");
      cp2.className = "word-bank-period";
      cp2.textContent = ".";
      answerDiv.appendChild(cp2);
      poolDiv.remove();
      submitBtn.remove();
      finalizeWordBank(false);
    }
  }

  function finalizeWordBank(correct) {
    var ex = exercises[index];
    results.push(correct);
    chosenAnswers.push(wordBankStepResults.slice());

    var dots = document.querySelectorAll(".progress-dot");
    dots[index].className = "progress-dot " + (correct ? "dot-correct" : "dot-wrong");

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

  // --- Encode / decode answers for share URLs ---

  function encodeAnswer(a) {
    if (a && typeof a === "object" && !Array.isArray(a)) {
      return a.words.join(":") + "+" + a.classify;
    }
    return Array.isArray(a) ? a.join(":") : String(a);
  }

  function decodeAnswer(str, ex) {
    var type = ex.type || (reviewSet && reviewSet.type) || "multiple-choice";
    if (type === "classify" || type === "word-bank") {
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
    return renderReviewMC(ex, chosen);
  }

  function renderReviewMC(ex, chosen) {
    var correct = chosen === ex.correct;
    var html = '<div class="sentence">' + esc(ex.sentence) + "</div>" +
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
    var html = '<div class="sentence">' + esc(ex.sentence) + "</div>";

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
    var html = '<div class="sentence">' + esc(ex.sentence) + "</div>";

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

  // --- Routing & home ---

  function init() {
    if (location.hash.startsWith("#share/")) {
      showSharedResult();
    } else if (location.hash.startsWith("#set/")) {
      startSetById(decodeURIComponent(location.hash.replace("#set/", "")));
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

  function showHome() {
    setHeaderTitle(null);
    setHeaderBack(false);
    fetch("exercises/index.json")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        sets = data;
        var html = '<div class="set-list">';
        var lastCategory = "";
        for (var i = 0; i < sets.length; i++) {
          var cat = sets[i].category || "";
          if (cat && cat !== lastCategory) {
            html += '<div class="set-category">' + esc(cat) + "</div>";
            lastCategory = cat;
          }
          html +=
            '<div class="set-card" data-index="' + i + '">' +
              "<h2>" + esc(sets[i].name) + "</h2>" +
              "<p>" + esc(sets[i].description) + "</p>" +
              '<div class="count">' + sets[i].count + " Aufgaben</div>" +
            "</div>";
        }
        html += "</div>";
        app.innerHTML = html;

        var cards = app.querySelectorAll(".set-card");
        for (var j = 0; j < cards.length; j++) {
          cards[j].addEventListener("click", onCardClick);
        }
      });
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
        showQuestion();
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
  }

  function showQuestion() {
    var ex = exercises[index];
    var total = exercises.length;
    var question = ex.question || currentSet.question || "";

    var rendered = renderExercise(ex);
    app.innerHTML = renderProgressDots(total, results, index) +
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
    results.push(correct);
    chosenAnswers.push(chosen);

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
    var ex = exercises[index];
    results.push(correct);

    if (ex.classify) {
      chosenAnswers.push({words: selectedWords.slice(), classify: classifyChoice});
    } else {
      chosenAnswers.push(selectedWords.slice());
    }

    var dots = document.querySelectorAll(".progress-dot");
    dots[index].className = "progress-dot " + (correct ? "dot-correct" : "dot-wrong");

    var isLast = index >= exercises.length - 1;
    var explanationHtml =
      '<div class="explanation ' + (correct ? "explanation-correct" : "explanation-wrong") + '">' +
        "<strong>" + (correct ? randomPraise() : "Leider falsch.") + "</strong>" +
        esc(ex.explanation) +
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
    var isLast = index >= exercises.length - 1;
    var feedback = document.getElementById("feedback");
    feedback.innerHTML =
      '<div class="explanation ' + (correct ? "explanation-correct" : "explanation-wrong") + '">' +
        "<strong>" + (correct ? randomPraise() : "Leider falsch.") + "</strong>" +
        esc(explanation) +
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
      showSummary();
    } else {
      showQuestion();
    }
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

  function showSummary() {
    setHeaderTitle(null);
    setHeaderBack(false);
    var correctCount = 0;
    for (var i = 0; i < results.length; i++) {
      if (results[i]) correctCount++;
    }
    var total = results.length;

    app.innerHTML =
      '<div class="summary">' +
        renderProgressDots(total, results, -1) +
        '<div class="score">' + correctCount + " / " + total + "</div>" +
        '<div class="score-label">richtig beantwortet</div>' +
        '<div class="summary-actions">' +
          '<button class="btn-primary" id="btn-retry">Nochmal</button>' +
          '<button class="btn-share" id="btn-share">Ergebnis teilen</button>' +
          '<button class="btn-secondary" id="btn-back">Zurück</button>' +
        "</div>" +
      "</div>";

    document.getElementById("btn-retry").addEventListener("click", retrySet);
    document.getElementById("btn-share").addEventListener("click", function () {
      shareResult(correctCount, total);
    });
    document.getElementById("btn-back").addEventListener("click", function () {
      location.hash = "";
      showHome();
    });
  }

  function retrySet() {
    var wrongIndices = [];
    for (var i = 0; i < results.length; i++) {
      if (!results[i]) wrongIndices.push(exerciseOrder[i]);
    }
    if (wrongIndices.length === 0) {
      initQuiz(currentSet);
    } else {
      exerciseOrder = shuffle(wrongIndices.slice());
      exercises = [];
      for (var j = 0; j < exerciseOrder.length; j++) {
        exercises.push(currentSet.exercises[exerciseOrder[j]]);
      }
      index = 0;
      results = [];
      chosenAnswers = [];
      answered = false;
    }
    setHeaderTitle(currentSet.name);
    setHeaderBack(true);
    showQuestion();
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
        "<strong>" + (rendered.correct ? randomPraise() : "Leider falsch.") + "</strong>" +
        esc(ex.explanation) +
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
        location.hash = "";
        showHome();
      });
      header.prepend(btn);
    }
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
  function randomPraise() {
    return PRAISE[Math.floor(Math.random() * PRAISE.length)];
  }

  function esc(str) {
    var d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  window.addEventListener("hashchange", function () {
    reviewSet = null;
    if (!location.hash || location.hash === "#") {
      showHome();
    } else if (location.hash.startsWith("#share/")) {
      showSharedResult();
    } else if (location.hash.startsWith("#set/")) {
      startSetById(decodeURIComponent(location.hash.replace("#set/", "")));
    }
  });

  init();
})();
