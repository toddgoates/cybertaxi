export class InputManager {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set();
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
      emp: ['KeyL'],
      superBoost: ['KeyP'],
      pause: ['Escape'],
    };

    this.handleKeyDown = (event) => {
      if (!this.keys.has(event.code)) {
        this.pressed.add(event.code);
      }
      this.keys.add(event.code);
    };
    this.handleKeyUp = (event) => this.keys.delete(event.code);
    this.handleBlur = () => {
      this.keys.clear();
      this.pressed.clear();
    };
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);
  }

  isDown(action) {
    return this.keyMap[action].some((code) => this.keys.has(code));
  }

  getAxis(negativeAction, positiveAction) {
    const negative = this.isDown(negativeAction) ? 1 : 0;
    const positive = this.isDown(positiveAction) ? 1 : 0;
    return positive - negative;
  }

  consumePress(action) {
    const codes = this.keyMap[action] || [];
    const pressedCode = codes.find((code) => this.pressed.has(code));
    if (!pressedCode) return false;
    this.pressed.delete(pressedCode);
    return true;
  }

  destroy() {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
  }
}
