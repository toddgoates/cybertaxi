import * as THREE from 'three';

const ZERO_VECTOR = new THREE.Vector3();

export function seek(position, target, maxSpeed, out) {
  return out.copy(target).sub(position).setLength(maxSpeed);
}

export function arrive(position, target, maxSpeed, slowRadius, out) {
  out.copy(target).sub(position);
  const distance = out.length();
  if (distance === 0) return out.set(0, 0, 0);
  const desiredSpeed = distance < slowRadius ? maxSpeed * (distance / slowRadius) : maxSpeed;
  return out.multiplyScalar(desiredSpeed / distance);
}

export function pursue(position, targetPosition, targetVelocity, leadTime, maxSpeed, out) {
  const futureTarget = _futureTarget.copy(targetVelocity).multiplyScalar(leadTime).add(targetPosition);
  return seek(position, futureTarget, maxSpeed, out);
}

export function separation(agent, neighbors, desiredDistance, out) {
  out.set(0, 0, 0);
  let count = 0;

  neighbors.forEach((neighbor) => {
    if (neighbor === agent || !neighbor.active) return;
    const distanceSq = agent.position.distanceToSquared(neighbor.position);
    if (distanceSq === 0 || distanceSq > desiredDistance * desiredDistance) return;
    out.add(_offset.copy(agent.position).sub(neighbor.position).multiplyScalar(1 / distanceSq));
    count += 1;
  });

  if (count === 0) return out;
  return out.multiplyScalar(1 / count).setLength(agent.maxSpeed);
}

export function avoidStaticColliders(position, colliders, clearance, out) {
  out.set(0, 0, 0);
  let hits = 0;

  for (let i = 0; i < colliders.length; i += 1) {
    const collider = colliders[i];
    const closestX = THREE.MathUtils.clamp(position.x, collider.min.x, collider.max.x);
    const closestY = THREE.MathUtils.clamp(position.y, collider.min.y, collider.max.y);
    const closestZ = THREE.MathUtils.clamp(position.z, collider.min.z, collider.max.z);
    _closestPoint.set(closestX, closestY, closestZ);
    const distanceSq = _closestPoint.distanceToSquared(position);
    if (distanceSq > clearance * clearance) continue;

    _push.copy(position).sub(_closestPoint);
    if (_push.lengthSq() === 0) {
      _push.set(position.x - (collider.min.x + collider.max.x) * 0.5, 0, position.z - (collider.min.z + collider.max.z) * 0.5);
    }
    _push.y *= 0.35;
    out.add(_push.normalize().multiplyScalar(1 - Math.sqrt(distanceSq) / clearance));
    hits += 1;
    if (hits >= 3) break;
  }

  if (hits === 0) return out;
  return out.multiplyScalar(1 / hits).setLength(Math.max(6, clearance * 0.8));
}

export function steer(currentVelocity, desiredVelocity, maxForce, out) {
  out.copy(desiredVelocity).sub(currentVelocity);
  if (out.lengthSq() > maxForce * maxForce) {
    out.setLength(maxForce);
  }
  return out;
}

export function combine(weightedForces, out) {
  out.set(0, 0, 0);
  weightedForces.forEach(({ force, weight }) => {
    if (force === ZERO_VECTOR || weight === 0) return;
    out.addScaledVector(force, weight);
  });
  return out;
}

const _futureTarget = new THREE.Vector3();
const _offset = new THREE.Vector3();
const _closestPoint = new THREE.Vector3();
const _push = new THREE.Vector3();
