/*
  Ledger — client-side auth.

  IMPORTANT: this is a *local demo* auth system. There is no server, so
  everything — including password hashes — lives in this browser's
  localStorage. It's fine for a personal single-device tool or a learning
  project, but it is NOT secure account authentication: anyone with access
  to this browser/profile can open dev tools and read the stored data, and
  passwords never leave the device to be verified anywhere else. Don't reuse
  a real password here, and don't treat this as production-grade security.
  A real login system needs a server that verifies credentials and issues
  sessions — ask if you'd like that built as a next step.
*/
(function (global) {
  "use strict";

  var USERS_KEY = "ledgerUsers_v1";
  var SESSION_KEY = "ledgerSession_v1";

  function getUsers() {
    try { return JSON.parse(localStorage.getItem(USERS_KEY)) || []; }
    catch (e) { return []; }
  }
  function saveUsers(users) {
    try { localStorage.setItem(USERS_KEY, JSON.stringify(users)); }
    catch (e) { console.error("Could not save account data", e); }
  }

  function randomSalt() {
    if (global.crypto && global.crypto.getRandomValues) {
      var arr = new Uint8Array(16);
      global.crypto.getRandomValues(arr);
      return Array.from(arr).map(function (b) { return b.toString(16).padStart(2, "0"); }).join("");
    }
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  // SHA-256 when available (most browsers over file:// and http://);
  // falls back to a simple, non-cryptographic hash otherwise so the
  // app still works everywhere. Either way, a salt is used per user.
  async function hashPassword(password, salt) {
    var input = salt + ":" + password;
    if (global.crypto && global.crypto.subtle) {
      try {
        var enc = new TextEncoder().encode(input);
        var buf = await global.crypto.subtle.digest("SHA-256", enc);
        return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, "0"); }).join("");
      } catch (e) { /* fall through to the weak fallback below */ }
    }
    var h = 0;
    for (var i = 0; i < input.length; i++) { h = (h * 31 + input.charCodeAt(i)) | 0; }
    return "w" + Math.abs(h).toString(16);
  }

  async function signup(username, password, displayName) {
    username = (username || "").trim().toLowerCase();
    if (!username) return { ok: false, error: "Enter a username or email." };
    if (!password || password.length < 6) return { ok: false, error: "Password must be at least 6 characters." };
    var users = getUsers();
    if (users.some(function (u) { return u.username === username; })) {
      return { ok: false, error: "An account with that username/email already exists." };
    }
    var salt = randomSalt();
    var passwordHash = await hashPassword(password, salt);
    users.push({
      username: username,
      displayName: (displayName || "").trim() || username,
      salt: salt,
      passwordHash: passwordHash,
      createdAt: new Date().toISOString()
    });
    saveUsers(users);
    createSession(username);
    return { ok: true };
  }

  async function login(username, password) {
    username = (username || "").trim().toLowerCase();
    if (!username || !password) return { ok: false, error: "Enter your username/email and password." };
    var users = getUsers();
    var user = users.find(function (u) { return u.username === username; });
    if (!user) return { ok: false, error: "No account found for that username/email." };
    var hash = await hashPassword(password, user.salt);
    if (hash !== user.passwordHash) return { ok: false, error: "Incorrect password." };
    createSession(username);
    return { ok: true };
  }

  function createSession(username) {
    try { localStorage.setItem(SESSION_KEY, username); }
    catch (e) { console.error("Could not start session", e); }
  }
  function getSession() {
    try { return localStorage.getItem(SESSION_KEY); }
    catch (e) { return null; }
  }
  function getCurrentUser() {
    var username = getSession();
    if (!username) return null;
    return getUsers().find(function (u) { return u.username === username; }) || null;
  }
  function logout() {
    try { localStorage.removeItem(SESSION_KEY); }
    catch (e) { /* ignore */ }
  }

  global.Auth = {
    signup: signup,
    login: login,
    getSession: getSession,
    getCurrentUser: getCurrentUser,
    logout: logout
  };
})(window);
