const Pomodoro = {
  _timeRemaining: 1500, // Initialize dynamically on reset
  _phase: 'Study', // Study, Break
  _interval: null,
  _sessionsCompleted: 0,
  _isRunning: false,
  _breakEndTime: null, // Tracks when the break actually finished

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

  reset() {
    this.pause();
    this._phase = 'Study';
    this._timeRemaining = (State.get('studyDuration') || 25) * 60;
    this._sessionsCompleted = 0;
    this._breakEndTime = null;
    this._updateDisplay();
  },

  _completePhase() {
    this.pause();
    
    if (this._phase === 'Study') {
      // ── STUDY FINISHED ──
      this._sessionsCompleted++;
      
      // Update Streak
      const newStreak = State.increment('streak');
      const streakEl = document.getElementById('streak-display');
      if (streakEl) streakEl.textContent = newStreak;
      Adaptive.onStreakUpdate(newStreak);

      this._phase = 'Break';
      this._timeRemaining = State.get('breakDuration') * 60; 
      Chat.queueAgentMessage('organizer', `Great focus session! Let's take a ${State.get('breakDuration')}-minute break. Step away from the screen for a bit.`);
      this.start(); // Auto-start the break
      
    } else {
      // ── BREAK FINISHED ──
      this._phase = 'Study';
      this._timeRemaining = State.get('studyDuration') * 60;
      this._breakEndTime = Date.now(); // Record exactly when break ended

      // Send Browser Notification
      if (Notification.permission === 'granted') {
         new Notification("StudySquad", {
           body: "Break is over! Time to get back to studying.",
           icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>⏰</text></svg>"
         });
      }

      Chat.queueAgentMessage('organizer', "Break is over! Click the timer when you're back at your desk so we can track your punctuality.");
      // Do NOT auto-start the next study phase. Wait for the user to click toggle().
      this._updateDisplay();
    }
  },

  toggle() {
    // If they are starting a Study phase after a break, check punctuality
    if (!this._isRunning && this._phase === 'Study' && this._breakEndTime) {
       const delayMinutes = (Date.now() - this._breakEndTime) / 1000 / 60;
       this._breakEndTime = null; // reset

       if (delayMinutes <= 1.0) {
         // On time (within 1 minute)
         State.updateMastery(Math.min(100, State.get('mastery') + 5));
         Chat.queueAgentMessage('organizer', "Right on time. Focus mode engaged! (+5 Mastery)");
       } else {
         // Late 
         State.updateMastery(Math.max(0, State.get('mastery') - 5));
         Chat.queueAgentMessage('organizer', `You're ${Math.floor(delayMinutes)} minutes late coming back. Discipline is key! (-5 Mastery). Let's focus.`);
       }
    }

    if (this._isRunning) {
      this.pause();
    } else {
      this.start();
    }
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
    const totalPhaseTime = this._phase === 'Study' ? State.get('studyDuration') * 60 : State.get('breakDuration') * 60;
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
