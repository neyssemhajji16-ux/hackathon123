# 👥 StudySquad AI — Virtual Study Group

> "Khanmigo gives you a tutor. Socratic gives you answers. **StudySquad gives you a crew.**"

An AI-powered virtual study room where students learn alongside 6 AI classmates, each with a distinct personality and cognitive role.

---

## 🚀 Quick Start

1. Open `index.html` in your browser (no build step needed — pure HTML/CSS/JS)
2. Get your Anthropic API key from [console.anthropic.com](https://console.anthropic.com)
3. Enter your API key, study topic, and optionally upload your PDF lecture notes
4. Click **Enter Study Room**

---

## 📁 Project Structure

```
studysquad/
├── index.html                  # Main entry point
├── src/
│   ├── styles/
│   │   └── main.css            # All styles
│   ├── agents/
│   │   ├── prompts.js          # Agent system prompts & metadata
│   │   └── api.js              # Anthropic API integration
│   ├── components/
│   │   ├── chat.js             # Message rendering & queue
│   │   ├── avatars.js          # Avatar animations
│   │   ├── feynman.js          # Feynman explanation evaluator
│   │   └── adaptive.js         # Struggle detection & mode switching
│   └── utils/
│       ├── pdf.js              # PDF text extraction
│       ├── pomodoro.js         # Pomodoro timer
│       └── state.js            # App state management
└── README.md
```

---

## 🧠 The 6 AI Agents

| Agent | Name | Role | Color |
|-------|------|------|-------|
| 🧠 Genius | Alex | Explains concepts clearly using your PDF notes | Purple |
| 🤔 Confused | Sam | Asks simple questions, triggers Feynman moments | Teal |
| 🧐 Skeptic | Jordan | Challenges your reasoning and assumptions | Pink |
| 📋 Organizer | Maya | Manages Pomodoro cycles, detects struggle | Amber |
| 🎯 Quiz Master | Quinn | Tests knowledge with exam-style questions | Orange |
| 📝 Summarizer | Nova | Recaps discussion, tracks mastery | Cyan |

---

## ⭐ Key Features

### 1. Real AI Behind Every Agent
Each agent calls the Anthropic Claude API with a unique system prompt + your PDF context. Responses are grounded in YOUR actual course material.

### 2. Adaptive Study Group — "The AI Notices You're Struggling"
The system detects confusion patterns and automatically switches to **Deep Understanding Mode** — slower explanations, more analogies, foundational questions.

### 3. Feynman Learning Method
Sam asks you to explain the concept in simple terms. The system evaluates your explanation and shows:
- ✓ What you got right
- ⚠ What's missing
- Alex fills in the gaps

### 4. Pomodoro Timer
25-minute focus cycles with 5-minute breaks. Maya manages transitions and reacts to your streaks.

### 5. Session Mastery Score
At the end of each session, Claude evaluates your understanding and gives a 0-100 mastery score with personalized feedback.

---

## 🔧 Technical Notes

- **No backend required** — runs entirely in the browser
- **API key** — stored in memory only, never persisted
- **PDF parsing** — uses pdf.js (loaded from CDN) to extract text from uploaded PDFs
- **Context window** — last 12 messages sent to API for context
- **PDF context** — first 4000 characters injected into each agent's system prompt

---

## 🎤 Hackathon Pitch

**Problem:** Millions of students study alone without access to quality peer groups. Collaborative learning is 2x more effective than solo study.

**Solution:** StudySquad — 6 AI classmates with distinct personalities that discuss, challenge, test, and summarize your lecture material in real time.

**Differentiators vs Khanmigo & Socratic:**
1. Multi-agent social dynamics (6 personalities that interact)
2. Grounded in YOUR uploaded PDF notes
3. Adaptive mode switching based on struggle detection
4. Feynman "teach the group" method — AI evaluates your explanations
5. Pomodoro + streaks built into the product
6. Real-time mastery scoring

---

## 💡 Demo Flow for Judges

1. Upload a biology/chemistry PDF
2. Start session → 6 avatars appear in the study room
3. Alex explains the topic from the PDF content
4. Quinn asks a question → give a wrong answer intentionally
5. Watch Maya detect struggle → Deep Understanding Mode activates
6. Sam asks you to explain the concept → see the Feynman analysis card
7. Pomodoro ends → streak reaction from the group
8. End session → see mastery score

---

Built with Claude claude-sonnet-4-20250514 | Anthropic API | Pure HTML/CSS/JS
