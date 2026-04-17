import * as THREE from 'three';
import { HeatSystem } from './HeatSystem.js';
import { RivalTaxiAgent } from './RivalTaxiAgent.js';
import { SpawnSystem } from './SpawnSystem.js';

function getHeatProfile(heat) {
  if (heat >= 10) {
    return {
      desiredCount: 50,
      spawnInterval: 1.15,
      aggression: 0.98,
      speed: 122,
      force: 72,
      collisionPenalty: 30,
      collisionStrength: 0.56,
      behaviors: ['swarm', 'rammer', 'interceptor', 'blocker', 'chaser'],
    };
  }

  if (heat >= 9) {
    return {
      desiredCount: 20,
      spawnInterval: 1.3,
      aggression: 0.96,
      speed: 118,
      force: 68,
      collisionPenalty: 28,
      collisionStrength: 0.52,
      behaviors: ['swarm', 'rammer', 'interceptor', 'blocker', 'chaser'],
    };
  }

  if (heat >= 6) {
    return {
      desiredCount: 12,
      spawnInterval: 1.65,
      aggression: 0.8,
      speed: 102,
      force: 54,
      collisionPenalty: 23,
      collisionStrength: 0.45,
      behaviors: ['swarm', 'interceptor', 'rammer', 'blocker', 'chaser'],
    };
  }

  if (heat >= 3) {
    return {
      desiredCount: 6,
      spawnInterval: 2.25,
      aggression: 0.58,
      speed: 88,
      force: 42,
      collisionPenalty: 18,
      collisionStrength: 0.38,
      behaviors: ['interceptor', 'blocker', 'chaser', 'rammer'],
    };
  }

  if (heat >= 1) {
    return {
      desiredCount: 3,
      spawnInterval: 3.1,
      aggression: 0.34,
      speed: 72,
      force: 28,
      collisionPenalty: 15,
      collisionStrength: 0.32,
      behaviors: ['chaser', 'interceptor'],
    };
  }

  return {
    desiredCount: 0,
    spawnInterval: 999,
    aggression: 0.2,
    speed: 68,
    force: 22,
    collisionPenalty: 14,
    collisionStrength: 0.3,
    behaviors: ['chaser'],
  };
}

export class RivalTaxiManager {
  constructor(scene, config, worldData, ui) {
    this.scene = scene;
    this.config = config.rivals;
    this.worldConfig = config;
    this.worldData = worldData;
    this.ui = ui;
    this.heatSystem = new HeatSystem({ ...this.config.heat, referenceSpeed: config.player.maxForwardSpeed });
    this.spawnSystem = new SpawnSystem(this.config.spawn, config, worldData.colliders);
    this.agents = Array.from({ length: this.config.poolSize }, () => new RivalTaxiAgent(scene, worldData.colliders, this.config.agent));
    this.spawnCooldown = 2;
    this.spawnSuppressionTimer = 0;
    this.activeVehicles = [];
    this.pendingSpawnAnnouncements = 0;
    this.currentDisplayTier = 0;
    this.lastAnnouncedTier = 0;
    this.shutdownActive = false;
    this.shutdownTimer = 0;
    this.managerState = {
      forward: new THREE.Vector3(0, 0, -1),
      right: new THREE.Vector3(1, 0, 0),
    };
  }

  setDebugState({ startingHeat, startingRivals, player, missionState }) {
    const desiredRivals = startingRivals == null ? null : THREE.MathUtils.clamp(Math.round(startingRivals), 0, this.config.poolSize);
    const derivedHeat = desiredRivals == null ? 0 : this.getMinimumHeatForRivals(desiredRivals);
    const heat = THREE.MathUtils.clamp(
      Math.max(startingHeat ?? 0, derivedHeat),
      0,
      this.config.heat.maxHeat,
    );

    this.heatSystem.setHeat(heat);
    this.currentDisplayTier = this.getEffectiveTier(this.heatSystem.getState().tier, missionState);
    this.lastAnnouncedTier = this.currentDisplayTier;
    this.spawnCooldown = 0;

    if (desiredRivals != null && desiredRivals > 0) {
      this.seedRivals(player, missionState, desiredRivals);
    }

    this.activeVehicles = this.getActiveAgents().map((agent) => agent.getVehicle());
    return { heat: this.currentDisplayTier, rivals: this.activeVehicles.length };
  }

  update(delta, player, missionState, energyState = null) {
    if (this.shutdownActive) {
      this.updateShutdown(delta, player, missionState, energyState);
      return;
    }

    this.heatSystem.update(delta, player, missionState);
    const heatState = this.heatSystem.getState();
    this.currentDisplayTier = this.getEffectiveTier(heatState.tier, missionState);
    const profile = getHeatProfile(this.currentDisplayTier);
    this.spawnCooldown = Math.max(0, this.spawnCooldown - delta);
    this.spawnSuppressionTimer = Math.max(0, this.spawnSuppressionTimer - delta);

    this.updateBasisVectors(player);
    this.recycleFarAgents(player.mesh.position, profile.desiredCount);
    this.spawnIfNeeded(player, missionState, heatState, profile);
    this.updateAgents(delta, player, missionState, energyState);
    this.announceHeatTier(this.currentDisplayTier);
  }

  updateShutdown(delta, player, missionState, energyState) {
    this.heatSystem.setHeat(0);
    this.currentDisplayTier = 0;
    this.lastAnnouncedTier = 0;
    this.pendingSpawnAnnouncements = 0;
    this.spawnCooldown = 999;
    this.spawnSuppressionTimer = Math.max(this.spawnSuppressionTimer, 999);
    this.updateBasisVectors(player);
    this.shutdownTimer = Math.max(0, this.shutdownTimer - delta);
    if (this.shutdownTimer === 0) {
      this.deactivateOneRival(player.mesh.position);
      this.shutdownTimer = 1.1;
    }
    this.updateAgents(delta, player, missionState, energyState);
  }

  deactivateOneRival(playerPosition) {
    const activeAgents = this.getActiveAgents();
    if (activeAgents.length === 0) return;

    activeAgents
      .sort((a, b) => b.position.distanceToSquared(playerPosition) - a.position.distanceToSquared(playerPosition))[0]
      .deactivate();
    this.activeVehicles = this.getActiveAgents().map((agent) => agent.getVehicle());
  }

  startShutdown() {
    this.shutdownActive = true;
    this.shutdownTimer = 0.4;
    this.heatSystem.setHeat(0);
    this.currentDisplayTier = 0;
    this.lastAnnouncedTier = 0;
    this.pendingSpawnAnnouncements = 0;
  }

  getEffectiveTier(baseTier, missionState) {
    if (missionState.endgameUnlocked && missionState.totalCredits >= this.config.endgameCreditsThreshold) {
      return 10;
    }

    return Math.min(baseTier, 9);
  }

  updateBasisVectors(player) {
    this.managerState.forward.set(0, 0, -1).applyQuaternion(player.mesh.quaternion).setY(0).normalize();
    if (this.managerState.forward.lengthSq() === 0) {
      this.managerState.forward.set(0, 0, -1);
    }
    this.managerState.right.crossVectors(this.managerState.forward, _up).normalize();
  }

  seedRivals(player, missionState, desiredCount) {
    const heatState = this.heatSystem.getState();
    const profile = getHeatProfile(heatState.tier);

    this.updateBasisVectors(player);
    for (let activeCount = this.getActiveAgents().length; activeCount < desiredCount; activeCount += 1) {
      const agent = this.agents.find((entry) => !entry.active);
      if (!agent) break;

      const spawnPoint = this.spawnSystem.findSpawnPoint(player, heatState, 16);
      const behavior = this.chooseBehavior(profile, activeCount, missionState);
      const spawnVelocity = player.velocity.lengthSq() > 1 ? player.velocity : this.managerState.forward;
      agent.activate(spawnPoint, behavior, {
        aggression: profile.aggression,
        maxSpeed: profile.speed,
        maxForce: profile.force,
        collisionPenalty: profile.collisionPenalty,
        collisionStrength: profile.collisionStrength,
        collisionSource: behavior === 'rammer' ? 'rammed by rival taxi' : behavior === 'blocker' ? 'boxed in by rival taxi' : 'intercepted by rival taxi',
        initialVelocity: spawnVelocity,
        swarmSlot: activeCount % 4,
      });
      this.pendingSpawnAnnouncements += 1;
    }
  }

  getMinimumHeatForRivals(count) {
    if (count >= 16) return 9;
    if (count >= 10) return 6;
    if (count >= 5) return 3;
    if (count >= 1) return 1;
    return 0;
  }

  recycleFarAgents(playerPosition, desiredCount) {
    const activeAgents = this.getActiveAgents();
    if (activeAgents.length > desiredCount) {
      activeAgents
        .sort((a, b) => b.position.distanceToSquared(playerPosition) - a.position.distanceToSquared(playerPosition))
        .slice(desiredCount)
        .forEach((agent) => agent.deactivate());
    }

    this.getActiveAgents().forEach((agent) => {
      if (agent.position.distanceToSquared(playerPosition) > this.config.despawnDistance * this.config.despawnDistance) {
        agent.deactivate();
      }
    });
  }

  spawnIfNeeded(player, missionState, heatState, profile) {
    const activeCount = this.getActiveAgents().length;
    if (activeCount >= profile.desiredCount || this.spawnCooldown > 0 || this.spawnSuppressionTimer > 0) return;

    const agent = this.agents.find((entry) => !entry.active);
    if (!agent) return;

    const spawnPoint = this.spawnSystem.findSpawnPoint(player, heatState);
    const behavior = this.chooseBehavior(profile, activeCount, missionState);
    const spawnVelocity = player.velocity.lengthSq() > 1 ? player.velocity : this.managerState.forward;
    agent.activate(spawnPoint, behavior, {
      aggression: profile.aggression,
      maxSpeed: profile.speed,
      maxForce: profile.force,
      collisionPenalty: profile.collisionPenalty,
      collisionStrength: profile.collisionStrength,
      collisionSource: behavior === 'rammer' ? 'rammed by rival taxi' : behavior === 'blocker' ? 'boxed in by rival taxi' : 'intercepted by rival taxi',
      initialVelocity: spawnVelocity,
      swarmSlot: activeCount % 4,
    });
    this.pendingSpawnAnnouncements += 1;

    this.spawnCooldown = profile.spawnInterval * THREE.MathUtils.lerp(0.8, 1.15, Math.random());
  }

  chooseBehavior(profile, activeCount, missionState) {
    if (profile.behaviors.includes('blocker') && (missionState.phase === 'pickup' || missionState.phase === 'dropoff') && activeCount % 4 === 2) {
      return 'blocker';
    }

    if (profile.behaviors.includes('swarm') && activeCount % 3 === 0) {
      return 'swarm';
    }

    return profile.behaviors[Math.floor(Math.random() * profile.behaviors.length)];
  }

  updateAgents(delta, player, missionState, energyState) {
    const activeAgents = this.getActiveAgents();
    activeAgents.forEach((agent) => {
      agent.update(delta, {
        player,
        mission: missionState,
        energy: energyState,
        neighbors: activeAgents,
        world: this.worldConfig,
        managerState: this.managerState,
        config: this.config.agent,
      });
    });

    this.activeVehicles = activeAgents.map((agent) => agent.getVehicle());
  }

  announceHeatTier(currentTier) {
    this.heatSystem.consumeTierChange();
    if (currentTier === this.lastAnnouncedTier || currentTier === 0) return;

    const message = currentTier >= 10
      ? 'Heat 10. Axiom Mobility is flooding the grid.'
      : currentTier >= 7
        ? `Heat ${currentTier}. Rival taxis are swarming your lane.`
        : currentTier >= 4
          ? `Heat ${currentTier}. Rival taxis are escalating.`
          : `Heat ${currentTier}. Rival taxis are on your tail.`;
    this.lastAnnouncedTier = currentTier;
    this.ui.pushFeed(message, currentTier >= 7 ? 'bad' : 'info');
  }

  onCollision(severity = 1) {
    this.heatSystem.recordCollision(severity);
  }

  disruptNearest(origin, limit, radius, suppressSeconds = 0) {
    const activeAgents = this.getActiveAgents()
      .filter((agent) => agent.position.distanceToSquared(origin) <= radius * radius)
      .sort((a, b) => a.position.distanceToSquared(origin) - b.position.distanceToSquared(origin));

    const disrupted = activeAgents.slice(0, limit);
    disrupted.forEach((agent) => agent.deactivate());

    if (disrupted.length > 0) {
      this.heatSystem.addHeat(-Math.min(2.5, disrupted.length * 0.18));
      this.spawnSuppressionTimer = Math.max(this.spawnSuppressionTimer, suppressSeconds);
    }

    this.activeVehicles = this.getActiveAgents().map((agent) => agent.getVehicle());
    return disrupted.length;
  }

  getCollidableVehicles() {
    return this.activeVehicles;
  }

  getState() {
    const heatState = this.heatSystem.getState();
    return {
      ...heatState,
      tier: this.currentDisplayTier,
      intensity: this.currentDisplayTier / Math.max(this.config.heat.maxHeat, 10),
      activeRivals: this.activeVehicles.length,
      shutdownActive: this.shutdownActive,
    };
  }

  consumeSpawnAnnouncement() {
    if (this.pendingSpawnAnnouncements <= 0) return false;
    this.pendingSpawnAnnouncements -= 1;
    return true;
  }

  getActiveAgents() {
    return this.agents.filter((agent) => agent.active);
  }
}

const _up = new THREE.Vector3(0, 1, 0);
