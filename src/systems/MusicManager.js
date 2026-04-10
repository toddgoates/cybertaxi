const MUSIC_STORAGE_KEY = 'cybertaxi-music-muted';

export class MusicManager {
  constructor(sources) {
    this.sources = Array.isArray(sources) ? sources : [sources];
    this.currentTrackIndex = 0;
    this.baseVolume = 0.45;
    this.audio = new Audio(this.sources[0]);
    this.audio.loop = false;
    this.audio.volume = this.baseVolume;
    this.audio.preload = 'auto';
    this.muted = window.localStorage.getItem(MUSIC_STORAGE_KEY) === 'true';
    this.audio.muted = this.muted;
    this.paused = false;
    this.awaitingInteraction = false;
    this.volumeScale = 1;
    this.targetVolumeScale = 1;
    this.tryStartPlayback = this.tryStartPlayback.bind(this);
    this.handleKeydown = this.handleKeydown.bind(this);
    this.handleTrackEnded = this.handleTrackEnded.bind(this);
    this.audio.addEventListener('ended', this.handleTrackEnded);
  }

  start(volumeScale = 1) {
    this.volumeScale = volumeScale;
    this.targetVolumeScale = volumeScale;
    this.audio.volume = this.baseVolume * this.volumeScale;
    window.addEventListener('keydown', this.handleKeydown);
    this.tryStartPlayback();
  }

  handleKeydown(event) {
    if (event.repeat) return;
    if (event.code === 'KeyM') {
      this.toggleMute();
      return;
    }

    if (event.code === 'BracketLeft') {
      this.playPreviousTrack();
      return;
    }

    if (event.code === 'BracketRight') {
      this.playNextTrack();
    }
  }

  tryStartPlayback() {
    if (this.muted || this.paused) return;

    if (!this.audio.src && this.sources.length > 0) {
      this.audio.src = this.sources[this.currentTrackIndex];
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

  handleTrackEnded() {
    if (this.sources.length === 0) return;
    this.currentTrackIndex = (this.currentTrackIndex + 1) % this.sources.length;
    this.audio.src = this.sources[this.currentTrackIndex];
    this.audio.currentTime = 0;
    this.tryStartPlayback();
  }

  playTrack(index) {
    if (this.sources.length === 0) return;
    this.currentTrackIndex = (index + this.sources.length) % this.sources.length;
    this.audio.src = this.sources[this.currentTrackIndex];
    this.audio.currentTime = 0;
    this.tryStartPlayback();
  }

  playNextTrack() {
    this.playTrack(this.currentTrackIndex + 1);
  }

  playPreviousTrack() {
    this.playTrack(this.currentTrackIndex - 1);
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

  setVolumeScale(volumeScale) {
    this.targetVolumeScale = Math.max(0, Math.min(1, volumeScale));
  }

  update(delta) {
    this.volumeScale += (this.targetVolumeScale - this.volumeScale) * Math.min(1, delta * 2.5);
    this.audio.volume = this.baseVolume * this.volumeScale;
  }

  getState() {
    return {
      muted: this.muted,
      label: this.muted ? 'Music muted' : this.paused ? 'Music paused' : this.awaitingInteraction ? 'Music ready on input' : 'Music playing',
    };
  }
}
