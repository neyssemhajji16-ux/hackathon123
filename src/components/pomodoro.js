const Pomodoro = {
  _timeRemaining: 25 * 60,
  _phase: 'Study', // Study, Break
  _interval: null,
  _sessionsCompleted: 0,
  _isRunning: false,

  start() {
    if (this._isRunning) return;
    this._isRunning = true;
    this._interval = setInterval(() => {
      this._timeRemaining--;
      if (this._timeRemaining <= 0) {
        this._completePhase();
      }
      this._updateDisplay();
    }, 1000);
    this._updateDisplay();
  },

  pause() {
    this._isRunning = false;
    clearInterval(this._interval);
  },

  toggle() {
    if (this._isRunning) {
      this.pause();
    } else {
      this.start();
    }
  },

  reset() {
    this.pause();
    this._phase = 'Study';
    this._timeRemaining = 25 * 60;
    this._sessionsCompleted = 0;
    this._updateDisplay();
  },

  _completePhase() {
    this.pause();
    if (this._phase === 'Study') {
      this._sessionsCompleted++;
      this._phase = 'Break';
      this._timeRemaining = 5 * 60; // 5 min break
      Chat.queueAgentMessage('organizer', "Great focus session! Let's take a 5-minute break. Step away from the screen for a bit.");
    } else {
      this._phase = 'Study';
      this._timeRemaining = 25 * 60;
      Chat.queueAgentMessage('organizer', "Break is over! Let's get back into it. Who wants to start the next topic?");
    }
    // Auto start the next phase
    this.start();
  },

  _updateDisplay() {
    const timeTxt = document.getElementById('pomo-time-txt');
    const phaseTxt = document.getElementById('pomo-phase-txt');
    const arc = document.getElementById('pomo-arc');

    if (!timeTxt || !phaseTxt || !arc) return;

    const m = Math.floor(this._timeRemaining / 60);
    const s = this._timeRemaining % 60;
    timeTxt.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    phaseTxt.textContent = this._phase;

    // Update SVG Circle
    const totalPhaseTime = this._phase === 'Study' ? 25 * 60 : 5 * 60;
    const pct = this._timeRemaining / totalPhaseTime;
    const dashOffset = 94.2 - (pct * 94.2); // 94.2 is circumference (2 * pi * r, where r=15)
    
    // Style adjustments based on state
    arc.style.strokeDashoffset = dashOffset;
    
    if (this._phase === 'Break') {
        arc.style.stroke = '#43e8b0'; // green for break
    } else if (!this._isRunning) {
        arc.style.stroke = '#64748b'; // gray if paused
    } else {
        arc.style.stroke = '#7c6fff'; // purple for study
    }
  },

  getSessionsCompleted() {
    return this._sessionsCompleted;
  }
};
