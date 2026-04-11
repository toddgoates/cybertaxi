export class PerformanceOverlay {
  constructor(mount) {
    this.root = document.createElement('div');
    this.root.className = 'perf-overlay';
    mount.appendChild(this.root);
    this.elapsed = 0;
  }

  update(delta, snapshot) {
    this.elapsed += delta;
    if (this.elapsed < 0.5) return;
    this.elapsed = 0;

    this.root.textContent = [
      `scene: ${snapshot.sceneChildren}`,
      `geo: ${snapshot.geometries}`,
      `tex: ${snapshot.textures}`,
      `calls: ${snapshot.drawCalls}`,
      `triangles: ${snapshot.triangles}`,
      `traffic: ${snapshot.traffic}`,
      `rivals: ${snapshot.rivals}`,
      `effects: ${snapshot.effects}`,
      `voice: ${snapshot.voiceActive ? 'on' : 'off'}`,
    ].join(' | ');
  }

  destroy() {
    this.root.remove();
  }
}
