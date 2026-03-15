// ── MISTRAL API ──
const API = {

  // Sanitize conversation history for Mistral: ensure alternating roles and ends with 'user'
  _prepareMessages(systemPrompt, conversationHistory) {
    const messages = [{ role: 'system', content: systemPrompt }];
    const history = conversationHistory.slice(-12);

    // Merge consecutive same-role messages and ensure proper alternation
    let lastRole = 'system';
    for (const msg of history) {
      const role = msg.role === 'user' ? 'user' : 'assistant';
      if (role === lastRole && messages.length > 1) {
        // Merge into previous message
        messages[messages.length - 1].content += '\n' + msg.content;
      } else {
        messages.push({ role, content: msg.content });
        lastRole = role;
      }
    }

    // Mistral requires last message to be 'user' — if it's assistant, add a prompt
    if (messages.length <= 1 || messages[messages.length - 1].role !== 'user') {
      messages.push({ role: 'user', content: 'Please respond in character based on the conversation so far.' });
    }

    return messages;
  },

  async callAgent(agentKey, conversationHistory, pdfContext, topic, mode = 'normal', emotionScript = null) {
    const apiKey = State.get('apiKey');
    if (!apiKey) throw new Error('No API key set');

    const agent = AGENTS[agentKey];
    const basePrompt = AGENT_PROMPTS[agentKey];

    // Build context-aware system prompt
    let systemPrompt = basePrompt;
    systemPrompt += `\n\nCurrent study topic: ${topic}`;
    systemPrompt += `\nStudent's Name: ${State.get('studentName') || 'Student'}. Address the student by name occasionally.`;

    if (pdfContext) {
      systemPrompt += `\n\nCourse material (from uploaded PDF — base your responses on this):\n${pdfContext}`;
    }

    if (emotionScript) {
      // OVERRIDE MODE: If an emotion script is provided, pre-empt the normal persona and enforce this rule
      systemPrompt += `\n\n═══════════════════════════════════════════\nEMOTION OVERRIDE DIRECTIVE:\n${emotionScript}\n═══════════════════════════════════════════`;
    } else {
      // Normal emotion awareness block
      const emotion = State.get('userEmotion');
      if (emotion && emotion !== 'neutral') {
        systemPrompt += `\n\n[SYSTEM NOTE: The user's face currently shows they are feeling: ${emotion.toUpperCase()}. Acknowledge this naturally if it fits the context, or adjust your tone.]`;
      }
    }

    if (mode === 'deep') {
      systemPrompt += `\n\nIMPORTANT: The student is currently in DEEP UNDERSTANDING MODE — they are struggling. Slow down significantly. Use simpler language, more analogies, and check understanding frequently.`;
    }

    const messages = this._prepareMessages(systemPrompt, conversationHistory);

    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        max_tokens: 300,
        messages: messages
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || err.error?.message || `API error ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  },

  // ── EMOTIONAL INTELLIGENCE ENGINE ──
  async analyzeEmotion(lastMessage) {
    const apiKey = State.get('apiKey');
    if (!apiKey) return { emotion: "NEUTRAL", intensity: "low" };

    const cameraEmotion = State.get('userEmotion') || 'neutral';
    
    const prompt = `You are the EMOTIONAL INTELLIGENCE ENGINE of StudySquad AI.
Analyze the student's message AND physical expression to classify into ONE final emotional state.

SAD        → "I can't do this", "I give up", physical sadness or crying
CONFUSED   → genuinely lost, "I don't get it", physical confusion 
HAPPY      → "I got it!", breakthrough moment, physical smiling
STRESSED   → "exam tomorrow", time pressure, anxiety, physical tension/fear
FRUSTRATED → "this makes no sense", repeated failure, physical anger
TIRED      → "I'm exhausted", "can't focus", physical fatigue
CONFIDENT  → strong correct answers, teaching tone
NEUTRAL    → no strong emotion — do NOT trigger any emotional reaction

Also classify intensity: low | medium | high. 

CRITICAL RULE: If the Student Physical Expression indicates distress (SAD, STRESSED, FRUSTRATED, TIRED) or breakthrough (HAPPY), you MUST output that emotion as the final emotion AND set intensity to 'medium' or 'high', EVEN IF the text message is completely neutral, short, or blank (like "okay", "yeah", "hmm").

Student Message Text: "${lastMessage}"
Student Physical Expression (from Camera): "${cameraEmotion.toUpperCase()}"

Return this exact JSON format:
{
  "emotion": "SAD|CONFUSED|HAPPY|STRESSED|FRUSTRATED|TIRED|CONFIDENT|NEUTRAL",
  "intensity": "low|medium|high",
  "trigger": "one sentence explaining why based on text and expression"
}`;

    try {
      const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'mistral-small-latest',
          response_format: { type: "json_object" },
          max_tokens: 150,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      const data = await response.json();
      const text = data.choices[0]?.message?.content || '{}';
      return JSON.parse(text);
    } catch (e) {
      console.error("Emotion analysis failed:", e);
      return { emotion: "NEUTRAL", intensity: "low", trigger: "error" };
    }
  },

  // Detect if student is struggling — lightweight classification call
  async detectStruggle(lastStudentMessage, lastAgentMessages, topic) {
    const apiKey = State.get('apiKey');
    if (!apiKey) return { struggling: false };

    const prompt = `You are an educational AI monitoring a student's understanding.

Topic: ${topic}
Student's recent message: "${lastStudentMessage}"
Recent agent responses showed: ${lastAgentMessages}

Is this student showing signs of confusion or struggle?
Respond with JSON only: {"struggling": true/false, "reason": "brief reason", "weak_area": "specific concept if struggling"}`;

    try {
      const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'mistral-small-latest',
          max_tokens: 100,
          messages: [
            { role: 'user', content: prompt }
          ]
        })
      });

      const data = await response.json();
      const text = data.choices[0]?.message?.content || '{}';
      const clean = text.replace(/```json|```/g, '').trim();
      return JSON.parse(clean);
    } catch (e) {
      return { struggling: false };
    }
  },

  // Evaluate student's Feynman explanation
  async evaluateExplanation(studentExplanation, topic, pdfContext) {
    const apiKey = State.get('apiKey');
    if (!apiKey) return null;

    const prompt = `A student explained "${topic}" in their own words. Evaluate their explanation.

Student's explanation: "${studentExplanation}"
${pdfContext ? `Course material: ${pdfContext.slice(0, 800)}` : ''}

Evaluate and respond with JSON only:
{
  "correct": ["list of correct points"],
  "good_analogy": true/false,
  "missing": ["list of missing/incomplete points"],
  "score": 0-100,
  "improvement": "one sentence on what to add"
}`;

    try {
      const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'mistral-small-latest',
          max_tokens: 300,
          messages: [
            { role: 'user', content: prompt }
          ]
        })
      });

      const data = await response.json();
      const text = data.choices[0]?.message?.content || '{}';
      const clean = text.replace(/```json|```/g, '').trim();
      return JSON.parse(clean);
    } catch (e) {
      return null;
    }
  },

  // End of session mastery evaluation
  async evaluateSession(conversationHistory, topic) {
    const apiKey = State.get('apiKey');
    if (!apiKey) return { score: 70, feedback: 'Good session! Keep reviewing the material.' };

    const convoSummary = conversationHistory
      .filter(m => m.role === 'user')
      .map(m => m.content)
      .join(' | ')
      .slice(0, 1000);

    const prompt = `Based on this study session on "${topic}", evaluate the student's understanding.

Student responses during session: ${convoSummary}

Respond with JSON only:
{
  "score": 0-100,
  "feedback": "2-3 sentence assessment",
  "strong_areas": ["what they understood well"],
  "review_areas": ["what to review"]
}`;

    try {
      const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'mistral-small-latest',
          max_tokens: 300,
          messages: [
            { role: 'user', content: prompt }
          ]
        })
      });

      const data = await response.json();
      const text = data.choices[0]?.message?.content || '{}';
      const clean = text.replace(/```json|```/g, '').trim();
      return JSON.parse(clean);
    } catch (e) {
      return { score: 70, feedback: 'Good session! Keep reviewing the material.', strong_areas: [], review_areas: [] };
    }
  }
};
