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
      <div class="hud__bottom">
        <div class="panel panel--compact">
          <div class="eyebrow">Thrust</div>
          <div class="meter"><div class="meter__fill" data-field="speedBar"></div></div>
          <div class="subvalue" data-field="speedText"></div>
        </div>
        <div class="panel panel--feed">
          <div class="eyebrow">Cab Dispatch</div>
          <div class="feed" data-field="feed"></div>
        </div>
      </div>
      <div class="controls">W/S accelerate-brake | A/D steer | Q/E strafe | Space rise | Shift descend</div>
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
  }

  renderFeed() {
    this.fields.feed.innerHTML = this.feed
      .map((item) => `<div class="feed__item feed__item--${item.tone}">${item.message}</div>`)
      .join('');
  }
}
