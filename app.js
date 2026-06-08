(function () {
  "use strict";

  var app = document.getElementById("app");

  var sets = [];
  var currentSet = null;
  var exercises = [];
  var index = 0;
  var results = [];
  var answered = false;

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
        exercises = shuffle(data.exercises.slice());
        index = 0;
        results = [];
        answered = false;
        setHeaderBack(true);
        showQuestion();
      });
  }

  function showQuestion() {
    var ex = exercises[index];
    var total = exercises.length;

    var progressHtml = '<div class="progress-dots">';
    for (var p = 0; p < total; p++) {
      var cls = "progress-dot";
      if (p < results.length) {
        cls += results[p] ? " dot-correct" : " dot-wrong";
      } else if (p === index) {
        cls += " dot-current";
      }
      progressHtml += '<div class="' + cls + '"></div>';
    }
    progressHtml += "</div>";

    app.innerHTML = progressHtml +
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
    setHeaderBack(false);
    var correctCount = 0;
    for (var i = 0; i < results.length; i++) {
      if (results[i]) correctCount++;
    }
    var total = results.length;

    app.innerHTML =
      '<div class="summary">' +
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
    exercises = shuffle(currentSet.exercises.slice());
    index = 0;
    results = [];
    answered = false;
    setHeaderBack(true);
    showQuestion();
  }

  function shareResult(correctCount, total) {
    var url =
      location.origin + location.pathname +
      "#share/" + encodeURIComponent(currentSet.id) +
      "/" + correctCount + "/" + total;

    if (navigator.share) {
      navigator.share({
        title: "Deutschinator 3000",
        text: correctCount + " von " + total + ' richtig bei "' + currentSet.name + '"!',
        url: url,
      });
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(function () {
        showToast("Link kopiert!");
      });
    }
  }

  function showSharedResult() {
    var parts = location.hash.replace("#share/", "").split("/");
    var setId = decodeURIComponent(parts[0]);
    var correctCount = parseInt(parts[1], 10);
    var total = parseInt(parts[2], 10);

    fetch("exercises/index.json")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var set = null;
        for (var i = 0; i < data.length; i++) {
          if (data[i].id === setId) { set = data[i]; break; }
        }
        var name = set ? set.name : setId;

        app.innerHTML =
          '<div class="shared-result">' +
            '<div class="set-name">' + esc(name) + "</div>" +
            '<div class="score">' + correctCount + " / " + total + "</div>" +
            '<div class="score-label">richtig beantwortet</div>' +
            '<div class="summary-actions">' +
              '<button class="btn-primary" id="btn-try">Selbst üben</button>' +
            "</div>" +
          "</div>";

        document.getElementById("btn-try").addEventListener("click", function () {
          location.hash = "";
          showHome();
        });
      });
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
