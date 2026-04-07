const STORAGE_KEY = "neon-arcade-tycoon-save-v1";
const DAY_LENGTH_SECONDS = 45;
const SAVE_INTERVAL_MS = 15000;
const MILESTONES = [250, 1000, 4000, 12000, 35000, 100000];

const upgrades = [
    {
        id: "cabinet",
        name: "Retro Cabinets",
        description: "More machines let you cycle more visitors through the floor every second.",
        baseCost: 45,
        costScale: 1.26,
        effectSummary: "+2.4 served/sec"
    },
    {
        id: "streetTeam",
        name: "Street Team",
        description: "Flyers, sidewalk banter, and a little low-budget chaos bring in walk-ins.",
        baseCost: 75,
        costScale: 1.28,
        effectSummary: "+0.9 visitors/sec"
    },
    {
        id: "snackBar",
        name: "Snack Bar",
        description: "Every visitor spends more when you start selling glowing soda and fries.",
        baseCost: 120,
        costScale: 1.3,
        effectSummary: "+$0.75 per visitor"
    },
    {
        id: "prizeCounter",
        name: "Prize Counter",
        description: "Cheap plastic treasures somehow make the whole business feel more premium.",
        baseCost: 185,
        costScale: 1.33,
        effectSummary: "+14% revenue multiplier"
    },
    {
        id: "miniStage",
        name: "Mini Stage",
        description: "Small performances make your manual promos hit much harder.",
        baseCost: 260,
        costScale: 1.34,
        effectSummary: "+7 promo pull and +4 hype/click"
    },
    {
        id: "technician",
        name: "Repair Tech",
        description: "Broken cabinets stop killing your momentum, so the whole floor flows better.",
        baseCost: 420,
        costScale: 1.36,
        effectSummary: "+1.5 served/sec and +$0.25 per visitor"
    },
    {
        id: "laserWing",
        name: "Laser Arena",
        description: "A flashy premium attraction explodes your capacity and average spend.",
        baseCost: 950,
        costScale: 1.42,
        effectSummary: "+5.5 served/sec, +$1.2 per visitor"
    },
    {
        id: "influencer",
        name: "Streamer Booth",
        description: "Let a live creator room beam the arcade out to the city and pull crowds nonstop.",
        baseCost: 1500,
        costScale: 1.48,
        effectSummary: "+3.5 visitors/sec and +8% revenue multiplier"
    }
];

const elements = {
    cash: document.getElementById("cash-value"),
    income: document.getElementById("income-value"),
    visitors: document.getElementById("visitors-value"),
    service: document.getElementById("service-value"),
    hype: document.getElementById("hype-value"),
    walkin: document.getElementById("walkin-value"),
    day: document.getElementById("day-value"),
    rent: document.getElementById("rent-value"),
    goal: document.getElementById("goal-value"),
    crowdLabel: document.getElementById("crowd-label"),
    crowdFill: document.getElementById("crowd-fill"),
    profitLabel: document.getElementById("profit-label"),
    profitFill: document.getElementById("profit-fill"),
    lifetime: document.getElementById("lifetime-value"),
    bestDay: document.getElementById("bestday-value"),
    promoPower: document.getElementById("promo-power-value"),
    upgradeList: document.getElementById("upgrade-list"),
    upgradeTemplate: document.getElementById("upgrade-template"),
    logList: document.getElementById("log-list"),
    promoButton: document.getElementById("promo-button"),
    eventButton: document.getElementById("event-button"),
    saveButton: document.getElementById("save-button")
};

let state = createDefaultState();
let lastFrame = performance.now();
let autosaveAt = performance.now() + SAVE_INTERVAL_MS;

function createDefaultState() {
    return {
        cash: 120,
        visitors: 12,
        hype: 8,
        day: 1,
        dayClock: 0,
        servedToday: 0,
        revenueToday: 0,
        lifetimeRevenue: 120,
        bestDayRevenue: 0,
        smoothedIncome: 0,
        upgrades: Object.fromEntries(upgrades.map((upgrade) => [upgrade.id, 0])),
        log: [
            { stamp: "Day 1", message: "You signed the lease on an empty shell and kept the lights on." },
            { stamp: "Day 1", message: "The first goal is simple: keep enough cash moving to survive rent." }
        ],
        milestoneIndex: 0
    };
}

function loadGame() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return;
        }

        const parsed = JSON.parse(raw);
        state = {
            ...createDefaultState(),
            ...parsed,
            upgrades: {
                ...createDefaultState().upgrades,
                ...(parsed.upgrades || {})
            },
            log: Array.isArray(parsed.log) && parsed.log.length ? parsed.log.slice(0, 8) : createDefaultState().log
        };

        logMessage("Save loaded. The night shift is back in motion.");
    } catch (error) {
        console.error(error);
        logMessage("Save data failed to load cleanly. Starting fresh.");
    }
}

function saveGame() {
    const snapshot = {
        cash: state.cash,
        visitors: state.visitors,
        hype: state.hype,
        day: state.day,
        dayClock: state.dayClock,
        servedToday: state.servedToday,
        revenueToday: state.revenueToday,
        lifetimeRevenue: state.lifetimeRevenue,
        bestDayRevenue: state.bestDayRevenue,
        smoothedIncome: state.smoothedIncome,
        upgrades: state.upgrades,
        log: state.log,
        milestoneIndex: state.milestoneIndex
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}

function logMessage(message) {
    state.log.unshift({
        stamp: `Day ${state.day}`,
        message
    });
    state.log = state.log.slice(0, 8);
}

function getOwned(upgradeId) {
    return state.upgrades[upgradeId] || 0;
}

function getUpgradeCost(upgrade) {
    const owned = getOwned(upgrade.id);
    return Math.round(upgrade.baseCost * Math.pow(upgrade.costScale, owned));
}

function getDerivedState() {
    const cabinet = getOwned("cabinet");
    const streetTeam = getOwned("streetTeam");
    const snackBar = getOwned("snackBar");
    const prizeCounter = getOwned("prizeCounter");
    const miniStage = getOwned("miniStage");
    const technician = getOwned("technician");
    const laserWing = getOwned("laserWing");
    const influencer = getOwned("influencer");

    let visitorRate = 0.45;
    let serviceRate = 1.1;
    let spendPerVisitor = 1.2;
    let revenueMultiplier = 1;
    let promoPower = 10;
    let promoHype = 6;

    visitorRate += streetTeam * 0.9;
    serviceRate += cabinet * 2.4;
    spendPerVisitor += snackBar * 0.75;
    revenueMultiplier *= Math.pow(1.14, prizeCounter);

    promoPower += miniStage * 7;
    promoHype += miniStage * 4;

    serviceRate += technician * 1.5;
    spendPerVisitor += technician * 0.25;

    serviceRate += laserWing * 5.5;
    spendPerVisitor += laserWing * 1.2;
    visitorRate += laserWing * 0.95;

    visitorRate += influencer * 3.5;
    revenueMultiplier *= Math.pow(1.08, influencer);

    const hypeMultiplier = 1 + state.hype / 100;
    visitorRate *= hypeMultiplier;
    revenueMultiplier *= 1 + Math.min(state.hype, 60) / 250;

    const crowdCap = Math.max(18, serviceRate * 11);
    const crowdRatio = crowdCap === 0 ? 0 : state.visitors / crowdCap;
    let crowdState = "Calm";

    if (crowdRatio > 1.35) {
        crowdState = "Gridlocked";
        revenueMultiplier *= 0.84;
    } else if (crowdRatio > 1) {
        crowdState = "Packed";
        revenueMultiplier *= 0.93;
    } else if (crowdRatio > 0.66) {
        crowdState = "Buzzing";
    }

    const rent = 24 + cabinet * 4 + snackBar * 7 + laserWing * 18 + influencer * 10;

    return {
        visitorRate,
        serviceRate,
        spendPerVisitor,
        revenueMultiplier,
        promoPower,
        promoHype,
        crowdCap,
        crowdRatio,
        crowdState,
        rent
    };
}

function buyUpgrade(upgradeId) {
    const upgrade = upgrades.find((candidate) => candidate.id === upgradeId);
    if (!upgrade) {
        return;
    }

    const cost = getUpgradeCost(upgrade);
    if (state.cash < cost) {
        logMessage(`You reached for ${upgrade.name}, but the register came up short.`);
        return;
    }

    state.cash -= cost;
    state.upgrades[upgrade.id] += 1;
    logMessage(`${upgrade.name} installed. The floor now runs a little louder.`);
    render();
}

function launchPromo() {
    const derived = getDerivedState();
    state.visitors += derived.promoPower;
    state.hype = Math.min(100, state.hype + derived.promoHype);
    logMessage(`Flash promo hit the street and dragged in ${formatNumber(derived.promoPower)} extra visitors.`);
    render();
}

function hostTournament() {
    const entryCost = 160;
    if (state.cash < entryCost) {
        logMessage("Tournament night needs more cash in the drawer first.");
        return;
    }

    const derived = getDerivedState();
    state.cash -= entryCost;
    state.visitors += 55 + derived.promoPower * 1.2;
    state.hype = Math.min(100, state.hype + 18);
    logMessage("Tournament night landed. The room filled up fast and the hype shot upward.");
    render();
}

function runDayCloseout() {
    const derived = getDerivedState();
    const rent = derived.rent;
    state.cash -= rent;
    state.bestDayRevenue = Math.max(state.bestDayRevenue, state.revenueToday);

    if (state.cash < 0) {
        state.hype = Math.max(0, state.hype - 12);
        logMessage(`Day closed under water after rent. The crowd felt the slump immediately.`);
    } else {
        logMessage(`Rent of ${formatMoney(rent)} paid. Day ${state.day} closed with ${formatMoney(state.revenueToday)} in revenue.`);
    }

    state.day += 1;
    state.dayClock = 0;
    state.servedToday = 0;
    state.revenueToday = 0;
}

function checkMilestones() {
    while (state.milestoneIndex < MILESTONES.length && state.lifetimeRevenue >= MILESTONES[state.milestoneIndex]) {
        const target = MILESTONES[state.milestoneIndex];
        logMessage(`Milestone cleared: ${formatMoney(target)} lifetime revenue. The arcade is becoming a real city fixture.`);
        state.milestoneIndex += 1;
    }
}

function tick(now) {
    const deltaSeconds = Math.min((now - lastFrame) / 1000, 0.25);
    lastFrame = now;

    const derived = getDerivedState();

    state.dayClock += deltaSeconds;
    state.hype = Math.max(0, state.hype - 0.3 * deltaSeconds);

    state.visitors += derived.visitorRate * deltaSeconds;

    const served = Math.min(state.visitors, derived.serviceRate * deltaSeconds);
    state.visitors -= served;

    if (state.visitors > derived.crowdCap) {
        const spill = Math.min(state.visitors - derived.crowdCap, derived.serviceRate * 0.3 * deltaSeconds);
        state.visitors -= spill;
        state.hype = Math.max(0, state.hype - spill * 0.08);
    }

    const revenue = served * derived.spendPerVisitor * derived.revenueMultiplier;
    state.cash += revenue;
    state.revenueToday += revenue;
    state.lifetimeRevenue += revenue;
    state.servedToday += served;

    const instantIncome = deltaSeconds === 0 ? 0 : revenue / deltaSeconds;
    state.smoothedIncome += (instantIncome - state.smoothedIncome) * 0.16;

    if (state.dayClock >= DAY_LENGTH_SECONDS) {
        runDayCloseout();
    }

    checkMilestones();

    if (now >= autosaveAt) {
        saveGame();
        autosaveAt = now + SAVE_INTERVAL_MS;
    }

    render();
    requestAnimationFrame(tick);
}

function render() {
    const derived = getDerivedState();

    elements.cash.textContent = formatMoney(state.cash);
    elements.income.textContent = `${formatMoney(state.smoothedIncome)}/sec`;
    elements.visitors.textContent = formatNumber(state.visitors);
    elements.service.textContent = `${formatNumber(derived.serviceRate)} served/sec`;
    elements.hype.textContent = `${Math.round(state.hype)}%`;
    elements.walkin.textContent = `${formatNumber(derived.visitorRate)} walk-ins/sec`;
    elements.day.textContent = String(state.day);
    elements.rent.textContent = `Rent ${formatMoney(derived.rent)}`;

    const nextMilestone = MILESTONES[state.milestoneIndex];
    elements.goal.textContent = nextMilestone
        ? `Next milestone: ${formatMoney(nextMilestone)} lifetime`
        : "Every milestone cleared. Keep printing money.";

    const crowdPercent = Math.max(0, Math.min(100, derived.crowdRatio * 100));
    elements.crowdFill.style.width = `${crowdPercent}%`;
    elements.crowdLabel.textContent = derived.crowdState;

    const profitPercent = Math.max(0, Math.min(100, (state.revenueToday / Math.max(derived.rent * 2.5, 1)) * 100));
    elements.profitFill.style.width = `${profitPercent}%`;
    elements.profitLabel.textContent = `${formatMoney(state.revenueToday)} today`;

    elements.lifetime.textContent = formatMoney(state.lifetimeRevenue);
    elements.bestDay.textContent = formatMoney(state.bestDayRevenue);
    elements.promoPower.textContent = `${formatNumber(derived.promoPower)} visitors`;

    elements.eventButton.disabled = state.cash < 160;

    renderUpgrades();
    renderLog();
}

function renderUpgrades() {
    const fragment = document.createDocumentFragment();

    upgrades.forEach((upgrade) => {
        const node = elements.upgradeTemplate.content.firstElementChild.cloneNode(true);
        const button = node.querySelector(".upgrade-card__button");
        const cost = getUpgradeCost(upgrade);

        node.querySelector(".upgrade-card__title").textContent = upgrade.name;
        node.querySelector(".upgrade-card__description").textContent = upgrade.description;
        node.querySelector(".upgrade-card__count").textContent = `x${getOwned(upgrade.id)}`;
        node.querySelector(".upgrade-card__effect").textContent = `${upgrade.effectSummary} | Cost ${formatMoney(cost)}`;
        button.textContent = `Buy ${formatMoney(cost)}`;
        button.disabled = state.cash < cost;
        button.addEventListener("click", () => buyUpgrade(upgrade.id));

        fragment.appendChild(node);
    });

    elements.upgradeList.replaceChildren(fragment);
}

function renderLog() {
    const fragment = document.createDocumentFragment();

    state.log.forEach((entry) => {
        const item = document.createElement("article");
        item.className = "log-item";

        const time = document.createElement("div");
        time.className = "log-item__time";
        time.textContent = entry.stamp;

        const message = document.createElement("div");
        message.className = "log-item__message";
        message.textContent = entry.message;

        item.append(time, message);
        fragment.appendChild(item);
    });

    elements.logList.replaceChildren(fragment);
}

function formatMoney(value) {
    const absolute = Math.abs(value);

    if (absolute >= 1000000) {
        return `${value < 0 ? "-" : ""}$${(absolute / 1000000).toFixed(2)}M`;
    }

    if (absolute >= 1000) {
        return `${value < 0 ? "-" : ""}$${(absolute / 1000).toFixed(1)}K`;
    }

    if (absolute >= 100) {
        return `${value < 0 ? "-" : ""}$${absolute.toFixed(0)}`;
    }

    return `${value < 0 ? "-" : ""}$${absolute.toFixed(1)}`;
}

function formatNumber(value) {
    if (value >= 1000) {
        return `${(value / 1000).toFixed(1)}K`;
    }

    return value.toFixed(value >= 10 ? 0 : 1);
}

elements.promoButton.addEventListener("click", launchPromo);
elements.eventButton.addEventListener("click", hostTournament);
elements.saveButton.addEventListener("click", () => {
    saveGame();
    logMessage("Manual save locked in.");
    render();
});

window.addEventListener("beforeunload", saveGame);

loadGame();
render();
requestAnimationFrame(tick);
