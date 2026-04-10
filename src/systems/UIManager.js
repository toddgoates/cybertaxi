export class UIManager {
  constructor(mount) {
    this.mount = mount;
    this.feed = [];
    this.lastPenaltyText = '';
    this.lastCredits = 0;
    this.lastFare = 0;
    this.displayedCredits = 0;
    this.feedPulseTimeout = null;
    this.root = document.createElement('div');
    this.root.className = 'hud';
    this.root.innerHTML = `
      <div class="hud__impact" data-field="impactFlash"></div>
      <div class="hud__actions">
        <button class="hud__button" type="button" data-field="musicToggle">Music</button>
      </div>
      <div class="hud__top">
        <div class="panel panel--credits panel--highlight">
          <div class="eyebrow">Current Fare</div>
          <div class="value" data-field="fare">0</div>
          <div class="subvalue" data-field="penalty">No active penalties</div>
          <div class="panel__divider"></div>
          <div class="eyebrow">Credits</div>
          <div class="value" data-field="credits">0</div>
          <div class="subvalue" data-field="district"></div>
        </div>
      </div>
      <div class="hud__corner">
        <div class="panel panel--nav">
          <div class="eyebrow">Navigator</div>
          <div class="navigator">
            <div class="navigator__scope">
              <div class="navigator__ring navigator__ring--outer"></div>
              <div class="navigator__ring navigator__ring--inner"></div>
              <div class="navigator__crosshair navigator__crosshair--x"></div>
              <div class="navigator__crosshair navigator__crosshair--y"></div>
              <div class="navigator__targets" data-field="navTargets"></div>
              <div class="navigator__cab"></div>
            </div>
          </div>
          <div class="subvalue" data-field="navStatus"></div>
        </div>
      </div>
      <div class="hud__bottom">
        <div class="panel panel--compact">
          <div class="eyebrow">Thrust</div>
          <div class="meter"><div class="meter__fill" data-field="speedBar"></div></div>
          <div class="subvalue" data-field="speedText"></div>
          <div class="meter meter--boost"><div class="meter__fill meter__fill--boost" data-field="boostBar"></div></div>
          <div class="subvalue" data-field="boostText"></div>
          <div class="meter meter--energy"><div class="meter__fill meter__fill--energy" data-field="energyBar"></div></div>
          <div class="subvalue" data-field="energyText"></div>
          <div class="hud__inventory hud__inventory--inline" data-field="empInventory">
            <span class="hud__inventory-icon">EMP</span>
            <span class="hud__inventory-value" data-field="empCount">0</span>
          </div>
          <div class="charge-ring" data-field="chargeRing">
            <div class="charge-ring__disc">
            <div class="charge-ring__label" data-field="chargeLabel"></div>
            </div>
          </div>
        </div>
      </div>
      <div class="hud__pause" data-field="pauseOverlay">
        <div class="hud__pause-card">
          <div class="hud__pause-title">Paused</div>
          <div class="hud__pause-subtitle">Press Esc to resume</div>
        </div>
      </div>
      <div class="controls">W/S accelerate-brake | A/D steer | Q/E strafe | J rise | K descend | Space boost | L EMP | Esc pause | M toggle music</div>
    `;
    mount.appendChild(this.root);

    this.fields = {
      fare: this.root.querySelector('[data-field="fare"]'),
      penalty: this.root.querySelector('[data-field="penalty"]'),
      credits: this.root.querySelector('[data-field="credits"]'),
      district: this.root.querySelector('[data-field="district"]'),
      speedBar: this.root.querySelector('[data-field="speedBar"]'),
      speedText: this.root.querySelector('[data-field="speedText"]'),
      boostBar: this.root.querySelector('[data-field="boostBar"]'),
      boostText: this.root.querySelector('[data-field="boostText"]'),
      energyBar: this.root.querySelector('[data-field="energyBar"]'),
      energyText: this.root.querySelector('[data-field="energyText"]'),
      chargeRing: this.root.querySelector('[data-field="chargeRing"]'),
      chargeLabel: this.root.querySelector('[data-field="chargeLabel"]'),
      navTargets: this.root.querySelector('[data-field="navTargets"]'),
      navStatus: this.root.querySelector('[data-field="navStatus"]'),
      empInventory: this.root.querySelector('[data-field="empInventory"]'),
      empCount: this.root.querySelector('[data-field="empCount"]'),
      pauseOverlay: this.root.querySelector('[data-field="pauseOverlay"]'),
      musicToggle: this.root.querySelector('[data-field="musicToggle"]'),
      impactFlash: this.root.querySelector('[data-field="impactFlash"]'),
    };
  }

  setMusicToggleHandler(handler) {
    this.fields.musicToggle.addEventListener('click', handler);
  }

  pushFeed(message, tone = 'info') {
    this.feed.unshift({ message, tone, id: `${Date.now()}-${Math.random()}` });
    this.feed = this.feed.slice(0, 5);
  }

  render(state) {
    this.fields.pauseOverlay.classList.toggle('hud__pause--visible', Boolean(state.paused));
    this.root.classList.toggle('hud--fast', state.player.getSpeedRatio() > 0.72);
    this.root.classList.toggle('hud--objective-pulse', Boolean(state.mission.specialFareActive));
    this.root.classList.toggle('hud--low-energy', state.energy.ratio < 0.22);
    this.displayedCredits = this.animateNumber(this.displayedCredits, state.mission.totalCredits, 0.14);
    this.fields.fare.textContent = `${Math.ceil(state.mission.currentFare)} cr`;
    this.fields.penalty.textContent = state.mission.pendingPenaltyText || 'Timer drains fare every second';
    this.fields.credits.textContent = `${Math.round(this.displayedCredits)} cr`;
    this.fields.district.textContent = `District: ${state.district} | Heat: ${state.rivals.tier} | Rivals: ${state.rivals.activeRivals}`;
    this.fields.speedBar.style.width = `${Math.round(state.player.getSpeedRatio() * 100)}%`;
    this.fields.speedText.textContent = `${Math.round(Math.abs(state.player.forwardSpeed))} u/s forward thrust`;
    this.fields.boostBar.style.width = `${Math.round(state.player.getBoostRatio() * 100)}%`;
    this.fields.boostText.textContent = state.player.getBoostStatusText();
    this.fields.energyBar.style.width = `${Math.round(state.energy.ratio * 100)}%`;
    this.fields.energyText.textContent = `${state.energy.currentEnergy}% energy | ${state.energy.status}`;
    const chargePercent = Math.round((state.energy.refuelRatio || 0) * 100);
    this.fields.chargeRing.style.setProperty('--charge-progress', `${chargePercent}%`);
    this.fields.chargeRing.classList.toggle('charge-ring--active', chargePercent > 0 && chargePercent < 100);
    this.fields.chargeLabel.textContent = chargePercent > 0 ? `${chargePercent}%` : '';
    this.fields.empCount.textContent = state.emp.charges;
    this.fields.empInventory.classList.toggle('hud__inventory--active', state.emp.charges > 0);
    this.fields.musicToggle.textContent = state.music.muted ? 'Music: off' : 'Music: on';
    this.pulseField(this.fields.credits, state.mission.totalCredits !== this.lastCredits);
    if (state.mission.pendingPenaltyText && state.mission.pendingPenaltyText !== this.lastPenaltyText) {
      this.flashImpact();
    }
    this.lastFare = state.mission.currentFare;
    this.lastCredits = state.mission.totalCredits;
    this.lastPenaltyText = state.mission.pendingPenaltyText;
    this.renderNavigator(state);
  }

  animateNumber(current, target, smoothing) {
    const next = current + (target - current) * smoothing;
    return Math.abs(target - next) < 0.35 ? target : next;
  }

  pulseField(field, shouldPulse) {
    if (!shouldPulse) return;
    field.classList.remove('value--pulse');
    void field.offsetWidth;
    field.classList.add('value--pulse');
  }

  flashImpact() {
    this.fields.impactFlash.classList.remove('hud__impact--active');
    void this.fields.impactFlash.offsetWidth;
    this.fields.impactFlash.classList.add('hud__impact--active');
  }

  renderNavigator(state) {
    const playerPosition = state.player.mesh.position;
    const heading = state.player.mesh.rotation.y;
    const range = 220;
    const radius = 72;
    const sin = Math.sin(heading);
    const cos = Math.cos(heading);
    const targets = [];

    if (state.mission.phase === 'pickup') {
      state.mission.pickupTargets.forEach((target) => targets.push({
        ...target,
        role: target.special ? 'special-pickup' : 'pickup',
        active: true,
      }));
    } else if (state.mission.dropoffTarget) {
      targets.push({ ...state.mission.dropoffTarget, role: 'dropoff', active: true });
    }

    if (state.emp.pickupTarget) {
      targets.push({ ...state.emp.pickupTarget, role: 'emp', active: false });
    }

    state.energy.stations.forEach((station) => targets.push({ ...station, role: 'energy', active: false }));

    this.fields.navTargets.innerHTML = targets
      .map((target) => {
        const dx = target.x - playerPosition.x;
        const dz = target.z - playerPosition.z;
        const localX = dx * cos - dz * sin;
        const localZ = dx * sin + dz * cos;
        const distance = Math.hypot(dx, dz);
        const clampedDistance = Math.min(distance, range);
        const scale = distance > 0 ? clampedDistance / distance : 0;
        const x = localX * scale * (radius / range);
        const y = localZ * scale * (radius / range);
        const classes = ['navigator__target', `navigator__target--${target.role}`];

        if (target.active) classes.push('navigator__target--active');
        if (distance > range) classes.push('navigator__target--edge');

        const fareLabel = target.fare ? ` | ${target.fare} cr` : '';
        const specialLabel = target.special ? ' | Priority fare' : '';
        const distanceRatio = Math.min(distance / range, 1).toFixed(2);
        return `<div class="${classes.join(' ')}" style="transform: translate(calc(-50% + ${x.toFixed(1)}px), calc(-50% + ${y.toFixed(1)}px)); --distance-ratio:${distanceRatio};" title="${target.name} ${Math.round(distance)}m${fareLabel}${specialLabel}"></div>`;
      })
      .join('');

    if (state.mission.phase === 'pickup') {
      const nearestPickup = state.mission.pickupTargets.reduce((nearest, target) => {
        const distance = Math.hypot(target.x - playerPosition.x, target.z - playerPosition.z);
        if (!nearest || distance < nearest.distance) {
          return { distance, fare: target.fare, special: target.special };
        }
        return nearest;
      }, null);
      const distanceLabel = nearestPickup ? `${Math.round(nearestPickup.distance)}m` : '--';
      const fareLabel = nearestPickup ? `${nearestPickup.fare} cr${nearestPickup.special ? ' priority' : ''}` : '--';
      const priorityLabel = state.mission.pickupTargets.some((target) => target.special) ? ' | Priority fare live' : '';
      const empLabel = state.emp.pickupTarget ? ` | EMP ${Math.round(Math.hypot(state.emp.pickupTarget.x - playerPosition.x, state.emp.pickupTarget.z - playerPosition.z))}m` : '';
      this.fields.navStatus.textContent = `${state.mission.pickupTargets.length} fares live${priorityLabel} | Nearest ${distanceLabel} | ${fareLabel}${empLabel} | ${state.energy.status}`;
      return;
    }

    if (state.mission.dropoffTarget) {
      const distance = Math.round(
        Math.hypot(state.mission.dropoffTarget.x - playerPosition.x, state.mission.dropoffTarget.z - playerPosition.z),
      );
      const empLabel = state.emp.pickupTarget ? ` | EMP ${Math.round(Math.hypot(state.emp.pickupTarget.x - playerPosition.x, state.emp.pickupTarget.z - playerPosition.z))}m` : '';
      this.fields.navStatus.textContent = `Drop-off beacon ${distance}m out${empLabel} | ${state.energy.status}`;
      return;
    }

    if (state.emp.pickupTarget) {
      const empDistance = Math.round(
        Math.hypot(state.emp.pickupTarget.x - playerPosition.x, state.emp.pickupTarget.z - playerPosition.z),
      );
      this.fields.navStatus.textContent = `EMP charge ${empDistance}m out | ${state.energy.status}`;
      return;
    }

    this.fields.navStatus.textContent = state.energy.status;
  }
}
