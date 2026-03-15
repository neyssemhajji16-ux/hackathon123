// ── STATE MANAGEMENT ──
const State = {
  _data: {
    apiKey: 'r8vupjLnjRCQyJpR3pqTtbIunUwSzz72',
    studentName: 'Student', // Default fallback
    topic: '',
    pdfContext: null,
    pdfFilename: null,
    mode: 'normal', // 'normal' | 'deep'
    studyDuration: 25,
    breakDuration: 5,
    conversationHistory: [],
    streak: 0,
    questionsAnswered: 0,
    quizCorrect: 0,
    quizTotal: 0,
    mastery: 0,
    wrongAnswers: [],
    sessionLog: [],
    feynmanCount: 0,
    activeAgents: ['genius', 'confused', 'skeptic', 'organizer', 'quiz', 'summarizer'],
    waitingForQuiz: false,
    lastQuizQuestion: null,
    
    // Emotion Engine Tracking
    emotionCooldown: 0,
    consecutiveEmotionCount: 0,
    lastEmotionStr: 'neutral',
  },

  get(key) { return this._data[key]; },
  set(key, val) { this._data[key] = val; },

  increment(key, by = 1) {
    this._data[key] = (this._data[key] || 0) + by;
    return this._data[key];
  },

  addToHistory(role, content) {
    this._data.conversationHistory.push({ role, content });
  },

  getHistory() { return this._data.conversationHistory; },

  setMode(mode) {
    this._data.mode = mode;
    const badge = document.getElementById('mode-badge');
    const statMode = document.getElementById('stat-mode');
    if (mode === 'deep') {
      badge.textContent = '⚠️ Deep Understanding Mode';
      badge.classList.add('deep');
      if (statMode) statMode.textContent = 'Deep';
    } else {
      badge.textContent = 'Normal Mode';
      badge.classList.remove('deep');
      if (statMode) statMode.textContent = 'Normal';
    }
  },

  updateMastery(score) {
    this._data.mastery = score;
    const arc = document.getElementById('mastery-arc');
    const val = document.getElementById('mastery-pct'); // Fixed ID
    const scoreDisplay = document.getElementById('score-display');
    if (arc) {
      const offset = 314 * (1 - score / 100); // Fixed circumference to 314
      arc.style.strokeDashoffset = offset;
    }
    if (val) val.textContent = `${Math.round(score)}%`;
    if (scoreDisplay) scoreDisplay.textContent = `${Math.round(score)}%`;
  },

  log(msg) {
    this._data.sessionLog.push({ time: new Date().toLocaleTimeString(), msg });
    const logEl = document.getElementById('session-log');
    if (logEl) {
      const item = document.createElement('div');
      item.className = 'sl-item';
      item.innerHTML = `<strong>${new Date().toLocaleTimeString()}</strong> ${msg}`;
      logEl.insertBefore(item, logEl.firstChild);
    }
  },

  incrementStats() {
    this._data.questionsAnswered++;
    const el = document.getElementById('stat-q');
    if (el) el.textContent = this._data.questionsAnswered;
  },

  updateQuizStats(correct) {
    this._data.quizTotal++;
    if (correct) this._data.quizCorrect++;
    const pct = Math.round((this._data.quizCorrect / this._data.quizTotal) * 100);
    const el = document.getElementById('stat-score'); // Fixed ID
    if (el) el.textContent = `${pct}%`;
    // Update mastery based on quiz performance
    const newMastery = Math.min(100, (State.get('mastery') + (correct ? 8 : -3)));
    State.updateMastery(newMastery);
  },

  reset() {
    this._data = {
      ...this._data,
      mode: 'normal',
      studyDuration: 25,
      breakDuration: 5,
      conversationHistory: [],
      streak: 0,
      questionsAnswered: 0,
      quizCorrect: 0,
      quizTotal: 0,
      mastery: 0,
      wrongAnswers: [],
      sessionLog: [],
      feynmanCount: 0,
      waitingForQuiz: false,
      lastQuizQuestion: null,
      emotionCooldown: 0,
      consecutiveEmotionCount: 0,
      lastEmotionStr: 'neutral',
    };
  }
};
