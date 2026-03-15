// ── AVATARS COMPONENT ──
const Avatars = {
  _speakingTimeout: null,

  setSpeaking(agentKey, previewText = '') {
    // Clear all speaking states
    this.clearSpeaking();

    const seat = document.getElementById(`av-${agentKey}`);
    const bubble = document.getElementById(`bubble-${agentKey}`);
    const listItem = document.querySelector(`.al-item[data-agent="${agentKey}"]`);

    if (seat) seat.classList.add('speaking');
    if (bubble && previewText) bubble.textContent = previewText + '...';
    if (listItem) listItem.classList.add('speaking');

    // Auto-clear after animation
    this._speakingTimeout = setTimeout(() => this.clearSpeaking(), 3500);
  },

  clearSpeaking() {
    if (this._speakingTimeout) clearTimeout(this._speakingTimeout);
    document.querySelectorAll('.avatar-seat.speaking, .nova-seat.speaking').forEach(el => {
      el.classList.remove('speaking');
    });
    document.querySelectorAll('.al-item.speaking').forEach(el => {
      el.classList.remove('speaking');
    });
    document.querySelectorAll('.av-bubble').forEach(el => {
      el.textContent = '';
    });
  },

  // Build the agent list in sidebar
  buildAgentList(activeAgents) {
    const container = document.getElementById('agent-list');
    if (!container) return;
    container.innerHTML = '';

    activeAgents.forEach(key => {
      const a = AGENTS[key];
      const item = document.createElement('div');
      item.className = 'al-item';
      item.dataset.agent = key;
      item.style.setProperty('--ac', a.color);
      item.innerHTML = `
        <div class="al-dot" style="background:${a.color}"></div>
        <div class="al-name">${a.emoji} ${a.name}</div>
        <div class="al-role">${a.role}</div>`;
      container.appendChild(item);
    });
  },

  flashModeChange() {
    const flash = document.createElement('div');
    flash.className = 'mode-flash';
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 2000);
  }
};
