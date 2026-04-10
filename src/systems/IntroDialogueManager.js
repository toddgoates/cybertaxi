export class IntroDialogueManager {
  constructor(sources, gapMs = 2000) {
    this.sources = sources;
    this.gapMs = gapMs;
    this.audio = new Audio();
    this.audio.preload = 'auto';
    this.audio.volume = 0.92;
    this.currentIndex = 0;
    this.started = false;
    this.completed = false;
    this.paused = false;
    this.awaitingInteraction = false;
    this.gapTimer = null;
    this.resumeFromGap = false;

    this.tryStartPlayback = this.tryStartPlayback.bind(this);
    this.handleEnded = this.handleEnded.bind(this);
  }

  start(onComplete = null) {
    if (this.started || this.completed || this.sources.length === 0) return;
    this.started = true;
    this.onComplete = onComplete;
    this.audio.addEventListener('ended', this.handleEnded);
    this.tryStartPlayback();
  }

  tryStartPlayback() {
    if (!this.started || this.completed || this.paused) return;

    if (!this.audio.src) {
      this.audio.src = this.sources[this.currentIndex];
    }

    this.audio.play()
      .then(() => {
        this.awaitingInteraction = false;
        this.removeInteractionListeners();
      })
      .catch(() => {
        this.awaitingInteraction = true;
        this.addInteractionListeners();
      });
  }

  handleEnded() {
    if (this.completed) return;

    this.currentIndex += 1;
    if (this.currentIndex >= this.sources.length) {
      this.finish();
      return;
    }

    this.audio.removeAttribute('src');
    this.audio.load();
    this.resumeFromGap = true;
    this.gapTimer = window.setTimeout(() => {
      this.gapTimer = null;
      this.resumeFromGap = false;
      this.audio.src = this.sources[this.currentIndex];
      this.tryStartPlayback();
    }, this.gapMs);
  }

  setPaused(paused) {
    this.paused = paused;

    if (paused) {
      if (this.gapTimer) {
        window.clearTimeout(this.gapTimer);
        this.gapTimer = null;
        this.resumeFromGap = true;
      }
      this.audio.pause();
      return;
    }

    if (this.completed || !this.started) return;

    if (this.resumeFromGap) {
      this.resumeFromGap = false;
      this.gapTimer = window.setTimeout(() => {
        this.gapTimer = null;
        this.audio.src = this.sources[this.currentIndex];
        this.tryStartPlayback();
      }, this.gapMs);
      return;
    }

    this.tryStartPlayback();
  }

  addInteractionListeners() {
    window.addEventListener('pointerdown', this.tryStartPlayback, { once: true });
    window.addEventListener('keydown', this.tryStartPlayback, { once: true });
  }

  removeInteractionListeners() {
    window.removeEventListener('pointerdown', this.tryStartPlayback);
    window.removeEventListener('keydown', this.tryStartPlayback);
  }

  finish() {
    this.completed = true;
    this.awaitingInteraction = false;
    this.removeInteractionListeners();
    this.audio.removeEventListener('ended', this.handleEnded);
    if (this.onComplete) {
      this.onComplete();
    }
  }
}
