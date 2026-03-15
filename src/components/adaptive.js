// ── ADAPTIVE COMPONENT ──
const Adaptive = {
  _wrongCount: 0,
  _checkInterval: null,

  // Called after each student message to check for struggle
  async checkStruggle(studentMessage) {
    // Simple heuristic check first (fast, no API call)
    const struggleKeywords = [
      "don't understand", "confused", "lost", "what?", "huh",
      "i don't get", "not sure", "what does", "what is", "help",
      "don't know", "no idea", "wrong", "mistake"
    ];
    const lower = studentMessage.toLowerCase();
    const keywordMatch = struggleKeywords.some(k => lower.includes(k));

    // Track wrong quiz answers
    if (State.get('lastQuizQuestion') && this._looksWrong(studentMessage)) {
      this._wrongCount++;
    }

    const shouldCheck = keywordMatch || this._wrongCount >= 2;

    if (!shouldCheck) return false;

    // API-based struggle detection
    try {
      const recentAgentMsgs = State.getHistory()
        .filter(m => m.role === 'assistant')
        .slice(-3)
        .map(m => m.content)
        .join(', ');

      const result = await API.detectStruggle(studentMessage, recentAgentMsgs, State.get('topic'));

      if (result.struggling) {
        this._triggerDeepMode(result.weak_area || State.get('topic'));
        this._wrongCount = 0;
        return true;
      }
    } catch (e) {
      // Fallback to keyword detection only
      if (keywordMatch && State.get('mode') !== 'deep') {
        this._triggerDeepMode(State.get('topic'));
        return true;
      }
    }

    return false;
  },

  _triggerDeepMode(weakArea) {
    if (State.get('mode') === 'deep') return; // Already in deep mode

    State.setMode('deep');
    Avatars.flashModeChange();

    // Show struggle alert
    const alert = document.getElementById('struggle-alert');
    const topicTxt = document.getElementById('struggle-topic-txt');
    if (alert) {
      if (topicTxt) topicTxt.textContent = ` — difficulty detected with: ${weakArea}`;
      alert.style.display = 'flex';
      setTimeout(() => { alert.style.display = 'none'; }, 5000);
    }

    // Maya announces the mode switch
    Chat.queueAgentMessage('organizer',
      `⚠️ I'm noticing some difficulty with ${weakArea}. Let's switch to **Deep Understanding Mode** — we'll slow down, use more examples, and make sure everyone is on the same page before moving forward.`
    );

    State.log(`Deep Understanding Mode activated — ${weakArea}`);

    // Auto-revert after 5 student messages
    let deepMsgCount = 0;
    const originalCheck = App._onStudentMessage;
    // Will revert in App logic after 5 exchanges
    State.set('deepModeStartMsg', State.getHistory().length);
  },

  // Check if we should revert to normal mode
  checkRevertMode() {
    if (State.get('mode') !== 'deep') return;
    const startMsg = State.get('deepModeStartMsg') || 0;
    const currentMsg = State.getHistory().length;
    if (currentMsg - startMsg >= 10) {
      State.setMode('normal');
      Chat.queueAgentMessage('organizer',
        `Great progress! I think we've got a better handle on this now. Switching back to normal mode — let's keep the momentum going! 💪`
      );
      State.log('Returned to Normal Mode');
    }
  },

  // Streak-based agent reactions
  onStreakUpdate(streak) {
    if (streak === 3) {
      Chat.queueAgentMessage('organizer', `🔥 Focus Streak: 3 sessions! You're on a roll — most students give up by now.`);
      setTimeout(() => Chat.queueAgentMessage('confused', `Wow, you're actually doing it 😅 I'm taking notes from YOU now!`), 2000);
    } else if (streak === 5) {
      Chat.queueAgentMessage('organizer', `🔥🔥 5-session streak! That's elite discipline. Taking a break now would actually help consolidate memory.`);
      setTimeout(() => Chat.queueAgentMessage('skeptic', `I'll admit — consistent sessions beat cramming. The data backs it up.`), 2000);
    } else if (streak >= 7) {
      Chat.queueAgentMessage('organizer', `🏆 Streak: ${streak}! You've unlocked deep focus territory. The material is cementing itself. Impressive.`);
    }
  },

  _looksWrong(msg) {
    // Very basic heuristic for wrong answers
    const lower = msg.toLowerCase();
    return lower.includes('wrong') || lower.includes('incorrect') ||
      lower.includes('not right') || lower.includes('mistake');
  },

  reset() {
    this._wrongCount = 0;
  }
};
