(function () {
  "use strict";

  var config = {
    apiKey: "AIzaSyBO0wnZWrzrnh6YjsRl-tkAY7Dynj84WZo",
    authDomain: "deutschinator3000.firebaseapp.com",
    projectId: "deutschinator3000",
    storageBucket: "deutschinator3000.firebasestorage.app",
    messagingSenderId: "511126703437",
    appId: "1:511126703437:web:8316180e177f804f2d7b04"
  };

  firebase.initializeApp(config);

  var auth = firebase.auth();
  var firestore = firebase.firestore();

  firestore.enablePersistence().catch(function (err) {
    if (err.code === "failed-precondition") {
      console.warn("Firestore persistence unavailable: multiple tabs open");
    } else if (err.code === "unimplemented") {
      console.warn("Firestore persistence unavailable: browser not supported");
    }
  });

  function userDoc() {
    var user = auth.currentUser;
    if (!user) return null;
    return firestore.collection("users").doc(user.uid);
  }

  function challengeDoc(challengeId) {
    var doc = userDoc();
    if (!doc) return null;
    return doc.collection("challenges").doc(challengeId);
  }

  window.db = {
    auth: auth,

    signInWithGoogle: function () {
      var provider = new firebase.auth.GoogleAuthProvider();
      return auth.signInWithPopup(provider);
    },

    signOut: function () {
      return auth.signOut();
    },

    onAuthStateChanged: function (cb) {
      return auth.onAuthStateChanged(cb);
    },

    saveChallengeProgress: function (challengeId, data) {
      var ref = challengeDoc(challengeId);
      if (!ref) return;
      ref.set({
        scores: data.scores || [],
        attempts: data.attempts || {}
      }, { merge: true }).catch(function () {});
    },

    loadChallengeProgress: function (challengeId) {
      var ref = challengeDoc(challengeId);
      if (!ref) return Promise.resolve(null);
      return ref.get().then(function (snap) {
        if (!snap.exists) return null;
        var d = snap.data();
        return { scores: d.scores || [], attempts: d.attempts || {} };
      }).catch(function () { return null; });
    },

    clearChallengeProgress: function (challengeId) {
      var ref = challengeDoc(challengeId);
      if (!ref) return;
      ref.delete().catch(function () {});
    },

    isChallengeCompleted: function (challengeId) {
      var ref = challengeDoc(challengeId);
      if (!ref) return Promise.resolve(false);
      return ref.get().then(function (snap) {
        if (!snap.exists) return false;
        return snap.data().completed === true;
      }).catch(function () { return false; });
    },

    markChallengeCompleted: function (challengeId) {
      var ref = challengeDoc(challengeId);
      if (!ref) return;
      ref.set({ completed: true }, { merge: true }).catch(function () {});
    },

    getStats: function () {
      var doc = userDoc();
      if (!doc) return Promise.resolve({ xp: 0, level: 1 });
      return doc.get().then(function (snap) {
        if (!snap.exists) return { xp: 0, level: 1 };
        var d = snap.data();
        return { xp: d.xp || 0, level: d.level || 1 };
      }).catch(function () { return { xp: 0, level: 1 }; });
    },

    addXP: function (amount) {
      var doc = userDoc();
      if (!doc || amount <= 0) return Promise.resolve(null);
      return firestore.runTransaction(function (tx) {
        return tx.get(doc).then(function (snap) {
          var data = snap.exists ? snap.data() : {};
          var currentXP = data.xp || 0;
          var currentLevel = data.level || 1;
          var newXP = currentXP + amount;
          var newLevel = currentLevel;
          while (newXP >= xpForLevel(newLevel)) {
            newXP -= xpForLevel(newLevel);
            newLevel++;
          }
          tx.set(doc, { xp: newXP, level: newLevel }, { merge: true });
          return { oldLevel: currentLevel, newLevel: newLevel, xp: newXP, leveledUp: newLevel > currentLevel };
        });
      });
    },

    xpForLevel: xpForLevel
  };

  function xpForLevel(level) {
    return 100 + (level * 20);
  }
})();
