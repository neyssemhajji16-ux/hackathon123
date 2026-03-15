// ── VOICE (STT / TTS) ──
const Voice = {
  recognition: null,
  isListening: false,
  voices: [],
  synth: window.speechSynthesis,
  muted: false, // User can toggle AI voices

  init() {
    // 1. Setup Speech-to-Text (User Dictation)
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      
      this.recognition.onresult = (event) => {
        let text = '';
        for (let i = 0; i < event.results.length; i++) {
          text += event.results[i][0].transcript;
        }
        const input = document.getElementById('chat-input');
        if (input) input.value = text;
      };

      this.recognition.onstart = () => {
        this.isListening = true;
        document.getElementById('mic-btn')?.classList.add('recording');
      };

      this.recognition.onend = () => {
        this.isListening = false;
        document.getElementById('mic-btn')?.classList.remove('recording');
      };

      this.recognition.onerror = (e) => {
        console.error('Speech recognition error:', e.error);
        this.stopListening();
      };
    } else {
      console.warn('SpeechRecognition API not supported in this browser.');
    }

    // 2. Setup Text-to-Speech (Agent Voices)
    this._loadVoices();
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = this._loadVoices.bind(this);
    }
  },

  _loadVoices() {
    this.voices = this.synth.getVoices();
  },

  toggleListening() {
    if (!this.recognition) return alert('Speech recognition not supported in your browser.');
    if (this.isListening) {
      this.stopListening();
    } else {
      this.startListening();
    }
  },

  startListening() {
    if (this.recognition && !this.isListening) {
      try {
        // Clear input before starting
        const input = document.getElementById('chat-input');
        if (input && input.value === '') input.placeholder = 'Listening...';
        this.recognition.start();
      } catch (e) {
        console.warn('Could not start recording:', e);
      }
    }
  },

  stopListening() {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
      const input = document.getElementById('chat-input');
      if (input) input.placeholder = 'Type your answer, question or explanation...';
    }
  },

  // ── TTS ──
  _queue: [],
  _isSpeaking: false,

  async speak(agentKey, text) {
    if (this.muted) return Promise.resolve();
    if (!this.synth || this.voices.length === 0) return Promise.resolve();

    return new Promise((resolve) => {
      this._queue.push({ agentKey, text, resolve });
      this._processQueue();
    });
  },

  async _processQueue() {
    if (this._isSpeaking || this._queue.length === 0) return;
    
    this._isSpeaking = true;
    const { agentKey, text, resolve } = this._queue.shift();

    // Clean text of markdown/emojis before speaking
    const cleanText = text.replace(/[\*\_`#\[\]]/g, '').replace(/(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g, '');
    
    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    // Assign a predictable voice based on agentKey
    // (fallback to standard voices if specific ones aren't found)
    let assignedVoice = this.voices[0];
    const enVoices = this.voices.filter(v => v.lang.startsWith('en'));
    if (enVoices.length > 0) {
      // Crude hashing to pick a consistent voice index per agent
      const idx = agentKey.charCodeAt(0) % enVoices.length;
      assignedVoice = enVoices[idx];
      
      // Attempt to assign gendered/style voices if recognizable names exist (like Google UK/US)
      if (agentKey === 'genius') {
        const maleVoice = enVoices.find(v => v.name.toLowerCase().includes('male') || v.name.includes('David'));
        if (maleVoice) assignedVoice = maleVoice;
      } else if (agentKey === 'confused' || agentKey === 'organizer') {
        const femaleVoice = enVoices.find(v => v.name.toLowerCase().includes('female') || v.name.includes('Zira'));
        if (femaleVoice) assignedVoice = femaleVoice;
      }
    }

    utterance.voice = assignedVoice;
    utterance.rate = 1.05; // Slightly faster for natural flow
    utterance.pitch = (agentKey.charCodeAt(agentKey.length - 1) % 10) / 10 + 0.5; // Random pitch 0.5 - 1.5

    utterance.onend = () => {
      this._isSpeaking = false;
      resolve();
      this._processQueue();
    };

    utterance.onerror = () => {
      this._isSpeaking = false;
      resolve();
      this._processQueue();
    };

    this.synth.speak(utterance);
  },

  toggleSound() {
    this.muted = !this.muted;
    if (this.muted) {
      this.synth.cancel(); // Stop talking immediately
      this._queue.forEach(q => q.resolve());
      this._queue = [];
      this._isSpeaking = false;
    }
    return this.muted;
  }
};
