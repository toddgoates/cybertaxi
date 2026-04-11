export class VoiceoverManager {
  constructor() {
    this.audio = new Audio();
    this.audio.preload = 'auto';
    this.audio.volume = 0.96;
    this.paused = false;
    this.awaitingInteraction = false;
    this.currentEntry = null;
    this.onStart = null;
    this.onComplete = null;

    this.tryStartPlayback = this.tryStartPlayback.bind(this);
    this.handleEnded = this.handleEnded.bind(this);
    this.audio.addEventListener('ended', this.handleEnded);
  }

  play(entry, { onStart = null, onComplete = null } = {}) {
    this.currentEntry = entry;
    this.onStart = onStart;
    this.onComplete = onComplete;
    this.audio.src = entry.audio;
    this.audio.currentTime = 0;
    if (this.onStart) {
      this.onStart(entry);
    }
    this.tryStartPlayback();
  }

  tryStartPlayback() {
    if (!this.currentEntry || this.paused) return;

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
    const entry = this.currentEntry;
    this.currentEntry = null;
    this.awaitingInteraction = false;
    this.removeInteractionListeners();
    if (this.onComplete) {
      this.onComplete(entry);
    }
    this.onStart = null;
    this.onComplete = null;
  }

  setPaused(paused) {
    this.paused = paused;
    if (paused) {
      this.audio.pause();
      return;
    }
    this.tryStartPlayback();
  }

  isActive() {
    return this.currentEntry !== null;
  }

  addInteractionListeners() {
    window.addEventListener('pointerdown', this.tryStartPlayback, { once: true });
    window.addEventListener('keydown', this.tryStartPlayback, { once: true });
  }

  removeInteractionListeners() {
    window.removeEventListener('pointerdown', this.tryStartPlayback);
    window.removeEventListener('keydown', this.tryStartPlayback);
  }
}
