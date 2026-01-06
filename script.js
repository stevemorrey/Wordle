// Daily Word Game - vanilla JS implementation
// Stephen: This app rotates a 5-letter word daily and lets you override via daily-words.json.

const WORD_LENGTH = 5;
const MAX_ROWS = 6;
const STORAGE_KEY_PREFIX = 'dwg_state_';

const LETTERS = 'QWERTYUIOPASDFGHJKLZXCVBNM'.split('');
const KEYBOARD_LAYOUT = [
  'QWERTYUIOP',
  'ASDFGHJKL',
  'ZXCVBNM'
];

const state = {
  target: null,
  rows: [],
  currentRow: 0,
  currentCol: 0,
  keyboardHints: {},
  dateKey: null,
  finished: false,
};

const messageEl = document.getElementById('message');
const boardEl = document.getElementById('board');
const keyboardEl = document.getElementById('keyboard');
const shareBtn = document.getElementById('shareBtn');
const resetBtn = document.getElementById('resetBtn');
const dateLabel = document.getElementById('dateLabel');

function getTodayKey() {
  const now = new Date();
  // Use user's local time but normalize to date string YYYY-MM-DD
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth()+1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function epochDay(d) {
  // Convert a Date to days since epoch
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
}

function setMessage(msg, timeout=2000) {
  messageEl.textContent = msg;
  if (timeout) setTimeout(() => { if (messageEl.textContent === msg) messageEl.textContent = ''; }, timeout);
}

async function loadWords() {
  const res = await fetch('words.json');
  if (!res.ok) throw new Error('Failed to load words.json');
  const data = await res.json();
  return data; // { answers: [], allowed: [] }
}

async function chooseTarget(data) {
  const today = new Date();
  const todayKey = getTodayKey();
  dateLabel.textContent = `Word for ${todayKey}`;

  // Allow override via URL: ?word=abcde
  const params = new URLSearchParams(location.search);
  const override = params.get('word');
  if (override && override.length === WORD_LENGTH && /^[A-Za-z]{5}$/.test(override)) {
    return override.toUpperCase();
  }

  // Try daily-words.json for explicit mapping
  try {
    const res = await fetch('daily-words.json');
    if (res.ok) {
      const map = await res.json();
      const word = map[todayKey];
      if (word && word.length === WORD_LENGTH) {
        return word.toUpperCase();
      }
    }
  } catch (e) { /* ignore */ }

  // Fallback: deterministic rotation based on date
  const start = new Date('2026-01-01T00:00:00Z');
  const idx = (epochDay(today) - epochDay(start)) % data.answers.length;
  const target = data.answers[(idx + data.answers.length) % data.answers.length];
  return target.toUpperCase();
}

function buildBoard() {
  boardEl.innerHTML = '';
  state.rows = [];
  for (let r = 0; r < MAX_ROWS; r++) {
    const row = [];
    for (let c = 0; c < WORD_LENGTH; c++) {
      const tile = document.createElement('div');
      tile.className = 'tile';
      tile.setAttribute('role','gridcell');
      tile.setAttribute('aria-label',`Row ${r+1} Col ${c+1}`);
      boardEl.appendChild(tile);
      row.push(tile);
    }
    state.rows.push(row);
  }
}

function buildKeyboard() {
  keyboardEl.innerHTML = '';
  KEYBOARD_LAYOUT.forEach((row, ri) => {
    row.split('').forEach(ch => {
      const btn = document.createElement('button');
      btn.className = 'key default';
      btn.textContent = ch;
      btn.dataset.key = ch;
      btn.addEventListener('click', () => handleKey(ch));
      keyboardEl.appendChild(btn);
    });
    if (ri === 2) {
      // Add Enter and Backspace as wide keys
      const enterBtn = document.createElement('button');
      enterBtn.className = 'key default wide';
      enterBtn.textContent = 'ENTER';
      enterBtn.addEventListener('click', () => handleKey('Enter'));
      keyboardEl.appendChild(enterBtn);

      const backBtn = document.createElement('button');
      backBtn.className = 'key default wide';
      backBtn.textContent = '⌫';
      backBtn.addEventListener('click', () => handleKey('Backspace'));
      keyboardEl.appendChild(backBtn);
    }
  });
}

function updateKeyboardHints() {
  for (const [letter, status] of Object.entries(state.keyboardHints)) {
    const btn = keyboardEl.querySelector(`[data-key="${letter}"]`);
    if (!btn) continue;
    btn.classList.remove('default','correct','present','absent');
    btn.classList.add(status);
  }
}

function fillTile(r, c, ch) {
  const tile = state.rows[r][c];
  tile.textContent = ch;
  if (ch) tile.classList.add('filled'); else tile.classList.remove('filled');
}

function clearRow(r) {
  for (let c = 0; c < WORD_LENGTH; c++) fillTile(r, c, '');
}

function readRow(r) {
  let s = '';
  for (let c = 0; c < WORD_LENGTH; c++) s += state.rows[r][c].textContent || '';
  return s;
}

function evaluateGuess(guess, target) {
  const res = Array(WORD_LENGTH).fill('absent');
  const targetArr = target.split('');
  const guessArr = guess.split('');
  const counts = {};
  targetArr.forEach(ch => counts[ch] = (counts[ch]||0)+1);

  // First pass: correct positions
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (guessArr[i] === targetArr[i]) {
      res[i] = 'correct';
      counts[guessArr[i]] -= 1;
    }
  }
  // Second pass: present letters
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (res[i] === 'correct') continue;
    const ch = guessArr[i];
    if ((counts[ch]||0) > 0) {
      res[i] = 'present';
      counts[ch] -= 1;
    }
  }
  return res; // array of 'correct' | 'present' | 'absent'
}

function applyEvaluation(r, evalRes) {
  for (let c = 0; c < WORD_LENGTH; c++) {
    const tile = state.rows[r][c];
    tile.classList.remove('correct','present','absent');
    tile.classList.add(evalRes[c]);
    const letter = tile.textContent;
    // Promote keyboard hint if better status
    const prev = state.keyboardHints[letter];
    const rank = {absent:0, present:1, correct:2};
    if (!prev || rank[evalRes[c]] > rank[prev]) {
      state.keyboardHints[letter] = evalRes[c];
    }
  }
  updateKeyboardHints();
}

function saveState() {
  if (!state.dateKey) return;
  const data = {
    rows: state.rows.map(row => row.map(tile => tile.textContent || '')),
    currentRow: state.currentRow,
    currentCol: state.currentCol,
    keyboardHints: state.keyboardHints,
    target: state.target,
    finished: state.finished,
  };
  localStorage.setItem(STORAGE_KEY_PREFIX + state.dateKey, JSON.stringify(data));
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY_PREFIX + state.dateKey);
  if (!raw) return false;
  try {
    const data = JSON.parse(raw);
    state.currentRow = data.currentRow || 0;
    state.currentCol = data.currentCol || 0;
    state.keyboardHints = data.keyboardHints || {};
    state.target = data.target || state.target;
    state.finished = !!data.finished;
    // restore tiles
    const rowsData = data.rows || [];
    for (let r = 0; r < Math.min(rowsData.length, MAX_ROWS); r++) {
      for (let c = 0; c < Math.min(rowsData[r].length, WORD_LENGTH); c++) {
        const ch = rowsData[r][c];
        if (ch) fillTile(r, c, ch);
      }
    }
    updateKeyboardHints();
    if (state.finished) shareBtn.disabled = false;
    return true;
  } catch(e) { return false; }
}

function endGame(win) {
  state.finished = true;
  shareBtn.disabled = false;
  setMessage(win ? 'You did it! 🎉' : `The word was ${state.target}.`);
  saveState();
}

function share() {
  // Build emoji grid similar to Wordle share
  let grid = '';
  for (let r = 0; r < state.currentRow; r++) {
    let rowStr = '';
    for (let c = 0; c < WORD_LENGTH; c++) {
      const cls = state.rows[r][c].classList;
      if (cls.contains('correct')) rowStr += '🟩';
      else if (cls.contains('present')) rowStr += '🟨';
      else rowStr += '⬛';
    }
    grid += rowStr + '\n';
  }
  const text = `Daily Word Game ${state.dateKey} ${state.finished ? state.currentRow : 'X'}/${MAX_ROWS}\n\n${grid}`;
  navigator.clipboard.writeText(text).then(() => setMessage('Copied to clipboard!')).catch(() => setMessage('Copy failed'));
}

function handleKey(key) {
  if (state.finished) return;
  if (key === 'Enter') {
    if (state.currentCol !== WORD_LENGTH) {
      setMessage('Not enough letters'); return;
    }
    const guess = readRow(state.currentRow);
    if (!window.allowedSet.has(guess)) { setMessage('Not in word list'); return; }
    const evalRes = evaluateGuess(guess, state.target);
    applyEvaluation(state.currentRow, evalRes);
    if (guess === state.target) { endGame(true); return; }
    state.currentRow += 1; state.currentCol = 0;
    if (state.currentRow >= MAX_ROWS) { endGame(false); return; }
    saveState();
    return;
  }
  if (key === 'Backspace') {
    if (state.currentCol > 0) {
      state.currentCol -= 1;
      fillTile(state.currentRow, state.currentCol, '');
    }
    return;
  }
  const ch = key.toUpperCase();
  if (!LETTERS.includes(ch)) return;
  if (state.currentCol >= WORD_LENGTH) return;
  fillTile(state.currentRow, state.currentCol, ch);
  state.currentCol += 1;
}

function attachListeners() {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === 'Backspace') handleKey(e.key);
    else if (/^[a-zA-Z]$/.test(e.key)) handleKey(e.key);
  });
  shareBtn.addEventListener('click', share);
  resetBtn.addEventListener('click', () => {
    localStorage.removeItem(STORAGE_KEY_PREFIX + state.dateKey);
    state.finished = false; state.currentRow = 0; state.currentCol = 0; state.keyboardHints = {};
    buildBoard(); buildKeyboard(); updateKeyboardHints(); setMessage('Reset for today');
  });
}

async function init() {
  buildBoard();
  buildKeyboard();
  attachListeners();

  const words = await loadWords();
  window.allowedSet = new Set(words.allowed.map(w => w.toUpperCase()));

  state.dateKey = getTodayKey();
  state.target = await chooseTarget(words);

  // Ensure target is allowed
  window.allowedSet.add(state.target);

  // Try to restore previous state
  loadState();

  console.log('Target word:', state.target);
}

init().catch(err => {
  console.error(err);
  setMessage('Failed to initialize game. Check console.');
});
