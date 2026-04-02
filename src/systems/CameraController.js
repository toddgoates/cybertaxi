import * as THREE from 'three';

export class CameraController {
  constructor(camera, target, config) {
    this.camera = camera;
    this.target = target;
    this.config = config.camera;
    this.currentPosition = new THREE.Vector3();
    this.currentLookAt = new THREE.Vector3();
    this.camera.position.set(0, 12, 18);
    this.currentPosition.copy(this.camera.position);
  }

  update(delta, velocity) {
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.target.quaternion);
    const up = new THREE.Vector3(0, 1, 0);
    const speedLookAhead = velocity.clone().multiplyScalar(0.12);

    const desiredPosition = this.target.position
      .clone()
      .add(forward.multiplyScalar(this.config.followDistance))
      .add(up.multiplyScalar(this.config.height))
      .add(speedLookAhead);

    const desiredLookAt = this.target.position
      .clone()
      .add(new THREE.Vector3(0, 2.2, 0))
      .add(velocity.clone().multiplyScalar(0.1))
      .add(new THREE.Vector3(0, 0, -this.config.lookAhead).applyQuaternion(this.target.quaternion));

    this.currentPosition.lerp(desiredPosition, 1 - Math.exp(-this.config.damping * delta));
    this.currentLookAt.lerp(desiredLookAt, 1 - Math.exp(-this.config.damping * delta));
    this.camera.position.copy(this.currentPosition);
    this.camera.lookAt(this.currentLookAt);
  }
}
