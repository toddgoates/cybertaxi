import * as THREE from 'three';

export class HeatSystem {
  constructor(config) {
    this.config = config;
    this.heat = 0;
    this.timeSurvived = 0;
    this.lastCredits = 0;
    this.lastCompletedFares = 0;
    this.lastPerfectFares = 0;
    this.recentCollisionTimer = 0;
    this.lastTier = 0;
  }

  update(delta, player, missionState) {
    this.timeSurvived += delta;
    this.recentCollisionTimer = Math.max(0, this.recentCollisionTimer - delta);

    this.addHeat(delta * this.config.timeGainPerSecond);

    const earnedCredits = Math.max(0, missionState.totalCredits - this.lastCredits);
    if (earnedCredits > 0) {
      this.addHeat(earnedCredits * this.config.creditsGainFactor);
    }

    const completedDelta = Math.max(0, missionState.completedFares - this.lastCompletedFares);
    if (completedDelta > 0) {
      this.addHeat(completedDelta * this.config.fareCompletionGain);
    }

    const perfectDelta = Math.max(0, missionState.perfectFares - this.lastPerfectFares);
    if (perfectDelta > 0) {
      this.addHeat(perfectDelta * this.config.perfectFareBonus);
    }

    const speedRatio = Math.min(Math.abs(player.forwardSpeed) / this.config.referenceSpeed, 1.8);
    if (speedRatio > this.config.speedPressureThreshold) {
      this.addHeat((speedRatio - this.config.speedPressureThreshold) * this.config.speedGainPerSecond * delta);
    }

    const isPlayingSafe = missionState.phase === 'pickup' && speedRatio < 0.45 && this.recentCollisionTimer === 0;
    if (isPlayingSafe) {
      this.addHeat(-this.config.safeDecayPerSecond * delta);
    } else {
      this.addHeat(-this.config.baseDecayPerSecond * delta);
    }

    this.lastCredits = missionState.totalCredits;
    this.lastCompletedFares = missionState.completedFares;
    this.lastPerfectFares = missionState.perfectFares;
  }

  addHeat(amount) {
    this.heat = THREE.MathUtils.clamp(this.heat + amount, 0, this.config.maxHeat);
  }

  recordCollision(severity = 1) {
    this.recentCollisionTimer = 5;
    this.addHeat(this.config.collisionGain * severity);
  }

  setHeat(value) {
    this.heat = THREE.MathUtils.clamp(value, 0, this.config.maxHeat);
    this.lastTier = this.getTier();
  }

  getTier() {
    return Math.floor(this.heat);
  }

  consumeTierChange() {
    const currentTier = this.getTier();
    if (currentTier === this.lastTier) return null;
    const previousTier = this.lastTier;
    this.lastTier = currentTier;
    return { previousTier, currentTier, heat: this.heat };
  }

  getState() {
    return {
      heat: Number(this.heat.toFixed(2)),
      tier: this.getTier(),
      intensity: this.heat / this.config.maxHeat,
    };
  }
}
