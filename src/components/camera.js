// ── CAMERA & EMOTION (face-api.js) ──
const Camera = {
  active: false,
  stream: null,
  modelsLoaded: false,
  _interval: null,

  async init() {
    if (this.active) return;
    try {
      // 1. Load models from CDN
      State.log('Loading face-api models...');
      await this.loadModels();
      this.modelsLoaded = true;

      // 2. Request Camera
      State.log('Requesting camera access...');
      this.stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      
      const videoEl = document.getElementById('user-video');
      if (videoEl) {
        videoEl.srcObject = this.stream;
        videoEl.onloadedmetadata = () => {
          videoEl.play();
          this.active = true;
          this.startEmotionTracking(videoEl);
          State.log('Camera and emotion tracking active');
          document.querySelector('.you-seat').classList.add('camera-on');
        };
      }
    } catch (e) {
      console.error('Camera/Emotion init failed:', e);
      State.log(`Camera failed: ${e.message}`);
    }
  },

  async loadModels() {
    // We load lightweight models from unpkg CDN
    const MODEL_URL = 'https://unpkg.com/@vladmandic/face-api/model';
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
    ]);
  },

  startEmotionTracking(videoEl) {
    if (this._interval) clearInterval(this._interval);
    
    // Scan expressions every 2 seconds
    this._interval = setInterval(async () => {
      if (!this.active || !this.modelsLoaded) return;
      
      const detections = await faceapi.detectSingleFace(
        videoEl, 
        new faceapi.TinyFaceDetectorOptions()
      ).withFaceExpressions();

      if (detections) {
        // Find the dominant expression - heavily biased against 'neutral' to pick up subtleties
        const expressions = detections.expressions;
        let dominant = 'neutral';
        let maxScore = expressions.neutral || 0;
        
        for (const [expr, val] of Object.entries(expressions)) {
          if (expr !== 'neutral' && val > 0.15) { // If any non-neutral emotion is over 15%, it wins
            if (val > maxScore || dominant === 'neutral') {
              maxScore = val;
              dominant = expr;
            }
          }
        }
        
        // Map complex emotions
        if (dominant === 'fearful' || dominant === 'angry') {
          dominant = 'stressed';
        }
        
        // Save to state
        State.set('userEmotion', dominant);
        // Optional: update UI
        const debugEl = document.getElementById('emotion-debug');
        if (debugEl) debugEl.textContent = `${dominant} ${(maxScore * 100).toFixed(0)}%`;
      }
    }, 2000);
  },

  stop() {
    if (this._interval) clearInterval(this._interval);
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
    }
    this.active = false;
    document.querySelector('.you-seat').classList.remove('camera-on');
  }
};
