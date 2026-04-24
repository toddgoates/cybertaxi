export class UIManager {
  constructor(mount) {
    this.mount = mount;
    this.feed = [];
    this.lastPenaltyText = '';
    this.lastCollisionPenaltyCount = 0;
    this.lastCreditLossCount = 0;
    this.lastCredits = 0;
    this.lastFare = 0;
    this.displayedCredits = 0;
    this.feedPulseTimeout = null;
    this.navigatorMarkers = [];
    this.notificationsSuppressed = false;
    this.root = document.createElement('div');
    this.root.className = 'hud';
    this.root.innerHTML = `
      <div class="hud__impact" data-field="impactFlash"></div>
      <div class="hud__alert" data-field="alertBanner"></div>
      <div class="hud__title-screen" data-field="titleScreen">
        <div class="hud__title-card">
          <div class="hud__title-presenter">Todd Goates presents</div>
          <div class="hud__title-name">Cybertaxi</div>
          <div class="hud__title-goal">Goal: earn 10,000 credits by sunrise... with a stole robo taxi</div>
          <img class="hud__title-image" src="/images/screenshot.png" alt="Cybertaxi screenshot" />
          <div class="hud__title-controls-label">Controls</div>
          <div class="hud__title-controls">W/S accelerate-brake | A/D steer | Q/E strafe | J rise | K descend | Space boost | L EMP | P Super Boost | Esc pause | M toggle music | [ / ] change track</div>
          <button class="hud__button hud__button--start" type="button" data-field="startButton">Start game</button>
        </div>
      </div>
      <div class="hud__dialogue" data-field="dialogueCard">
        <div class="hud__dialogue-portrait-wrap">
          <img class="hud__dialogue-portrait" data-field="dialoguePortrait" alt="Speaker portrait" />
        </div>
        <div class="hud__dialogue-copy">
          <div class="hud__dialogue-text" data-field="dialogueText"></div>
        </div>
      </div>
      <div class="hud__intro-card" data-field="introCard">
        <div class="hud__intro-presenter" data-field="introPresenter"></div>
        <div class="hud__intro-title" data-field="introTitle"></div>
      </div>
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
        <div class="panel panel--storm" data-field="stormWarning" hidden>
          <div class="hud__storm-row">
            <span class="hud__storm-icon" aria-hidden="true">⚡</span>
            <span class="hud__storm-text">Danger: Storm in progress</span>
          </div>
        </div>
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
          <div class="subvalue hud__nav-status" data-field="navStatus"></div>
        </div>
      </div>
      <div class="hud__bottom">
        <div class="panel panel--compact">
          <div class="eyebrow">Thrust</div>
          <div class="meter"><div class="meter__fill" data-field="speedBar"></div></div>
          <div class="subvalue" data-field="speedText"></div>
          <div class="meter meter--boost" data-field="boostMeter"><div class="meter__fill meter__fill--boost" data-field="boostBar"></div></div>
          <div class="subvalue" data-field="boostText"></div>
          <div class="meter meter--energy"><div class="meter__fill meter__fill--energy" data-field="energyBar"></div></div>
          <div class="subvalue" data-field="energyText"></div>
          <div class="hud__inventories">
            <div class="hud__inventory hud__inventory--inline" data-field="empInventory">
              <span class="hud__inventory-icon">EMP</span>
              <span class="hud__inventory-value" data-field="empCount">0</span>
            </div>
            <div class="hud__inventory hud__inventory--inline hud__inventory--super" data-field="superBoostInventory">
              <span class="hud__inventory-icon">SB</span>
              <span class="hud__inventory-value" data-field="superBoostCount">0</span>
            </div>
          </div>
          <div class="panel__divider panel__divider--compact"></div>
          <div class="hud__music-nowplaying">
            <div class="hud__music-title-row">
              <span class="hud__music-icon" aria-hidden="true">♪</span>
              <div class="hud__music-title" data-field="musicTitle">No track loaded</div>
            </div>
            <div class="subvalue" data-field="musicInlineStatus">Music muted</div>
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
      <div class="hud__win" data-field="winOverlay">
        <div class="hud__win-title">You won!</div>
        <img class="hud__win-image" src="/images/winner.png" alt="Winner artwork" />
      </div>
      <div class="controls" data-field="gameControls">W/S accelerate-brake | A/D steer | Q/E strafe | J rise | K descend | Space boost | L EMP | P Super Boost | Esc pause | M toggle music | [ / ] change track</div>
    `;
    mount.appendChild(this.root);

    this.fields = {
      fare: this.root.querySelector('[data-field="fare"]'),
      penalty: this.root.querySelector('[data-field="penalty"]'),
      credits: this.root.querySelector('[data-field="credits"]'),
      district: this.root.querySelector('[data-field="district"]'),
      speedBar: this.root.querySelector('[data-field="speedBar"]'),
      speedText: this.root.querySelector('[data-field="speedText"]'),
      boostMeter: this.root.querySelector('[data-field="boostMeter"]'),
      boostBar: this.root.querySelector('[data-field="boostBar"]'),
      boostText: this.root.querySelector('[data-field="boostText"]'),
      energyBar: this.root.querySelector('[data-field="energyBar"]'),
      energyText: this.root.querySelector('[data-field="energyText"]'),
      chargeRing: this.root.querySelector('[data-field="chargeRing"]'),
      chargeLabel: this.root.querySelector('[data-field="chargeLabel"]'),
      navTargets: this.root.querySelector('[data-field="navTargets"]'),
      navStatus: this.root.querySelector('[data-field="navStatus"]'),
      stormWarning: this.root.querySelector('[data-field="stormWarning"]'),
      empInventory: this.root.querySelector('[data-field="empInventory"]'),
      empCount: this.root.querySelector('[data-field="empCount"]'),
      superBoostInventory: this.root.querySelector('[data-field="superBoostInventory"]'),
      superBoostCount: this.root.querySelector('[data-field="superBoostCount"]'),
      musicTitle: this.root.querySelector('[data-field="musicTitle"]'),
      musicInlineStatus: this.root.querySelector('[data-field="musicInlineStatus"]'),
      pauseOverlay: this.root.querySelector('[data-field="pauseOverlay"]'),
      winOverlay: this.root.querySelector('[data-field="winOverlay"]'),
      musicToggle: this.root.querySelector('[data-field="musicToggle"]'),
      impactFlash: this.root.querySelector('[data-field="impactFlash"]'),
      alertBanner: this.root.querySelector('[data-field="alertBanner"]'),
      dialogueCard: this.root.querySelector('[data-field="dialogueCard"]'),
      dialoguePortrait: this.root.querySelector('[data-field="dialoguePortrait"]'),
      dialogueText: this.root.querySelector('[data-field="dialogueText"]'),
      introCard: this.root.querySelector('[data-field="introCard"]'),
      introPresenter: this.root.querySelector('[data-field="introPresenter"]'),
      introTitle: this.root.querySelector('[data-field="introTitle"]'),
      titleScreen: this.root.querySelector('[data-field="titleScreen"]'),
      startButton: this.root.querySelector('[data-field="startButton"]'),
      gameControls: this.root.querySelector('[data-field="gameControls"]'),
    };

    this.showTitleScreen();
  }

  setMusicToggleHandler(handler) {
    this.fields.musicToggle.addEventListener('click', handler);
  }

  setStartHandler(handler) {
    this.fields.startButton.addEventListener('click', handler, { once: true });
  }

  showTitleScreen() {
    this.root.classList.add('hud--title-active');
    this.fields.titleScreen.hidden = false;
  }

  hideTitleScreen() {
    this.root.classList.remove('hud--title-active');
    this.fields.titleScreen.hidden = true;
  }

  pushFeed(message, tone = 'info') {
    if (this.notificationsSuppressed) return;
    this.feed.unshift({ message, tone, id: `${Date.now()}-${Math.random()}` });
    this.feed = this.feed.slice(0, 5);
  }

  render(state) {
    const collisionPenaltyTriggered = state.mission.phase === 'dropoff'
      && state.mission.collisionPenaltyCount > this.lastCollisionPenaltyCount;
    const creditLossTriggered = state.mission.creditLossCount > this.lastCreditLossCount;
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
    this.fields.boostMeter.classList.toggle('meter--super-boost-active', state.superBoost.active);
    this.fields.energyBar.style.width = `${Math.round(state.energy.ratio * 100)}%`;
    this.fields.energyText.textContent = `${state.energy.currentEnergy}% energy | ${state.energy.status}`;
    const chargePercent = Math.round((state.energy.refuelRatio || 0) * 100);
    this.fields.chargeRing.style.setProperty('--charge-progress', `${chargePercent}%`);
    this.fields.chargeRing.classList.toggle('charge-ring--active', chargePercent > 0 && chargePercent < 100);
    this.fields.chargeLabel.textContent = chargePercent > 0 ? `${chargePercent}%` : '';
    this.fields.empCount.textContent = state.emp.charges;
    this.fields.empInventory.classList.toggle('hud__inventory--active', state.emp.charges > 0);
    this.fields.superBoostCount.textContent = state.superBoost.charges;
    this.fields.superBoostInventory.classList.toggle('hud__inventory--active', state.superBoost.charges > 0 || state.superBoost.active);
    this.fields.musicToggle.textContent = state.music.muted ? 'Music: off' : 'Music: on';
    this.fields.musicTitle.textContent = state.music.currentTrackTitle;
    this.fields.musicInlineStatus.textContent = state.music.muted
      ? `Track ${state.music.currentTrackId} - muted`
      : `Track ${state.music.currentTrackId}`;
    this.fields.stormWarning.hidden = !state.weather?.thunderstormActive;
    this.flashFareLoss(collisionPenaltyTriggered);
    this.flashFieldLoss(this.fields.credits, creditLossTriggered);
    this.pulseField(this.fields.credits, state.mission.totalCredits > this.lastCredits);
    if (state.mission.pendingPenaltyText && state.mission.pendingPenaltyText !== this.lastPenaltyText) {
      this.flashImpact();
    }
    this.lastFare = state.mission.currentFare;
    this.lastCredits = state.mission.totalCredits;
    this.lastCollisionPenaltyCount = state.mission.collisionPenaltyCount || 0;
    this.lastCreditLossCount = state.mission.creditLossCount || 0;
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

  flashFareLoss(shouldFlash) {
    if (!shouldFlash) return;
    this.flashFieldLoss(this.fields.fare, true);
  }

  flashFieldLoss(field, shouldFlash) {
    if (!shouldFlash) return;
    field.classList.remove('value--loss');
    void field.offsetWidth;
    field.classList.add('value--loss');
  }

  flashImpact() {
    this.flashOverlay('impact');
  }

  flashLightning() {
    this.flashOverlay('lightning');
  }

  flashOverlay(mode = 'impact') {
    this.fields.impactFlash.classList.remove('hud__impact--active', 'hud__impact--lightning');
    if (mode === 'lightning') {
      this.fields.impactFlash.classList.add('hud__impact--lightning');
    }
    this.fields.impactFlash.classList.remove('hud__impact--active');
    void this.fields.impactFlash.offsetWidth;
    this.fields.impactFlash.classList.add('hud__impact--active');
  }

  showIntroCard(presenter, title) {
    this.fields.introPresenter.textContent = presenter;
    this.fields.introTitle.textContent = title;
    this.fields.introCard.classList.remove('hud__intro-card--visible');
    void this.fields.introCard.offsetWidth;
    this.fields.introCard.classList.add('hud__intro-card--visible');
  }

  showDialogue(entry) {
    this.fields.dialoguePortrait.src = entry.portrait;
    this.fields.dialogueText.textContent = entry.transcription.replace(/\r\n/g, '\n');
    this.fields.dialogueCard.classList.add('hud__dialogue--visible');
  }

  hideDialogue() {
    this.fields.dialogueCard.classList.remove('hud__dialogue--visible');
  }

  showAlert(message) {
    if (this.notificationsSuppressed) return;
    this.fields.alertBanner.classList.remove('hud__alert--persistent');
    this.fields.alertBanner.textContent = message;
    this.fields.alertBanner.classList.remove('hud__alert--visible');
    void this.fields.alertBanner.offsetWidth;
    this.fields.alertBanner.classList.add('hud__alert--visible');
  }

  showPersistentAlert(message) {
    this.fields.alertBanner.classList.remove('hud__alert--visible');
    this.fields.alertBanner.textContent = message;
    this.fields.alertBanner.classList.add('hud__alert--persistent');
  }

  clearPersistentAlert() {
    this.fields.alertBanner.classList.remove('hud__alert--persistent');
  }

  setNotificationsSuppressed(suppressed) {
    this.notificationsSuppressed = suppressed;
  }

  showWinScreen() {
    this.fields.winOverlay.classList.add('hud__win--visible');
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

    if (state.superBoost.pickupTarget) {
      targets.push({ ...state.superBoost.pickupTarget, role: 'super-boost', active: false });
    }

    state.energy.stations.forEach((station) => targets.push({ ...station, role: 'energy', active: false }));

    if (state.endgame?.extractionTarget) {
      targets.push({ ...state.endgame.extractionTarget, role: 'escape', active: true });
    }

    targets.forEach((target, index) => {
      const marker = this.getNavigatorMarker(index);
      const dx = target.x - playerPosition.x;
      const dz = target.z - playerPosition.z;
      const localX = dx * cos - dz * sin;
      const localZ = dx * sin + dz * cos;
      const distance = Math.hypot(dx, dz);
      const clampedDistance = Math.min(distance, range);
      const scale = distance > 0 ? clampedDistance / distance : 0;
      const x = localX * scale * (radius / range);
      const y = localZ * scale * (radius / range);
      marker.className = `navigator__target navigator__target--${target.role}${target.active ? ' navigator__target--active' : ''}${distance > range ? ' navigator__target--edge' : ''}`;
      marker.style.transform = `translate(calc(-50% + ${x.toFixed(1)}px), calc(-50% + ${y.toFixed(1)}px))`;
      marker.style.setProperty('--distance-ratio', Math.min(distance / range, 1).toFixed(2));
      const fareLabel = target.fare ? ` | ${target.fare} cr` : '';
      const specialLabel = target.special ? ' | Priority fare' : '';
      marker.title = `${target.name} ${Math.round(distance)}m${fareLabel}${specialLabel}`;
      marker.hidden = false;
    });

    for (let i = targets.length; i < this.navigatorMarkers.length; i += 1) {
      this.navigatorMarkers[i].hidden = true;
    }

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
      const superBoostLabel = state.superBoost.pickupTarget ? ` | SB ${Math.round(Math.hypot(state.superBoost.pickupTarget.x - playerPosition.x, state.superBoost.pickupTarget.z - playerPosition.z))}m` : '';
      this.fields.navStatus.textContent = `${state.mission.pickupTargets.length} fares live${priorityLabel} | Nearest ${distanceLabel} | ${fareLabel}${empLabel}${superBoostLabel}`;
      return;
    }

    if (state.mission.dropoffTarget) {
      const distance = Math.round(
        Math.hypot(state.mission.dropoffTarget.x - playerPosition.x, state.mission.dropoffTarget.z - playerPosition.z),
      );
      const empLabel = state.emp.pickupTarget ? ` | EMP ${Math.round(Math.hypot(state.emp.pickupTarget.x - playerPosition.x, state.emp.pickupTarget.z - playerPosition.z))}m` : '';
      const superBoostLabel = state.superBoost.pickupTarget ? ` | SB ${Math.round(Math.hypot(state.superBoost.pickupTarget.x - playerPosition.x, state.superBoost.pickupTarget.z - playerPosition.z))}m` : '';
      this.fields.navStatus.textContent = `Drop-off beacon ${distance}m out${empLabel}${superBoostLabel}`;
      return;
    }

    if (state.endgame?.extractionTarget) {
      const distance = Math.round(
        Math.hypot(state.endgame.extractionTarget.x - playerPosition.x, state.endgame.extractionTarget.z - playerPosition.z),
      );
      this.fields.navStatus.textContent = `Destination ${distance}m out`;
      return;
    }

    if (state.superBoost.pickupTarget) {
      const distance = Math.round(
        Math.hypot(state.superBoost.pickupTarget.x - playerPosition.x, state.superBoost.pickupTarget.z - playerPosition.z),
      );
      const empLabel = state.emp.pickupTarget ? ` | EMP ${Math.round(Math.hypot(state.emp.pickupTarget.x - playerPosition.x, state.emp.pickupTarget.z - playerPosition.z))}m` : '';
      this.fields.navStatus.textContent = `Super Boost ${distance}m out${empLabel}`;
      return;
    }

    if (state.emp.pickupTarget) {
      const empDistance = Math.round(
        Math.hypot(state.emp.pickupTarget.x - playerPosition.x, state.emp.pickupTarget.z - playerPosition.z),
      );
      this.fields.navStatus.textContent = `EMP charge ${empDistance}m out`;
      return;
    }

    this.fields.navStatus.textContent = '';
  }

  getNavigatorMarker(index) {
    if (!this.navigatorMarkers[index]) {
      const marker = document.createElement('div');
      marker.className = 'navigator__target';
      this.fields.navTargets.appendChild(marker);
      this.navigatorMarkers[index] = marker;
    }

    return this.navigatorMarkers[index];
  }

  destroy() {
    clearTimeout(this.feedPulseTimeout);
    this.root.remove();
  }
}
