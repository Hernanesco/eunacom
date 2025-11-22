// Utilidades de almacenamiento local
const STORAGE_KEY = 'eunacomUsers';
const SESSION_KEY = 'eunacomActiveUser';

const state = {
  questions: [],
  filtered: [],
  currentQuestion: null,
  exam: null,
  timerId: null,
  timeLeft: 0,
  theme: 'light'
};

// ---------- Helpers de UI ----------
const $ = (id) => document.getElementById(id);
const showToast = (msg) => {
  const toast = $('toast');
  toast.textContent = msg;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 2200);
};

const setTheme = (mode) => {
  state.theme = mode;
  document.documentElement.setAttribute('data-theme', mode === 'dark' ? 'dark' : 'light');
};

// ---------- Gestión de usuarios ----------
function loadUsers() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
}
function saveUsers(users) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
}
function setSession(username) {
  localStorage.setItem(SESSION_KEY, username);
  updateUserChip();
}
function getSession() {
  return localStorage.getItem(SESSION_KEY);
}
function getCurrentUser() {
  const users = loadUsers();
  const username = getSession();
  return username && users[username] ? users[username] : null;
}
function upsertUser(username, password) {
  const users = loadUsers();
  const record = users[username] || { password, responses: {}, history: [] };
  record.password = password;
  users[username] = record;
  saveUsers(users);
  return record;
}
function persistUser(user) {
  const users = loadUsers();
  users[getSession()] = user;
  saveUsers(users);
}

// ---------- Carga de preguntas ----------
async function loadQuestions() {
  try {
    const res = await fetch('questions.json');
    const json = await res.json();
    state.questions = Array.isArray(json) ? json : json.questions || [];
    state.filtered = [...state.questions];
    hydrateFilters();
    renderBank();
  } catch (e) {
    console.error(e);
    showToast('No se pudo cargar questions.json');
  }
}

function hydrateFilters() {
  const categories = [...new Set(state.questions.map(q => q.category).filter(Boolean))].sort();
  const sources = [...new Set(state.questions.map(q => q.source).filter(Boolean))].sort();
  fillSelect('filter-category', categories);
  fillSelect('exam-category', categories);
  fillSelect('filter-source', sources);
  fillSelect('exam-source', sources);
}

function fillSelect(id, values) {
  const select = $(id);
  values.forEach(val => {
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = val;
    select.appendChild(opt);
  });
}

// ---------- Banco libre ----------
function applyFilters() {
  const cat = $('filter-category').value.trim().toLowerCase();
  const source = $('filter-source').value.trim().toLowerCase();
  const topic = $('filter-topic').value.trim().toLowerCase();
  state.filtered = state.questions.filter(q => {
    const byCat = !cat || (q.category || '').toLowerCase() === cat;
    const bySource = !source || (q.source || '').toLowerCase() === source;
    const byTopic = !topic || (q.topic || '').toLowerCase().includes(topic) || (q.stem || '').toLowerCase().includes(topic);
    return byCat && bySource && byTopic;
  });
  renderBank();
}

function renderBank() {
  const container = $('bank-list');
  container.innerHTML = '';
  if (!state.filtered.length) {
    container.innerHTML = '<p class="muted">No hay preguntas que coincidan con los filtros.</p>';
    return;
  }
  state.filtered.forEach(q => {
    const card = document.createElement('article');
    card.className = 'question-card';
    card.innerHTML = `
      <div class="badges">
        <span class="badge primary">${q.category || 'Sin categoría'}</span>
        <span class="badge">${q.source || 'Fuente desconocida'}</span>
        <span class="badge outline">${q.topic || 'Tema'}</span>
        <span class="badge">ID: ${q.id}</span>
      </div>
      <h3>${q.stem}</h3>
    `;
    const opts = document.createElement('div');
    opts.className = 'options';
    q.options.forEach((opt, idx) => {
      const btn = document.createElement('button');
      btn.className = 'option-btn';
      btn.textContent = opt;
      btn.addEventListener('click', () => handleBankAnswer(q, idx, card));
      opts.appendChild(btn);
    });
    card.appendChild(opts);
    container.appendChild(card);
  });
}

function handleBankAnswer(question, choice, card) {
  const user = getCurrentUser();
  if (!user) {
    showToast('Inicia sesión para guardar tu progreso');
  }
  const feedback = document.createElement('div');
  feedback.className = 'feedback';
  const justification = document.createElement('div');
  justification.className = 'justification';

  const buttons = card.querySelectorAll('.option-btn');
  buttons.forEach((btn, idx) => {
    btn.disabled = true;
    if (idx === question.answer_index) btn.classList.add('correct');
    if (idx === choice && idx !== question.answer_index) btn.classList.add('wrong');
  });

  const correct = choice === question.answer_index;
  feedback.textContent = correct ? '¡Respuesta correcta!' : 'Respuesta incorrecta';
  feedback.style.color = correct ? 'var(--success)' : 'var(--danger)';
  justification.textContent = question.justification || '';
  card.appendChild(feedback);
  card.appendChild(justification);

  if (user) {
    registerResponse(user, question, choice, correct);
    persistUser(user);
  }
}

// ---------- Registro de respuestas ----------
function registerResponse(user, question, choice, correct) {
  const now = new Date().toISOString();
  const current = user.responses[question.id] || { attempts: 0, correct: 0, incorrect: 0, lastAnswer: null, lastDate: null };
  current.attempts += 1;
  if (correct) current.correct += 1; else current.incorrect += 1;
  current.lastAnswer = choice;
  current.lastDate = now;
  user.responses[question.id] = current;
}

// ---------- Simulador ----------
function startExam(fromWeakAreas = false) {
  const total = parseInt($('exam-count').value, 10) || 20;
  const duration = parseInt($('exam-duration').value, 10) || 180;
  const cat = $('exam-category').value.trim();
  const src = $('exam-source').value.trim();

  let pool = state.questions;
  if (fromWeakAreas) {
    pool = getWeakAreaPool();
    if (!pool.length) {
      showToast('No hay áreas débiles con suficientes datos');
      return;
    }
  } else {
    pool = pool.filter(q => {
      const byCat = !cat || q.category === cat;
      const bySrc = !src || q.source === src;
      return byCat && bySrc;
    });
  }

  if (!pool.length) {
    showToast('No hay preguntas para los filtros seleccionados');
    return;
  }

  const shuffled = shuffle([...pool]).slice(0, total);
  state.exam = {
    questions: shuffled,
    answers: {},
    marked: new Set(),
    currentIndex: 0,
    duration,
    paused: false,
    remaining: duration * 60
  };
  buildNav();
  renderExamQuestion();
  startTimer();
  $('exam-summary').innerHTML = '';
  togglePanel('exam');
}

function getWeakAreaPool() {
  const user = getCurrentUser();
  if (!user) return [];
  const stats = aggregateByCategoryTopic(user.responses);
  const weakTopics = stats.filter(s => s.attempts >= 3 && s.accuracy < 0.6);
  const topicSet = new Set(weakTopics.map(s => `${s.category}|${s.topic}`));
  return state.questions.filter(q => topicSet.has(`${q.category}|${q.topic}`));
}

function startTimer() {
  clearInterval(state.timerId);
  state.timerId = setInterval(() => {
    if (!state.exam || state.exam.paused) return;
    state.exam.remaining -= 1;
    if (state.exam.remaining <= 0) {
      state.exam.remaining = 0;
      finishExam();
      return;
    }
    renderTimer();
  }, 1000);
  renderTimer();
}

function renderTimer() {
  if (!state.exam) return;
  const minutes = Math.floor(state.exam.remaining / 60).toString().padStart(2, '0');
  const seconds = (state.exam.remaining % 60).toString().padStart(2, '0');
  const label = `${minutes}:${seconds}`;
  const timer = $('timer');
  timer.textContent = label;
  if (state.exam.remaining <= 300) timer.style.color = 'var(--danger)';
  else if (state.exam.remaining <= 600) timer.style.color = 'var(--primary)';
  else timer.style.color = 'var(--text)';
}

function buildNav() {
  const nav = $('exam-nav');
  nav.innerHTML = '';
  state.exam.questions.forEach((_, idx) => {
    const btn = document.createElement('button');
    btn.textContent = idx + 1;
    btn.addEventListener('click', () => goToQuestion(idx));
    nav.appendChild(btn);
  });
  updateNav();
}

function updateNav() {
  const nav = $('exam-nav');
  const buttons = nav.querySelectorAll('button');
  buttons.forEach((btn, idx) => {
    btn.classList.toggle('current', idx === state.exam.currentIndex);
    btn.classList.toggle('answered', state.exam.answers[idx] !== undefined);
    btn.classList.toggle('marked', state.exam.marked.has(idx));
  });
}

function goToQuestion(idx) {
  state.exam.currentIndex = idx;
  renderExamQuestion();
  updateNav();
}

function renderExamQuestion() {
  const container = $('exam-question');
  const q = state.exam.questions[state.exam.currentIndex];
  if (!q) {
    container.innerHTML = '<p class="muted">Sin pregunta seleccionada.</p>';
    return;
  }
  container.innerHTML = `
    <div class="badges">
      <span class="badge primary">${q.category || 'Categoría'}</span>
      <span class="badge">${q.topic || 'Tema'}</span>
      <span class="badge">${q.source || 'Fuente'}</span>
    </div>
    <h3>${state.exam.currentIndex + 1}. ${q.stem}</h3>
    <div class="options" id="exam-options"></div>
    <div class="actions" style="margin-top:0.5rem;">
      <button class="btn ghost" id="mark-btn">Marcar para revisión</button>
    </div>
  `;
  const opts = $('exam-options');
  q.options.forEach((opt, idx) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.textContent = opt;
    btn.addEventListener('click', () => answerExam(idx));
    const stored = state.exam.answers[state.exam.currentIndex];
    if (stored !== undefined) {
      btn.disabled = true;
      if (idx === q.answer_index) btn.classList.add('correct');
      if (idx === stored && stored !== q.answer_index) btn.classList.add('wrong');
    }
    opts.appendChild(btn);
  });
  const markBtn = $('mark-btn');
  markBtn.addEventListener('click', toggleMark);
  markBtn.textContent = state.exam.marked.has(state.exam.currentIndex) ? 'Quitar marca' : 'Marcar para revisión';
}

function answerExam(choice) {
  const q = state.exam.questions[state.exam.currentIndex];
  const correct = choice === q.answer_index;
  state.exam.answers[state.exam.currentIndex] = choice;
  const user = getCurrentUser();
  if (user) {
    registerResponse(user, q, choice, correct);
    persistUser(user);
  }
  renderExamQuestion();
  updateNav();
}

function toggleMark() {
  const idx = state.exam.currentIndex;
  if (state.exam.marked.has(idx)) state.exam.marked.delete(idx); else state.exam.marked.add(idx);
  renderExamQuestion();
  updateNav();
}

function pauseExam() {
  if (!state.exam) return;
  state.exam.paused = !state.exam.paused;
  $('pause-btn').textContent = state.exam.paused ? 'Reanudar' : 'Pausar';
}

function finishExam() {
  if (!state.exam) return;
  clearInterval(state.timerId);
  const summary = computeExamSummary();
  renderSummary(summary);
  saveHistory(summary);
  state.exam = null;
}

function computeExamSummary() {
  const answered = Object.keys(state.exam.answers).length;
  let correct = 0;
  const breakdown = {};
  const mistakes = [];

  state.exam.questions.forEach((q, idx) => {
    const selected = state.exam.answers[idx];
    const isCorrect = selected === q.answer_index;
    if (selected !== undefined && isCorrect) correct += 1;
    const key = `${q.category}::${q.topic}`;
    breakdown[key] = breakdown[key] || { category: q.category, topic: q.topic, attempts: 0, correct: 0 };
    breakdown[key].attempts += selected !== undefined ? 1 : 0;
    breakdown[key].correct += isCorrect ? 1 : 0;
    if (selected !== undefined && !isCorrect) {
      mistakes.push({
        stem: q.stem,
        correct: q.options[q.answer_index],
        justification: q.justification,
        chosen: selected !== undefined ? q.options[selected] : 'No respondida'
      });
    }
  });

  return {
    total: state.exam.questions.length,
    answered,
    correct,
    accuracy: state.exam.questions.length ? correct / state.exam.questions.length : 0,
    breakdown: Object.values(breakdown),
    mistakes,
    durationUsed: (parseInt($('exam-duration').value, 10) || 0) * 60 - state.exam.remaining
  };
}

function renderSummary(summary) {
  const container = $('exam-summary');
  const percent = Math.round(summary.accuracy * 100);
  container.innerHTML = `
    <div class="stat-grid">
      <div class="stat"><strong>Puntaje:</strong><br>${summary.correct}/${summary.total} (${percent}%)</div>
      <div class="stat"><strong>Respondidas:</strong><br>${summary.answered}/${summary.total}</div>
      <div class="stat"><strong>Tiempo usado:</strong><br>${Math.round(summary.durationUsed/60)} min</div>
    </div>
    <h4>Desglose por categoría/tema</h4>
    <table class="table">
      <thead><tr><th>Categoría</th><th>Tema</th><th>Intentos</th><th>Aciertos</th><th>Precisión</th></tr></thead>
      <tbody>
        ${summary.breakdown.map(b => `<tr><td>${b.category}</td><td>${b.topic}</td><td>${b.attempts}</td><td>${b.correct}</td><td>${b.attempts ? Math.round((b.correct/b.attempts)*100) : 0}%</td></tr>`).join('')}
      </tbody>
    </table>
    <h4>Preguntas falladas</h4>
    ${summary.mistakes.length ? summary.mistakes.map(m => `<div class="question-card"><strong>${m.stem}</strong><p>Correcta: ${m.correct}</p><p>Elegida: ${m.chosen}</p><p class="justification">${m.justification}</p></div>`).join('') : '<p class="muted">¡Sin errores!</p>'}
  `;
}

function saveHistory(summary) {
  const user = getCurrentUser();
  if (!user) return;
  user.history = user.history || [];
  user.history.unshift({
    date: new Date().toISOString(),
    total: summary.total,
    correct: summary.correct,
    accuracy: summary.accuracy,
    breakdown: summary.breakdown
  });
  user.history = user.history.slice(0, 20);
  persistUser(user);
  showToast('Resultado guardado en tu historial');
}

// ---------- Desempeño ----------
function aggregateByCategoryTopic(responses) {
  const stats = {};
  Object.entries(responses || {}).forEach(([id, r]) => {
    const q = state.questions.find(x => x.id === id);
    if (!q) return;
    const key = `${q.category}::${q.topic}`;
    stats[key] = stats[key] || { category: q.category, topic: q.topic, attempts: 0, correct: 0 };
    stats[key].attempts += r.attempts;
    stats[key].correct += r.correct;
  });
  return Object.values(stats).map(s => ({ ...s, accuracy: s.attempts ? s.correct / s.attempts : 0 }));
}

function renderPerformance() {
  const user = getCurrentUser();
  const container = $('performance-content');
  if (!user) {
    container.innerHTML = '<p class="muted">Inicia sesión para ver tu progreso.</p>';
    return;
  }
  const responses = user.responses || {};
  const stats = aggregateByCategoryTopic(responses).sort((a, b) => a.accuracy - b.accuracy);
  const totalAttempts = Object.values(responses).reduce((acc, r) => acc + r.attempts, 0);
  const totalCorrect = Object.values(responses).reduce((acc, r) => acc + r.correct, 0);
  const weakAreas = stats.filter(s => s.attempts >= 3 && s.accuracy < 0.6);

  container.innerHTML = `
    <div class="stat-grid">
      <div class="stat"><strong>Preguntas contestadas</strong><br>${totalAttempts}</div>
      <div class="stat"><strong>Aciertos</strong><br>${totalCorrect}</div>
      <div class="stat"><strong>Precisión global</strong><br>${totalAttempts ? Math.round((totalCorrect/totalAttempts)*100) : 0}%</div>
    </div>
    <h4>Rendimiento por categoría / tema</h4>
    <table class="table">
      <thead><tr><th>Categoría</th><th>Tema</th><th>Intentos</th><th>Aciertos</th><th>Precisión</th></tr></thead>
      <tbody>
        ${stats.map(s => `<tr><td>${s.category}</td><td>${s.topic}</td><td>${s.attempts}</td><td>${s.correct}</td><td>${Math.round(s.accuracy*100)}%</td></tr>`).join('')}
      </tbody>
    </table>
    <h4>Áreas débiles</h4>
    ${weakAreas.length ? weakAreas.map(w => `<div class="question-card"><strong>${w.category} - ${w.topic}</strong><p>${w.attempts} intentos · ${Math.round(w.accuracy*100)}% acierto</p></div>`).join('') : '<p class="muted">Aún no se detectan áreas débiles.</p>'}
  `;
}

// ---------- Autenticación ----------
function handleRegister(e) {
  e.preventDefault();
  const form = e.target;
  const username = form.username.value.trim();
  const password = form.password.value.trim();
  if (!username || !password) return;
  upsertUser(username, password);
  form.reset();
  showToast('Cuenta creada/actualizada');
}

function handleLogin(e) {
  e.preventDefault();
  const form = e.target;
  const username = form.username.value.trim();
  const password = form.password.value.trim();
  const users = loadUsers();
  if (!users[username] || users[username].password !== password) {
    $('auth-message').textContent = 'Usuario o contraseña incorrectos';
    $('auth-message').style.color = 'var(--danger)';
    return;
  }
  setSession(username);
  $('auth-message').textContent = 'Sesión iniciada';
  $('auth-message').style.color = 'var(--success)';
  renderPerformance();
}

function logout() {
  localStorage.removeItem(SESSION_KEY);
  updateUserChip();
  $('auth-message').textContent = '';
  showToast('Sesión cerrada');
}

function updateUserChip() {
  const user = getSession();
  $('user-chip').textContent = user ? `Sesión: ${user}` : 'Sesión no iniciada';
}

// ---------- Navegación de paneles ----------
function togglePanel(panel) {
  ['bank', 'exam', 'performance'].forEach(id => {
    $(`${id}-panel`).classList.toggle('hidden', id !== panel);
    $(`mode-${id}`).classList.toggle('active', panel === id);
  });
  if (panel === 'performance') renderPerformance();
}

// ---------- Utilidades ----------
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---------- Inicialización ----------
document.addEventListener('DOMContentLoaded', () => {
  setTheme('light');
  $('theme-toggle').addEventListener('change', (e) => setTheme(e.target.checked ? 'dark' : 'light'));
  $('apply-filters').addEventListener('click', applyFilters);
  $('register-form').addEventListener('submit', handleRegister);
  $('login-form').addEventListener('submit', handleLogin);
  $('logout-btn').addEventListener('click', logout);
  $('mode-bank').addEventListener('click', () => togglePanel('bank'));
  $('mode-exam').addEventListener('click', () => togglePanel('exam'));
  $('mode-performance').addEventListener('click', () => togglePanel('performance'));
  $('exam-config').addEventListener('submit', (e) => { e.preventDefault(); startExam(false); });
  $('weak-drill').addEventListener('click', () => startExam(true));
  $('pause-btn').addEventListener('click', pauseExam);
  $('finish-btn').addEventListener('click', finishExam);
  $('refresh-performance').addEventListener('click', renderPerformance);
  updateUserChip();
  loadQuestions();
});
