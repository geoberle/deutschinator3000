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

  // Review mode state (shared result navigation)
  var reviewSet = null;
  var reviewExercises = [];
  var reviewAnswers = [];
  var reviewIndex = 0;

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
        for (var i = 0; i < sets.length; i++) {
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

  function showQuestion() {
    var ex = exercises[index];
    var total = exercises.length;

    app.innerHTML = renderProgressDots(total, results, index) +
      '<div class="question-label">' + esc(currentSet.question) + "</div>" +
      '<div class="sentence">' + esc(ex.sentence) + "</div>" +
      '<div class="options" id="options"></div>' +
      '<div id="feedback"></div>';

    var optionsEl = document.getElementById("options");
    for (var i = 0; i < ex.options.length; i++) {
      var btn = document.createElement("button");
      btn.className = "option-btn";
      btn.textContent = ex.options[i];
      btn.setAttribute("data-index", i);
      btn.addEventListener("click", onOptionClick);
      optionsEl.appendChild(btn);
    }
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

    var isLast = index >= exercises.length - 1;
    var feedback = document.getElementById("feedback");
    feedback.innerHTML =
      '<div class="explanation ' + (correct ? "explanation-correct" : "explanation-wrong") + '">' +
        "<strong>" + (correct ? "Richtig!" : "Leider falsch.") + "</strong>" +
        esc(ex.explanation) +
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
    initQuiz(currentSet);
    setHeaderTitle(currentSet.name);
    setHeaderBack(true);
    showQuestion();
  }

  function shareResult(correctCount, total) {
    var payload = exerciseOrder.join(",") + "|" + chosenAnswers.join(",");
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
            var answers = halves[1].split(",").map(Number);

            reviewSet = data;
            reviewExercises = [];
            reviewAnswers = answers;
            for (var j = 0; j < order.length; j++) {
              reviewExercises.push(data.exercises[order[j]]);
            }

            var reviewResults = [];
            for (var k = 0; k < reviewExercises.length; k++) {
              reviewResults.push(answers[k] === reviewExercises[k].correct);
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
    var correct = chosen === ex.correct;
    var total = reviewExercises.length;

    var reviewResults = [];
    for (var k = 0; k < total; k++) {
      reviewResults.push(reviewAnswers[k] === reviewExercises[k].correct);
    }

    var dotsHtml = '<div class="progress-dots">';
    for (var p = 0; p < total; p++) {
      var cls = "progress-dot" +
        (reviewResults[p] ? " dot-correct" : " dot-wrong") +
        (p === reviewIndex ? " dot-active" : "");
      dotsHtml += '<div class="' + cls + '" data-review-idx="' + p + '"></div>';
    }
    dotsHtml += "</div>";

    app.innerHTML = dotsHtml +
      '<div class="question-label">' + esc(reviewSet.question) + "</div>" +
      '<div class="sentence">' + esc(ex.sentence) + "</div>" +
      '<div class="options" id="options"></div>' +
      '<div class="explanation ' + (correct ? "explanation-correct" : "explanation-wrong") + '">' +
        "<strong>" + (correct ? "Richtig!" : "Leider falsch.") + "</strong>" +
        esc(ex.explanation) +
      "</div>" +
      '<div class="review-nav" id="review-nav"></div>';

    var optionsEl = document.getElementById("options");
    for (var i = 0; i < ex.options.length; i++) {
      var btn = document.createElement("button");
      btn.className = "option-btn answered";
      btn.textContent = ex.options[i];
      if (i === ex.correct) btn.classList.add("correct");
      if (i === chosen && !correct) btn.classList.add("wrong");
      optionsEl.appendChild(btn);
    }

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
