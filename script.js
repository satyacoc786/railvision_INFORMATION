// Mobile nav toggle
const navToggle = document.getElementById("navToggle");
const primaryNav = document.getElementById("primaryNav");
navToggle.addEventListener("click", () => {
  const open = primaryNav.classList.toggle("open");
  navToggle.setAttribute("aria-expanded", String(open));
});
primaryNav.addEventListener("click", (e) => {
  if (e.target.tagName === "A") {
    primaryNav.classList.remove("open");
    navToggle.setAttribute("aria-expanded", "false");
  }
});

// --- Threat Simulator ---
// Prototype scoring only — NOT real detection.
// Base score profiles per scenario (visual, sensor, context) as 0-100 values.
const SCENARIO_PROFILES = {
  suspicious: { visual: [70, 90], sensor: [70, 88], context: [55, 75] },
  normal: { visual: [5, 25], sensor: [5, 25], context: [10, 30] },
  unattended: { visual: [55, 78], sensor: [40, 65], context: [45, 70] },
  restricted: { visual: [60, 82], sensor: [50, 72], context: [65, 85] },
};

const WEIGHTS = { visual: 0.5, sensor: 0.4, context: 0.1 };

function rand(min, max) {
  return Math.round(min + Math.random() * (max - min));
}

function classify(score) {
  if (score <= 30) return "LOW";
  if (score <= 70) return "MEDIUM";
  return "HIGH";
}

const CLASSIFICATIONS = {
  suspicious: "Suspicious Security Event",
  normal: "Normal Situation",
  unattended: "Unattended Luggage",
  restricted: "Restricted-Area Activity",
};

// State
let incidents = [];
let incidentCounter = 0;
let online = true;

// Elements
const simForm = document.getElementById("simForm");
const runBtn = document.getElementById("runBtn");
const steps = Array.from(document.querySelectorAll("#pipelineSteps [data-step]"));
const scoresEl = document.getElementById("scores");
const alertCard = document.getElementById("alertCard");
const incidentsBody = document.getElementById("incidentsBody");
const toggleNetwork = document.getElementById("toggleNetwork");
const syncBtn = document.getElementById("syncBtn");
const syncStatus = document.getElementById("syncStatus");
const syncNote = document.getElementById("syncNote");

function nowTime() {
  return new Date().toLocaleTimeString("en-GB", { hour12: false });
}

function resetPipeline() {
  steps.forEach((s) => s.classList.remove("active", "done"));
  scoresEl.hidden = true;
  alertCard.hidden = true;
}

function runPipeline() {
  return new Promise((resolve) => {
    resetPipeline();
    let i = 0;
    const interval = setInterval(() => {
      if (i > 0) steps[i - 1].classList.add("done");
      if (i < steps.length) {
        steps[i].classList.add("active");
        i++;
      } else {
        clearInterval(interval);
        resolve();
      }
    }, 450);
  });
}

simForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  runBtn.disabled = true;
  runBtn.textContent = "Running…";

  const device = document.getElementById("device").value;
  const location = document.getElementById("location").value;
  const scenario = document.getElementById("scenario").value;

  await runPipeline();

  const p = SCENARIO_PROFILES[scenario];
  const visual = rand(p.visual[0], p.visual[1]);
  const sensor = rand(p.sensor[0], p.sensor[1]);
  const context = rand(p.context[0], p.context[1]);
  const total = Math.round(
    WEIGHTS.visual * visual + WEIGHTS.sensor * sensor + WEIGHTS.context * context
  );
  const level = classify(total);

  // Scores
  document.getElementById("visualScore").textContent = visual;
  document.getElementById("sensorScore").textContent = sensor;
  document.getElementById("contextScore").textContent = context;
  document.getElementById("totalScore").textContent = total;
  scoresEl.hidden = false;

  // Alert
  const time = nowTime();
  alertCard.dataset.level = level;
  document.getElementById("riskBadge").textContent = level;
  document.getElementById("alertTitle").textContent =
    level === "LOW" ? "Situation Normal" : "Security Alert";
  document.getElementById("metaRisk").textContent = level;
  document.getElementById("metaDevice").textContent = device;
  document.getElementById("metaLocation").textContent = location;
  document.getElementById("metaTime").textContent = time;
  document.getElementById("alertSent").textContent = online
    ? "Alert sent to control centre."
    : "Network offline — event stored locally.";
  alertCard.hidden = false;

  // Incident record
  incidentCounter++;
  incidents.unshift({
    id: "INC-" + String(incidentCounter).padStart(3, "0"),
    classification: CLASSIFICATIONS[scenario],
    level,
    location,
    time,
    synced: online,
  });

  renderIncidents();
  updateDashboard();
  updateSyncUI();

  runBtn.disabled = false;
  runBtn.textContent = "Run Simulation";
});

function renderIncidents() {
  if (incidents.length === 0) {
    incidentsBody.innerHTML =
      '<tr class="empty-row"><td colspan="6">No incidents yet — run a simulation to generate one.</td></tr>';
    return;
  }
  incidentsBody.innerHTML = incidents
    .map(
      (inc) => `
      <tr>
        <td>${inc.id}</td>
        <td>${inc.classification}</td>
        <td><span class="risk-pill ${inc.level}">${inc.level}</span></td>
        <td>${inc.location}</td>
        <td>${inc.time}</td>
        <td class="${inc.synced ? "status-synced" : "status-pending"}">${
        inc.synced ? "Synced" : "Pending"
      }</td>
      </tr>`
    )
    .join("");
}

function updateDashboard() {
  const high = incidents.filter((i) => i.level === "HIGH").length;
  const medium = incidents.filter((i) => i.level === "MEDIUM").length;
  const pending = incidents.filter((i) => !i.synced).length;
  document.getElementById("statTotal").textContent = incidents.length;
  document.getElementById("statHigh").textContent = high;
  document.getElementById("statMedium").textContent = medium;
  document.getElementById("statPending").textContent = pending;
}

function updateSyncUI() {
  const pending = incidents.filter((i) => !i.synced).length;
  syncStatus.dataset.online = String(online);
  toggleNetwork.textContent = online ? "Network: ON" : "Network: OFF";
  syncBtn.hidden = !(online && pending > 0);
  if (!online && pending > 0) {
    syncNote.textContent = pending + " event(s) stored locally.";
  } else if (online && pending > 0) {
    syncNote.textContent = pending + " event(s) waiting to sync.";
  } else {
    syncNote.textContent = "";
  }
}

toggleNetwork.addEventListener("click", () => {
  online = !online;
  updateSyncUI();
});

syncBtn.addEventListener("click", () => {
  const pending = incidents.filter((i) => !i.synced).length;
  const total = incidents.length;
  incidents.forEach((i) => (i.synced = true));
  renderIncidents();
  updateDashboard();
  syncNote.textContent = `${pending}/${total} events synchronized.`;
  syncBtn.hidden = true;
});

// Init
updateSyncUI();
