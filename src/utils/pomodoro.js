// ── POMODORO TIMER ──
const Pomodoro = {
  STUDY_SECS: 25 * 60,
  BREAK_SECS: 5 * 60,
  _secs: 25 * 60,
  _running: false,
  _break: false,
  _interval: null,
  _sessionsCompleted: 0,
  CIRC: 94.2,

  toggle() {
    this._running ? this.pause() : this.start();
  },

  start() {
    if (this._running) return;
    this._running = true;
    document.getElementById('pomo-phase-txt').textContent = this._break ? 'Break' : 'Study';
    this._interval = setInterval(() => this._tick(), 1000);
    State.log(`Pomodoro started — ${this._break ? 'break' : 'focus'} phase`);
  },

  pause() {
    this._running = false;
    clearInterval(this._interval);
    document.getElementById('pomo-phase-txt').textContent = 'Paused';
  },

  reset() {
    this.pause();
    this._break = false;
    this._secs = this.STUDY_SECS;
    this._render();
  },

  _tick() {
    this._secs--;
    this._render();
    if (this._secs <= 0) {
      this._phase_complete();
    }
  },

  _phase_complete() {
    this.pause();
    this._break = !this._break;
    this._secs = this._break ? this.BREAK_SECS : this.STUDY_SECS;

    if (!this._break) {
      // Completed a study session
      this._sessionsCompleted++;
      const streak = State.increment('streak');
      document.getElementById('streak-display').textContent = streak;
      State.log(`Session ${this._sessionsCompleted} complete — streak: ${streak}`);
      Adaptive.onStreakUpdate(streak);
    }

    // Notify organizer
    Chat.queueAgentMessage('organizer', this._break
      ? `⏱️ Focus session complete! Take a 5-minute break — stretch, breathe, hydrate. I'll call you back!`
      : `Break over! Let's jump back in. Who wants to pick up where we left off? 💪`
    );

    this._render();
    if (!this._break) {
      // Auto-start next study phase after brief delay
      setTimeout(() => this.start(), 3000);
    }
  },

  _render() {
    const m = Math.floor(this._secs / 60);
    const s = this._secs % 60;
    const txt = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    document.getElementById('pomo-time-txt').textContent = txt;

    const total = this._break ? this.BREAK_SECS : this.STUDY_SECS;
    const progress = this._secs / total;
    const offset = this.CIRC * (1 - progress);
    const arc = document.getElementById('pomo-arc');
    arc.style.strokeDashoffset = offset;
    arc.style.stroke = this._break ? '#43e8b0' : '#7c6fff';

    document.getElementById('pomo-phase-txt').textContent =
      this._running ? (this._break ? 'Break' : 'Focus') : (this._running ? '...' : 'Ready');
  },

  getSessionsCompleted() { return this._sessionsCompleted; }
};
