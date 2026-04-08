const state = {
  mode: "watch",
  venue: "curve",
  capitalCap: 2500,
  edgeTriggerBps: 85,
  navPerWst: 333.85,
  wtaoSpot: 309.6,
  wstSpot: 338.55,
  gasUsd: 18.4,
  slippageBps: 27,
  protocolBps: 14,
  bridgeBps: 16,
  nextEpochAt: Date.now() + (72 * 60 * 1000),
  oracleAgeMinutes: 13,
  mintQueueMinutes: 126,
  redeemQueueMinutes: 161,
  log: []
};

const els = {
  modeBadge: document.getElementById("modeBadge"),
  routeBadge: document.getElementById("routeBadge"),
  epochBadge: document.getElementById("epochBadge"),
  venueSelect: document.getElementById("venueSelect"),
  capitalInput: document.getElementById("capitalInput"),
  edgeInput: document.getElementById("edgeInput"),
  modeRow: document.getElementById("modeRow"),
  premiumShockBtn: document.getElementById("premiumShockBtn"),
  discountShockBtn: document.getElementById("discountShockBtn"),
  resetScenarioBtn: document.getElementById("resetScenarioBtn"),
  wstSpot: document.getElementById("wstSpot"),
  wtaoSpot: document.getElementById("wtaoSpot"),
  navValue: document.getElementById("navValue"),
  premiumValue: document.getElementById("premiumValue"),
  edgeValue: document.getElementById("edgeValue"),
  bandValue: document.getElementById("bandValue"),
  spreadFill: document.getElementById("spreadFill"),
  spreadPin: document.getElementById("spreadPin"),
  epochCountdown: document.getElementById("epochCountdown"),
  epochStatus: document.getElementById("epochStatus"),
  epochNext: document.getElementById("epochNext"),
  oracleFreshness: document.getElementById("oracleFreshness"),
  mintQueue: document.getElementById("mintQueue"),
  redeemQueue: document.getElementById("redeemQueue"),
  actionTitle: document.getElementById("actionTitle"),
  actionNote: document.getElementById("actionNote"),
  actionSteps: document.getElementById("actionSteps"),
  routeGrid: document.getElementById("routeGrid"),
  ladderGrid: document.getElementById("ladderGrid"),
  riskGrid: document.getElementById("riskGrid"),
  logList: document.getElementById("logList")
};

function money(value, digits = 2) {
  return `$${Number(value).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  })}`;
}

function pct(value, digits = 2) {
  const formatted = Number(value).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
  return `${value >= 0 ? "+" : ""}${formatted}%`;
}

function bps(value) {
  return `${value >= 0 ? "+" : ""}${Math.round(value)} bps`;
}

function minutes(value) {
  return `${Math.round(value)} min`;
}

function countdown(ms) {
  const clamped = Math.max(0, ms);
  const totalSeconds = Math.floor(clamped / 1000);
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const mins = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const secs = String(totalSeconds % 60).padStart(2, "0");
  return `${hours}:${mins}:${secs}`;
}

function pushLog(title, detail) {
  state.log.unshift({
    time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
    title,
    detail
  });
  state.log = state.log.slice(0, 8);
}

function getModel() {
  const premiumPct = ((state.wstSpot - state.navPerWst) / state.navPerWst) * 100;
  const grossEdgeBps = premiumPct * 100;
  const frictionBps = state.slippageBps + state.protocolBps + state.bridgeBps + ((state.gasUsd / Math.max(state.capitalCap, 1)) * 10000);
  const netEdgeBps = grossEdgeBps - frictionBps;
  const modeTone = state.mode === "live" ? "warn" : state.mode === "paper" ? "good" : "ghost";

  let route = "wait";
  let title = "Stand by";
  let note = "Spread is not rich or cheap enough after frictions. Keep measuring, do not force a trade.";
  let steps = [
    "Wait through the next epoch window.",
    "Keep logging basis behavior against the trigger.",
    "Do not unlock execution until custody and gas logic are wired."
  ];

  if (netEdgeBps >= state.edgeTriggerBps) {
    route = "premium";
    title = "Premium arb is live";
    note = "wstTAO is trading rich to implied NAV after current frictions. The paper route is mint into strength and sell spot.";
    steps = [
      "Source wTAO inventory or spot-buy the cheaper leg.",
      "Queue mint into the next epoch with oracle freshness checked.",
      "Sell wstTAO spot if the premium survives net of gas and slippage."
    ];
  } else if (netEdgeBps <= -state.edgeTriggerBps) {
    route = "discount";
    title = "Discount arb is live";
    note = "wstTAO is trading cheap to implied NAV after current frictions. The paper route is buy spot and queue redeem.";
    steps = [
      "Buy discounted wstTAO with slippage cap held.",
      "Queue redeem toward wTAO NAV at the next clean epoch.",
      "Exit the recovered leg only if queue delay still leaves positive edge."
    ];
  }

  return {
    premiumPct,
    grossEdgeBps,
    frictionBps,
    netEdgeBps,
    route,
    title,
    note,
    steps,
    modeTone,
    band: premiumPct <= -1.2 ? "Deep discount" :
      premiumPct <= -0.35 ? "Discount" :
      premiumPct < 0.35 ? "Fair" :
      premiumPct < 1.2 ? "Premium" : "Rich premium"
  };
}

function renderHeader(model) {
  els.modeBadge.textContent = state.mode === "watch" ? "WATCH ONLY" : state.mode === "paper" ? "PAPER ARMED" : "LIVE LOCK";
  els.modeBadge.className = `status-pill status-pill--${model.modeTone}`;
  els.routeBadge.textContent = model.route === "premium" ? "Mint / sell route" : model.route === "discount" ? "Buy / redeem route" : "No route armed";
  els.routeBadge.className = `status-pill ${model.route === "wait" ? "status-pill--ghost" : model.route === "premium" ? "status-pill--good" : "status-pill--warn"}`;
  els.epochBadge.textContent = `Epoch in ${countdown(state.nextEpochAt - Date.now())}`;
}

function renderSpread(model) {
  els.wstSpot.textContent = money(state.wstSpot);
  els.wtaoSpot.textContent = money(state.wtaoSpot);
  els.navValue.textContent = money(state.navPerWst);
  els.premiumValue.textContent = pct(model.premiumPct);
  els.edgeValue.textContent = bps(model.netEdgeBps);
  els.bandValue.textContent = model.band;

  const normalized = Math.max(0, Math.min(100, ((model.premiumPct + 2) / 4) * 100));
  const fillDistance = Math.abs(normalized - 50);
  els.spreadFill.style.width = `${fillDistance}%`;
  els.spreadPin.style.left = `${normalized}%`;
}

function renderEpoch(model) {
  const msToEpoch = state.nextEpochAt - Date.now();
  els.epochCountdown.textContent = countdown(msToEpoch);
  els.epochStatus.textContent = model.route === "wait"
    ? "No edge yet. Timing still matters because the queue is the trade."
    : "Edge exists, but the epoch queue can still erase it if oracle freshness slips.";
  els.epochNext.textContent = new Date(state.nextEpochAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  els.oracleFreshness.textContent = minutes(state.oracleAgeMinutes);
  els.mintQueue.textContent = minutes(state.mintQueueMinutes);
  els.redeemQueue.textContent = minutes(state.redeemQueueMinutes);
}

function renderAction(model) {
  els.actionTitle.textContent = model.title;
  els.actionNote.textContent = model.note;
  els.actionSteps.innerHTML = model.steps.map((step, index) => `
    <div class="step-card">
      <span>${index + 1}</span>
      <strong>${step}</strong>
    </div>
  `).join("");
}

function renderRoutes(model) {
  const premiumClass = model.route === "premium" ? "route-card route-card--good" : "route-card route-card--warn";
  const discountClass = model.route === "discount" ? "route-card route-card--good" : "route-card route-card--warn";
  els.routeGrid.innerHTML = `
    <article class="${premiumClass}">
      <span class="route-tag">Premium route</span>
      <h3>Mint wstTAO, then sell spot</h3>
      <p>Gross edge ${bps(model.grossEdgeBps)}. Best when spot stays rich through the epoch delay.</p>
    </article>
    <article class="${discountClass}">
      <span class="route-tag">Discount route</span>
      <h3>Buy wstTAO, then redeem</h3>
      <p>Net edge flips positive only if queue drag stays smaller than the discount capture.</p>
    </article>
    <article class="route-card ${model.route === "wait" ? "route-card--good" : "route-card--bad"}">
      <span class="route-tag">Standby route</span>
      <h3>Wait for cleaner basis</h3>
      <p>Current friction stack is ${bps(model.frictionBps)}. If the edge is not larger, standing down is the trade.</p>
    </article>
  `;
}

function renderLadder(model) {
  const bands = [
    { label: "Deep discount", range: "< -1.20%", tone: "bad", active: model.premiumPct <= -1.2 },
    { label: "Discount", range: "-1.20% to -0.35%", tone: "warn", active: model.premiumPct > -1.2 && model.premiumPct <= -0.35 },
    { label: "Fair", range: "-0.35% to +0.35%", tone: "neutral", active: model.premiumPct > -0.35 && model.premiumPct < 0.35 },
    { label: "Premium", range: "+0.35% to +1.20%", tone: "good", active: model.premiumPct >= 0.35 && model.premiumPct < 1.2 },
    { label: "Rich premium", range: "> +1.20%", tone: "good", active: model.premiumPct >= 1.2 }
  ];

  els.ladderGrid.innerHTML = bands.map((band) => `
    <div class="ladder-band ladder-band--${band.tone} ${band.active ? "active" : ""}">
      <span>${band.label}</span>
      <strong>${band.range}</strong>
    </div>
  `).join("");
}

function renderRisk(model) {
  const executionStatus = state.mode === "live"
    ? "Locked until wallet, gas, and fail-safe wiring exists"
    : state.mode === "paper"
      ? "Paper execution allowed"
      : "Watch-only";

  els.riskGrid.innerHTML = `
    <div class="risk-card"><span>Capital cap</span><strong>${money(state.capitalCap, 0)}</strong></div>
    <div class="risk-card"><span>Gas burn / cycle</span><strong>${money(state.gasUsd)}</strong></div>
    <div class="risk-card"><span>Friction stack</span><strong>${bps(model.frictionBps)}</strong></div>
    <div class="risk-card"><span>Slippage budget</span><strong>${bps(state.slippageBps)}</strong></div>
    <div class="risk-card"><span>Wallet control</span><strong>Manual only</strong></div>
    <div class="risk-card"><span>Execution</span><strong>${executionStatus}</strong></div>
  `;
}

function renderLog() {
  els.logList.innerHTML = state.log.map((item) => `
    <div class="log-item">
      <span>${item.time}</span>
      <strong>${item.title}</strong>
      <p>${item.detail}</p>
    </div>
  `).join("");
}

function render() {
  const model = getModel();
  renderHeader(model);
  renderSpread(model);
  renderEpoch(model);
  renderAction(model);
  renderRoutes(model);
  renderLadder(model);
  renderRisk(model);
  renderLog();
}

function bindControls() {
  els.venueSelect.addEventListener("change", (event) => {
    state.venue = event.target.value;
    pushLog("Venue focus changed", `Operator switched routing lens to ${state.venue}.`);
    render();
  });

  els.capitalInput.addEventListener("input", (event) => {
    state.capitalCap = Number(event.target.value) || 0;
    render();
  });

  els.edgeInput.addEventListener("input", (event) => {
    state.edgeTriggerBps = Number(event.target.value) || 0;
    render();
  });

  els.modeRow.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      state.mode = button.dataset.mode;
      els.modeRow.querySelectorAll("[data-mode]").forEach((target) => {
        target.classList.toggle("active", target.dataset.mode === state.mode);
      });
      pushLog("Mode changed", `Execution mode is now ${state.mode}.`);
      render();
    });
  });

  els.premiumShockBtn.addEventListener("click", () => {
    state.wstSpot = Number((state.navPerWst * 1.018).toFixed(2));
    state.oracleAgeMinutes = 7;
    state.mintQueueMinutes = 92;
    pushLog("Premium shock", "Simulated a rich wstTAO premium to test the mint-and-sell route.");
    render();
  });

  els.discountShockBtn.addEventListener("click", () => {
    state.wstSpot = Number((state.navPerWst * 0.982).toFixed(2));
    state.oracleAgeMinutes = 9;
    state.redeemQueueMinutes = 118;
    pushLog("Discount shock", "Simulated a wstTAO discount to test the buy-and-redeem route.");
    render();
  });

  els.resetScenarioBtn.addEventListener("click", () => {
    state.wtaoSpot = 309.6;
    state.navPerWst = 333.85;
    state.wstSpot = 338.55;
    state.oracleAgeMinutes = 13;
    state.mintQueueMinutes = 126;
    state.redeemQueueMinutes = 161;
    pushLog("Scenario reset", "Returned the dashboard to its baseline mock market.");
    render();
  });
}

function startPulse() {
  setInterval(() => {
    const drift = (Math.random() - 0.5) * 0.35;
    const navDrift = (Math.random() - 0.5) * 0.18;
    state.wtaoSpot = Number((state.wtaoSpot + drift).toFixed(2));
    state.navPerWst = Number((state.navPerWst + navDrift).toFixed(2));
    state.wstSpot = Number((state.wstSpot + drift + (Math.random() - 0.5) * 0.22).toFixed(2));
    state.oracleAgeMinutes = Math.max(2, state.oracleAgeMinutes + (Math.random() > 0.66 ? 1 : 0));
    render();
  }, 4000);

  setInterval(() => {
    render();
  }, 1000);
}

pushLog("Boot complete", "Control plane started in watch-only mode with mock market state.");
bindControls();
render();
startPulse();
