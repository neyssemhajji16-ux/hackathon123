// ── CHAT COMPONENT ──
const Chat = {
  _queue: [],
  _processing: false,

  // Add a message to the display
  addMessage(role, content, agentKey = null) {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    const div = document.createElement('div');
    div.className = `msg ${agentKey || role}`;

    let avHtml, metaHtml;

    if (role === 'user') {
      const studentName = State.get('studentName') || 'You';
      div.classList.add('you');
      avHtml = `<div class="msg-av" style="--msg-c:#7c6fff">👤</div>`;
      metaHtml = `<div class="msg-meta">${studentName}</div>`;
    } else if (agentKey && AGENTS[agentKey]) {
      const a = AGENTS[agentKey];
      avHtml = `<div class="msg-av" style="--msg-c:${a.color}">${a.emoji}</div>`;
      metaHtml = `<div class="msg-meta">${a.name} · ${a.role}</div>`;
    } else {
      avHtml = `<div class="msg-av">💬</div>`;
      metaHtml = `<div class="msg-meta">System</div>`;
    }

    div.innerHTML = `
      ${avHtml}
      <div class="msg-body">
        ${metaHtml}
        <div class="msg-bubble">${this._formatText(content)}</div>
      </div>`;

    container.appendChild(div);
    container.scrollTop = container.scrollHeight;

    // Activate avatar
    if (agentKey) Avatars.setSpeaking(agentKey, content.slice(0, 30));
    return div;
  },

  // Show typing indicator
  showTyping(agentKey) {
    const container = document.getElementById('chat-messages');
    if (!container) return null;

    const a = AGENTS[agentKey];
    const id = `typing-${agentKey}-${Date.now()}`;
    const div = document.createElement('div');
    div.id = id;
    div.className = `msg ${agentKey}`;
    div.innerHTML = `
      <div class="msg-av" style="--msg-c:${a.color}">${a.emoji}</div>
      <div class="msg-body">
        <div class="msg-meta">${a.name} is typing...</div>
        <div class="typing-bubble" style="--msg-c:${a.color}">
          <div class="td"></div><div class="td"></div><div class="td"></div>
        </div>
      </div>`;

    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    Avatars.setSpeaking(agentKey, '...');
    return id;
  },

  removeTyping(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
    Avatars.clearSpeaking();
  },

  // Queue an agent message (with typing delay)
  queueAgentMessage(agentKey, text) {
    this._queue.push({ agentKey, text, type: 'direct' });
    this._processQueue();
  },

  // Queue an API-generated agent message
  queueAgentAPI(agentKey, delay = 0, emotionScript = null) {
    this._queue.push({ agentKey, delay, emotionScript, type: 'api' });
    this._processQueue();
  },

  async _processQueue() {
    if (this._processing || this._queue.length === 0) return;
    this._processing = true;

    while (this._queue.length > 0) {
      const item = this._queue.shift();
      await this._deliverMessage(item);
    }

    this._processing = false;
    // Re-enable input after all messages delivered
    const inp = document.getElementById('chat-input');
    const btn = document.getElementById('send-btn');
    if (inp) inp.disabled = false;
    if (btn) btn.disabled = false;
    if (inp) inp.focus();
  },

  async _deliverMessage(item) {
    const baseDelay = item.delay || 800;
    await this._sleep(baseDelay);

    const typingId = this.showTyping(item.agentKey);
    const thinkDelay = 1200 + Math.random() * 800;
    await this._sleep(thinkDelay);

    let text = item.text;

    if (item.type === 'api') {
      try {
        text = await API.callAgent(
          item.agentKey,
          State.getHistory(),
          State.get('pdfContext'),
          State.get('topic'),
          State.get('mode'),
          item.emotionScript
        );
      } catch (e) {
        text = `[${AGENTS[item.agentKey].name} is thinking... API error: ${e.message}]`;
      }
    }

    this.removeTyping(typingId);

    if (text) {
      this.addMessage('agent', text, item.agentKey);
      // Add to history as assistant message
      State.addToHistory('assistant', `[${AGENTS[item.agentKey].name}]: ${text}`);
      State.log(`${AGENTS[item.agentKey].name} responded`);
      
      // Speak the response using Text-to-Speech and WAIT for it to finish
      await Voice.speak(item.agentKey, text);
    }

    await this._sleep(400);
  },

  _sleep(ms) { return new Promise(r => setTimeout(r, ms)); },

  _formatText(text) {
    // Basic markdown-like formatting
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code style="background:#1f2038;padding:1px 5px;border-radius:4px;font-family:var(--mono);font-size:11px">$1</code>')
      .replace(/\n/g, '<br>');
  },

  clearMessages() {
    const container = document.getElementById('chat-messages');
    if (container) container.innerHTML = '';
    this._queue = [];
    this._processing = false;
  }
};
