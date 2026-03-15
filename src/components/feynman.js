// ── FEYNMAN COMPONENT ──
const Feynman = {

  // Trigger Sam to ask the student to explain
  trigger() {
    State.set('waitingForFeynman', true);
    State.increment('feynmanCount');

    Chat.queueAgentMessage('confused',
      `Hey, I'm still a bit confused about ${State.get('topic')}. Can you explain it to me like I've never heard of it before? Use a simple example if you can! 🙏`
    );
    State.log('Feynman trigger — waiting for student explanation');
  },

  // Evaluate student's explanation and show analysis card
  async evaluate(studentText) {
    State.set('waitingForFeynman', false);

    // Show loading card
    const card = document.getElementById('feynman-card');
    const body = document.getElementById('feynman-body');
    card.style.display = 'block';
    body.innerHTML = '<div style="color:var(--mu);font-size:12px">📊 Analyzing your explanation...</div>';

    try {
      const result = await API.evaluateExplanation(
        studentText,
        State.get('topic'),
        State.get('pdfContext')
      );

      if (!result) {
        card.style.display = 'none';
        return;
      }

      // Render the analysis card
      let html = '';

      if (result.correct && result.correct.length > 0) {
        result.correct.forEach(point => {
          html += `<div class="fc-item"><span class="fc-ok">✓</span> ${point}</div>`;
        });
      }

      if (result.good_analogy) {
        html += `<div class="fc-item"><span class="fc-ok">✓</span> Good analogy used</div>`;
      }

      if (result.missing && result.missing.length > 0) {
        result.missing.forEach(point => {
          html += `<div class="fc-item"><span class="fc-miss">⚠</span> Missing: ${point}</div>`;
        });
      }

      html += `<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--bd);font-size:11px;color:var(--mu)">
        Explanation score: <strong style="color:var(--confused);font-family:var(--mono)">${result.score}/100</strong>
      </div>`;

      body.innerHTML = html;

      // Update mastery
      const masteryBoost = (result.score / 100) * 15;
      State.updateMastery(Math.min(100, State.get('mastery') + masteryBoost));
      State.log(`Feynman evaluation: ${result.score}/100`);

      // Genius responds with what's missing
      if (result.missing && result.missing.length > 0) {
        setTimeout(() => {
          Chat.queueAgentMessage('genius',
            `Great explanation! Just one thing to add — ${result.improvement || result.missing[0]}. That's what makes it complete.`
          );
        }, 1500);
      } else {
        setTimeout(() => {
          Chat.queueAgentMessage('genius',
            `Really solid explanation! You clearly understand the core concept. ${result.score >= 80 ? "That's exam-ready." : "Keep building on this."}`
          );
        }, 1500);
      }

    } catch (e) {
      card.style.display = 'none';
      console.error('Feynman eval error:', e);
    }
  },

  hide() {
    const card = document.getElementById('feynman-card');
    if (card) card.style.display = 'none';
  }
};
