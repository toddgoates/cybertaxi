export class InputManager {
  constructor() {
    this.keys = new Set();
    this.keyMap = {
      forward: ['KeyW', 'ArrowUp'],
      brake: ['KeyS', 'ArrowDown'],
      left: ['KeyA', 'ArrowLeft'],
      right: ['KeyD', 'ArrowRight'],
      ascend: ['KeyJ'],
      descend: ['KeyK'],
      strafeLeft: ['KeyQ'],
      strafeRight: ['KeyE'],
      boost: ['Space'],
    };

    window.addEventListener('keydown', (event) => this.keys.add(event.code));
    window.addEventListener('keyup', (event) => this.keys.delete(event.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  isDown(action) {
    return this.keyMap[action].some((code) => this.keys.has(code));
  }

  getAxis(negativeAction, positiveAction) {
    const negative = this.isDown(negativeAction) ? 1 : 0;
    const positive = this.isDown(positiveAction) ? 1 : 0;
    return positive - negative;
  }
}
