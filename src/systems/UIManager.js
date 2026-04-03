export class UIManager {
  constructor(mount) {
    this.mount = mount;
    this.feed = [];
    this.root = document.createElement('div');
    this.root.className = 'hud';
    this.root.innerHTML = `
      <div class="hud__top">
        <div class="panel">
          <div class="eyebrow">Current Fare</div>
          <div class="value" data-field="fare">0</div>
          <div class="subvalue" data-field="penalty">No active penalties</div>
        </div>
        <div class="panel">
          <div class="eyebrow">Objective</div>
          <div class="value value--small" data-field="objective"></div>
          <div class="subvalue" data-field="route"></div>
        </div>
        <div class="panel">
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
        </div>
        <div class="panel panel--feed">
          <div class="eyebrow">Cab Dispatch</div>
          <div class="feed" data-field="feed"></div>
        </div>
      </div>
      <div class="controls">W/S accelerate-brake | A/D steer | Q/E strafe | R rise | F descend | Space boost</div>
    `;
    mount.appendChild(this.root);

    this.fields = {
      fare: this.root.querySelector('[data-field="fare"]'),
      penalty: this.root.querySelector('[data-field="penalty"]'),
      objective: this.root.querySelector('[data-field="objective"]'),
      route: this.root.querySelector('[data-field="route"]'),
      credits: this.root.querySelector('[data-field="credits"]'),
      district: this.root.querySelector('[data-field="district"]'),
      speedBar: this.root.querySelector('[data-field="speedBar"]'),
      speedText: this.root.querySelector('[data-field="speedText"]'),
      boostBar: this.root.querySelector('[data-field="boostBar"]'),
      boostText: this.root.querySelector('[data-field="boostText"]'),
      navTargets: this.root.querySelector('[data-field="navTargets"]'),
      navStatus: this.root.querySelector('[data-field="navStatus"]'),
      feed: this.root.querySelector('[data-field="feed"]'),
    };
  }

  pushFeed(message, tone = 'info') {
    this.feed.unshift({ message, tone, id: `${Date.now()}-${Math.random()}` });
    this.feed = this.feed.slice(0, 5);
    this.renderFeed();
  }

  render(state) {
    this.fields.fare.textContent = `${state.mission.currentFare} cr`;
    this.fields.penalty.textContent = state.mission.pendingPenaltyText || 'Timer drains fare every second';
    this.fields.objective.textContent = state.mission.objective;
    this.fields.route.textContent = state.mission.routeLabel;
    this.fields.credits.textContent = `${state.mission.totalCredits} cr`;
    this.fields.district.textContent = `District: ${state.district}`;
    this.fields.speedBar.style.width = `${Math.round(state.player.getSpeedRatio() * 100)}%`;
    this.fields.speedText.textContent = `${Math.round(Math.abs(state.player.forwardSpeed))} u/s forward thrust`;
    this.fields.boostBar.style.width = `${Math.round(state.player.getBoostRatio() * 100)}%`;
    this.fields.boostText.textContent = state.player.getBoostStatusText();
    this.renderNavigator(state);
  }

  renderNavigator(state) {
    const playerPosition = state.player.mesh.position;
    const heading = state.player.mesh.rotation.y;
    const range = 220;
    const radius = 72;
    const sin = Math.sin(heading);
    const cos = Math.cos(heading);
    const targets = [];

    const activeTarget = state.mission.phase === 'pickup' ? state.mission.pickupTarget : state.mission.dropoffTarget;
    targets.push({ ...activeTarget, role: state.mission.phase, active: true });

    if (state.mission.phase === 'pickup') {
      targets.push({ ...state.mission.dropoffTarget, role: 'dropoff', active: false });
    }

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

        return `<div class="${classes.join(' ')}" style="transform: translate(calc(-50% + ${x.toFixed(1)}px), calc(-50% + ${y.toFixed(1)}px));" title="${target.name} ${Math.round(distance)}m"></div>`;
      })
      .join('');

    const distance = Math.round(
      Math.hypot(activeTarget.x - playerPosition.x, activeTarget.z - playerPosition.z),
    );
    const label = state.mission.phase === 'pickup' ? 'Pickup' : 'Drop-off';
    this.fields.navStatus.textContent = `${label} beacon ${distance}m out`;
  }

  renderFeed() {
    this.fields.feed.innerHTML = this.feed
      .map((item) => `<div class="feed__item feed__item--${item.tone}">${item.message}</div>`)
      .join('');
  }
}
