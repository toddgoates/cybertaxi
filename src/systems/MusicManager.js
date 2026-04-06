const MUSIC_STORAGE_KEY = 'cybertaxi-music-muted';

export class MusicManager {
  constructor(src) {
    this.audio = new Audio(src);
    this.audio.loop = true;
    this.audio.volume = 0.45;
    this.audio.preload = 'auto';
    this.muted = window.localStorage.getItem(MUSIC_STORAGE_KEY) === 'true';
    this.audio.muted = this.muted;
    this.paused = false;
    this.awaitingInteraction = false;
    this.tryStartPlayback = this.tryStartPlayback.bind(this);
    this.handleKeydown = this.handleKeydown.bind(this);
  }

  start() {
    window.addEventListener('keydown', this.handleKeydown);
    this.tryStartPlayback();
  }

  handleKeydown(event) {
    if (event.repeat) return;
    if (event.code !== 'KeyM') return;
    this.toggleMute();
  }

  tryStartPlayback() {
    if (this.muted || this.paused) return;

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

  addInteractionListeners() {
    window.addEventListener('pointerdown', this.tryStartPlayback, { once: true });
    window.addEventListener('keydown', this.tryStartPlayback, { once: true });
  }

  removeInteractionListeners() {
    window.removeEventListener('pointerdown', this.tryStartPlayback);
    window.removeEventListener('keydown', this.tryStartPlayback);
  }

  toggleMute() {
    this.muted = !this.muted;
    this.audio.muted = this.muted;
    window.localStorage.setItem(MUSIC_STORAGE_KEY, String(this.muted));

    if (this.muted) {
      this.awaitingInteraction = false;
      this.removeInteractionListeners();
      return;
    }

    this.tryStartPlayback();
  }

  setPaused(paused) {
    this.paused = paused;

    if (paused) {
      this.audio.pause();
      this.awaitingInteraction = false;
      this.removeInteractionListeners();
      return;
    }

    this.tryStartPlayback();
  }

  getState() {
    return {
      muted: this.muted,
      label: this.muted ? 'Music muted' : this.paused ? 'Music paused' : this.awaitingInteraction ? 'Music ready on input' : 'Music playing',
    };
  }
}
