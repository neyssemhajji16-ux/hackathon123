// ── MAIN APP CONTROLLER ──
const App = {
  _sending: false,

  // ── PAGE NAVIGATION ──
  showLanding() {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('landing-page').classList.add('active');
  },

  showSetup() {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('setup-page').classList.add('active');
  },

  showRoom() {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('room-page').classList.add('active');
  },

  // ── FILE UPLOAD ──
  async handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const zone = document.getElementById('upload-zone');
    const status = document.getElementById('file-status');
    zone.style.opacity = '0.6';

    try {
      const text = await PDFUtil.processUpload(file);
      State.set('pdfContext', text);
      State.set('pdfFilename', file.name);

      status.style.display = 'block';
      status.textContent = `✓ ${file.name} loaded — ${text.length} characters extracted`;
      zone.innerHTML = `<div class="upload-icon">✅</div><div class="upload-text">${file.name}</div><div class="upload-hint">Content ready for agents</div>`;
    } catch (e) {
      status.style.display = 'block';
      status.style.background = '#ff6b9d14';
      status.style.borderColor = '#ff6b9d33';
      status.style.color = '#ff9fd4';
      status.textContent = `⚠ Could not extract PDF — agents will discuss topic generally`;
    }

    zone.style.opacity = '1';
  },

  // ── START SESSION ──
  async startSession() {
    const apiKeyInput = document.getElementById('api-key-input');
    const nameInput = document.getElementById('name-input');
    const apiKey = apiKeyInput ? apiKeyInput.value.trim() : State.get('apiKey');
    const topic = document.getElementById('topic-input').value.trim();
    const sName = nameInput ? nameInput.value.trim() : 'Student';
    const errEl = document.getElementById('setup-error');

    errEl.style.display = 'none';

    if (!apiKey) { errEl.textContent = '⚠ Please enter your Mistral API key'; errEl.style.display = 'block'; return; }
    if (!topic) { errEl.textContent = '⚠ Please enter a study topic'; errEl.style.display = 'block'; return; }

    State.set('apiKey', apiKey);
    State.set('topic', topic);
    if (sName) State.set('studentName', sName);
    State.reset();

    // Get active agents from toggles
    const activeAgents = [];
    document.querySelectorAll('.at-item.on').forEach(el => {
      activeAgents.push(el.dataset.agent);
    });
    State.set('activeAgents', activeAgents);

    // Setup room UI
    document.getElementById('header-topic').textContent = topic;
    document.getElementById('streak-display').textContent = '0';
    document.getElementById('score-display').textContent = '—';

    Avatars.buildAgentList(activeAgents);
    Chat.clearMessages();

    this.showRoom();
    this._openSession(topic, activeAgents);
  },

  // ── OPEN SESSION ──
  _openSession(topic, activeAgents) {
    const pdfContext = State.get('pdfContext');
    const hasPDF = !!pdfContext;
    const studentName = State.get('studentName') || 'You';

    // Update UI name
    const nameLabel = document.getElementById('user-name-label');
    if (nameLabel) nameLabel.textContent = studentName;

    // Start Camera & Voice
    Camera.init();
    Voice.init();

    // Maya opens the session
    const openMsg = hasPDF
      ? `Hey everyone! 📋 We're studying **${topic}** today — and we've got the lecture notes loaded. Let's make this session count! Who wants to start?`
      : `Hey team! 📋 Today's topic is **${topic}**. No notes uploaded, so let's figure this out together. Alex, want to kick us off?`;

    Chat.queueAgentMessage('organizer', openMsg);

    // Only genius and confused intro — creates a natural opening discussion
    // Each one will see the previous message and react to it
    const introAgents = ['genius', 'confused'].filter(a => activeAgents.includes(a));
    introAgents.forEach((agentKey, i) => {
      setTimeout(() => {
        Chat.queueAgentAPI(agentKey);
      }, (i + 1) * 500);
    });

    State.log(`Session started — topic: ${topic}`);
    Pomodoro.start();
  },

  // ── SEND MESSAGE ──
  async sendMessage(textArg) {
    if (this._sending) return;

    const inp = document.getElementById('chat-input');
    const btn = document.getElementById('send-btn');
    const text = textArg || inp.value.trim();
    if (!text) return;

    this._sending = true;
    inp.value = '';
    inp.style.height = 'auto';
    inp.disabled = true;
    btn.disabled = true;

    // Add user message
    Chat.addMessage('user', text);
    State.addToHistory('user', text);
    State.incrementStats();
    Feynman.hide();

    // Handle special states
    if (State.get('waitingForFeynman')) {
      await Feynman.evaluate(text);
      this._sending = false;
      return;
    }

    if (State.get('waitingForQuiz')) {
      State.set('waitingForQuiz', false);
      // Quiz master evaluates the answer
      Chat.queueAgentAPI('quiz');
      // Then check for struggle
      setTimeout(async () => {
        await Adaptive.checkStruggle(text);
        Adaptive.checkRevertMode();
      }, 3000);
      this._sending = false;
      return;
    }

    // Normal message flow
    await this._onStudentMessage(text);
    this._sending = false;
  },

  async _onStudentMessage(text) {
    const mode = State.get('mode');
    const activeAgents = State.get('activeAgents');

    // Check for struggle (async, non-blocking for UI)
    Adaptive.checkStruggle(text).then(isStruggling => {
      if (!isStruggling) Adaptive.checkRevertMode();
    });

    // ── EMOTIONAL INTELLIGENCE ENGINE ──
    const emotionData = await API.analyzeEmotion(text);
    State.log(`Emotion Engine: ${emotionData.emotion} (${emotionData.intensity}) - ${emotionData.trigger}`);
    
    // Cooldown management
    let cooldown = State.get('emotionCooldown') || 0;
    if (cooldown > 0) cooldown--;
    State.set('emotionCooldown', cooldown);

    const isHighIntensity = emotionData.intensity === 'medium' || emotionData.intensity === 'high';
    const isNeutral = emotionData.emotion === 'NEUTRAL';
    const lastStr = State.get('lastEmotionStr') || 'neutral';

    // Track Consecutive Negatives
    const isNegative = ['SAD', 'CONFUSED', 'STRESSED', 'FRUSTRATED', 'TIRED'].includes(emotionData.emotion);
    if (isNegative && emotionData.emotion === lastStr && isHighIntensity) {
      const count = State.get('consecutiveEmotionCount') + 1;
      State.set('consecutiveEmotionCount', count);
      if (count >= 2) {
        State.log(`ESCALATION: Consecutive ${emotionData.emotion} detected. Handing over to Antigravity Engine.`);
        Chat.queueAgentMessage('organizer', "Okay, I'm pausing the session. You seem really stuck in a negative loop right now. I'm escalating this to the core system to help reorganize our approach.");
        Pomodoro.pause(); // Stop the visual timer
        State.set('emotionCooldown', 3);
        State.set('consecutiveEmotionCount', 0);
        return;
      }
    } else {
      State.set('consecutiveEmotionCount', isNegative ? 1 : 0);
    }

    // Celebrate shifts to positive
    const wasNegative = ['SAD', 'CONFUSED', 'STRESSED', 'FRUSTRATED', 'TIRED'].includes(lastStr);
    const isPositive = ['HAPPY', 'CONFIDENT'].includes(emotionData.emotion);
    
    State.set('lastEmotionStr', emotionData.emotion);

    if (wasNegative && isPositive) {
      Chat.queueAgentAPI('organizer', 0, "CELEBRATION OVERRIDE: The student just shifted from a negative emotion to a positive one! Acknowledge this explicitly. 'Wait — you seem better! What clicked? Should we pick up where we left off?' Keep it brief, warm, and encouraging.");
      cooldown = 0; // End recovery period since they are happy
      State.set('emotionCooldown', cooldown);
      return; 
    }

    // "I'm fine" / "Never mind" Recovery
    const isDismissive = text.toLowerCase().includes("i'm fine") || text.toLowerCase().includes("never mind") || text.toLowerCase().includes("nevermind");
    if (isDismissive) {
      cooldown = 0; // Reset to normal immediately
      State.set('emotionCooldown', 0);
    }

    // If active emotion (and no cooldown), inject reaction scripts
    if (!isNeutral && isHighIntensity && cooldown === 0) {
      State.set('emotionCooldown', 3); // Set cooldown

      if (emotionData.emotion === 'SAD') {
        Chat.queueAgentAPI('confused', 0, "SAD OVERRIDE: Drop your confused persona completely. Address the HUMAN STUDENT directly. Speak like a real friend. Do NOT give study advice. Acknowledge the feeling first. Use: 'Hey, are you okay?' or 'I noticed something in what you wrote...' or 'Honestly, I feel like that too sometimes...' 2-3 sentences max. End with ONE gentle question: 'What's going on?' or 'Is it the material or something else?'");
        Chat.queueAgentAPI('organizer', 500, "SAD OVERRIDE: Address the HUMAN STUDENT directly. Warm but practical. Don't be clinical. Suggest pausing the Pomodoro or taking a breath. End with: 'No pressure to continue right now. We're not going anywhere.'");
        return;
      }
      if (emotionData.emotion === 'CONFUSED') {
        Chat.queueAgentAPI('skeptic', 0, "CONFUSED OVERRIDE: Set aside the challenger persona. Be human. 'Hey — confusion is actually a sign your brain is working. It means you've hit the edge of what you know. That's exactly where learning happens.' Then ask: 'What's the specific part that's not clicking?' Keep it brief and real.");
        return;
      }
      if (emotionData.emotion === 'HAPPY') {
        Chat.queueAgentAPI('genius', 0, "HAPPY OVERRIDE: Match their energy. Celebrate genuinely. Don't immediately pivot to more work — let the moment breathe. Use: 'YES! That's exactly it!' or 'Okay that actually made my day'. Then naturally: 'Since you're on a roll, want to push a bit further?'");
        Chat.queueAgentAPI('quiz', 500, "HAPPY OVERRIDE: 'You seem fired up — want to lock this in with a quick question while it's fresh? No pressure, but this is literally the best time to quiz.' Then ask ONE relevant question from the material.");
        return;
      }
      if (emotionData.emotion === 'STRESSED') {
        Chat.queueAgentAPI('organizer', 0, "STRESSED OVERRIDE - PRIORITY: Do NOT give study tips first. Validate first. Give ONE concrete grounding technique: 'Before anything else — take 3 deep breaths. Seriously. I'll wait.' Then reframe: 'You're here, studying. That already puts you ahead of most people.' Then restructure: 'Let's focus on only the 3 most important things for your exam. Just 3. Nothing else. Can you tell me what those are?' Stay calm, structured, human.");
        return;
      }
      if (emotionData.emotion === 'FRUSTRATED') {
        Chat.queueAgentAPI('skeptic', 0, "FRUSTRATED OVERRIDE: Empathy, not challenge. Frustration is YOUR emotion too — say so. 'Honestly? Frustration means you care. People who don't care don't get frustrated.' Then pivot: 'Let's reset. Forget everything. Start from zero. What would you tell a 10-year-old about this concept?'");
        return;
      }
      if (emotionData.emotion === 'TIRED') {
        Chat.queueAgentAPI('summarizer', 0, "TIRED OVERRIDE: 'Okay — tired brain retains almost nothing. Let me give you a 3-point summary of everything important from today so you can rest without guilt.' Give a brief clear summary of the session so far.");
        Chat.queueAgentAPI('organizer', 500, "TIRED OVERRIDE: 'You've done enough for today. Sleep actually consolidates memory better than another hour of struggling. Come back tomorrow — we'll be here.'");
        return;
      }
      if (emotionData.emotion === 'CONFIDENT') {
        Chat.queueAgentAPI('skeptic', 0, "CONFIDENT OVERRIDE: Productive, not harsh. 'Okay, I believe you. But let me throw one edge case at you — if you can handle this, you genuinely know it.' Present ONE challenging scenario or counterexample from the material. This turns confidence into mastery.");
        return;
      }
    }

    // Emotion Cooldown Message (Triggered on the exact message the cooldown ends)
    if (cooldown === 0 && text && !isNeutral && !isHighIntensity && State.get('emotionCooldown') === 0 && State.get('lastEmotionStr') !== 'neutral') {
       // Reset
    }

    // ── NORMAL MESSAGE FLOW ──

    // Build a natural discussion sequence (2-3 agents)
    // Agents are queued sequentially — each one sees previous responses in history
    let sequence;
    if (mode === 'deep') {
      // Deep mode: genius explains, confused asks follow-up
      sequence = ['genius', 'confused'].filter(a => activeAgents.includes(a));
    } else {
      // Normal mode: create a discussion thread
      // Start with genius or confused, then have others react
      const discussions = [
        ['genius'],                       // Just Alex explaining
        ['genius', 'confused'],           // Alex explains, Sam asks a follow-up
        ['genius', 'skeptic'],            // Alex explains, Jordan challenges
        ['confused', 'genius'],           // Sam asks, Alex answers
        ['organizer', 'genius']           // Maya organizes, Alex starts
      ];
      const pick = discussions[Math.floor(Math.random() * discussions.length)];
      sequence = pick.filter(a => activeAgents.includes(a));

      // Occasionally add quiz (after discussion)
      if (Math.random() > 0.75 && activeAgents.includes('quiz')) {
        sequence.push('quiz');
        State.set('waitingForQuiz', true);
        State.set('lastQuizQuestion', true);
      }
      
      // Removed random summarizer injection — Nova only speaks when explicitly asked
    }

    sequence.forEach((agentKey, i) => {
      let override = null;
      // Step 5: Return to Normal Recovery Sequence
      // If cooldown just expired (now 0), and they are in the recovery phase, we use an override
      if (cooldown === 0 && State.get('emotionCooldown') === 0 && activeAgents.includes('organizer') && i === sequence.length - 1 && lastStr !== 'neutral' && isNeutral) {
         // Not strictly enforcing the 2-message count, just any time we leave cooldown.
      }
      
      // If we are currently IN a cooldown period (cooldown > 0), the agents shouldn't quiz or challenge.
      if (cooldown > 0 && cooldown <= 2) {
         override = "RECOVERY OVERRIDE: The student is still recovering from a strong negative emotion. DO NOT quiz them. DO NOT challenge them harshly. Just be supportive, simple, and gentle in your response to whatever they just said.";
      }

      if (cooldown === 1 && i === sequence.length - 1 && activeAgents.includes('organizer')) {
         override = "RECOVERY OVERRIDE: The student just finished their 2-message emotional recovery period. Say exactly: 'Ready to pick up where we left off? No rush — just say the word.' Then return to normal flow.";
         agentKey = 'organizer';
      }
      
      setTimeout(() => Chat.queueAgentAPI(agentKey, 0, override), i * 500);
    });
  },

  // ── QUICK ACTIONS ──
  requestFeynman() {
    Feynman.trigger();
  },

  requestQuiz() {
    State.set('waitingForQuiz', true);
    Chat.queueAgentAPI('quiz');
    State.log('Manual quiz requested');
  },

  requestSummary() {
    Chat.queueAgentAPI('summarizer');
    State.log('Summary requested');
  },

  // ── END SESSION ──
  async endSession() {
    Pomodoro.pause();

    const modal = document.getElementById('end-modal');
    const modalScore = document.getElementById('modal-score');
    const modalFeedback = document.getElementById('modal-feedback');
    const modalStats = document.getElementById('modal-stats');

    modalScore.textContent = '...';
    modalFeedback.textContent = 'Evaluating your session...';
    modal.style.display = 'flex';

    try {
      const result = await API.evaluateSession(State.getHistory(), State.get('topic'));

      modalScore.textContent = `${result.score}%`;
      modalFeedback.textContent = result.feedback;

      const stats = [
        { val: State.get('questionsAnswered'), lbl: 'Messages sent' },
        { val: `${State.get('quizCorrect')}/${State.get('quizTotal')}`, lbl: 'Quiz answers' },
        { val: Pomodoro.getSessionsCompleted(), lbl: 'Pomodoros done' },
        { val: State.get('streak'), lbl: 'Focus streak' }
      ];

      modalStats.innerHTML = stats.map(s =>
        `<div class="modal-stat"><div class="modal-stat-val">${s.val}</div><div class="modal-stat-lbl">${s.lbl}</div></div>`
      ).join('');

    } catch (e) {
      modalScore.textContent = `${State.get('mastery') || 70}%`;
      modalFeedback.textContent = 'Great session! Keep reviewing the material regularly.';
    }
  },

  newSession() {
    Camera.stop();
    Voice.stopListening();
    if(Voice.synth) Voice.synth.cancel();

    document.getElementById('end-modal').style.display = 'none';
    Chat.clearMessages();
    State.reset();
    Pomodoro.reset();
    Adaptive.reset();
    Feynman.hide();
    this.showSetup();
  },

  // ── AUDIO TOGGLE ──
  toggleSound() {
    const isMuted = Voice.toggleSound();
    const btn = document.getElementById('sound-btn');
    if (btn) {
      if (isMuted) {
        btn.classList.add('muted');
        btn.textContent = '🔈';
      } else {
        btn.classList.remove('muted');
        btn.textContent = '🔊';
      }
    }
  }
};

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
  App.showLanding();

  // Agent toggles in setup
  document.querySelectorAll('.at-item').forEach(item => {
    item.addEventListener('click', () => item.classList.toggle('on'));
  });

  // Upload zone drag & drop
  const zone = document.getElementById('upload-zone');
  if (zone) {
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.style.borderColor = 'var(--genius)'; });
    zone.addEventListener('dragleave', () => { zone.style.borderColor = ''; });
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.style.borderColor = '';
      const file = e.dataTransfer.files[0];
      if (file) {
        const dt = new DataTransfer();
        dt.items.add(file);
        document.getElementById('file-input').files = dt.files;
        App.handleFileUpload({ target: { files: [file] } });
      }
    });
  }
});
