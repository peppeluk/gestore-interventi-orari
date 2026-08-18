/* ============================================================
   sheets-sync.js - Google Sheets bidirectional sync
   ============================================================ */

const SHEETS_SYNC_KEY = "ore_interventi_sheets_endpoint";
const SHEETS_RETRY_KEY = "ore_interventi_sheets_retry_queue";
const SHEETS_STATUS_KEY = "ore_interventi_sheets_sync_status";

let sheetsEndpoint = localStorage.getItem(SHEETS_SYNC_KEY) || "";
let sheetsBusy = false;
let sheetsRetryQueue = loadRetryQueue();
let sheetsInitialized = false;
let lastSyncStatus = localStorage.getItem(SHEETS_STATUS_KEY) || "idle";
let lastSyncTime = null;

function isSheetsConfigured() {
  return !!sheetsEndpoint;
}

function setSheetsEndpoint(url) {
  sheetsEndpoint = (url || "").trim();
  if (sheetsEndpoint) {
    localStorage.setItem(SHEETS_SYNC_KEY, sheetsEndpoint);
  } else {
    localStorage.removeItem(SHEETS_SYNC_KEY);
  }
}

function getSheetsEndpoint() {
  return sheetsEndpoint;
}

function getSyncStatus() {
  return lastSyncStatus;
}

function getSyncTime() {
  return lastSyncTime;
}

function loadRetryQueue() {
  try {
    const raw = localStorage.getItem(SHEETS_RETRY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRetryQueue() {
  try {
    localStorage.setItem(SHEETS_RETRY_KEY, JSON.stringify(sheetsRetryQueue));
  } catch { /* quota exceeded, ignore */ }
}

function updateSyncStatus(status) {
  lastSyncStatus = status;
  localStorage.setItem(SHEETS_STATUS_KEY, status);
  renderSyncIndicator();
}

function renderSyncIndicator() {
  const el = document.getElementById("syncIndicator");
  if (!el) return;
  if (!isSheetsConfigured()) {
    el.textContent = "OFF";
    el.className = "sync-badge sync-off";
    el.title = "Sync Google Sheets non configurato";
    return;
  }
  const timeStr = lastSyncTime
    ? lastSyncTime.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })
    : "";
  switch (lastSyncStatus) {
    case "syncing":
      el.textContent = "SYNC...";
      el.className = "sync-badge sync-busy";
      el.title = "Sincronizzazione in corso...";
      break;
    case "ok":
      el.textContent = timeStr ? `OK ${timeStr}` : "OK";
      el.className = "sync-badge sync-ok";
      el.title = "Dati sincronizzati con Google Sheets";
      break;
    case "error":
      el.textContent = "ERR";
      el.className = "sync-badge sync-error";
      el.title = "Errore di sincronizzazione. I dati restano in locale.";
      break;
    case "offline":
      el.textContent = "OFFLINE";
      el.className = "sync-badge sync-offline";
      el.title = "Offline. I dati verranno sincronizzati alla riconnessione.";
      break;
    default:
      el.textContent = "OK";
      el.className = "sync-badge sync-ok";
      el.title = "Sync attivo";
  }
}

// --------------- Core sync functions ---------------

async function sheetsFetch(method, body) {
  if (!sheetsEndpoint) return null;
  const opts = {
    method: method === "POST" ? "POST" : "GET",
    redirect: "follow"
  };
  if (method === "POST" && body) {
    opts.headers = { "Content-Type": "text/plain;charset=utf-8" };
    opts.body = JSON.stringify(body);
  }
  const resp = await fetch(sheetsEndpoint, opts);
  if (method === "GET") {
    const text = await resp.text();
    try { return JSON.parse(text); } catch { return null; }
  }
  try {
    const text = await resp.text();
    return JSON.parse(text);
  } catch {
    return { ok: true };
  }
}

function mergeRecord(local, remote) {
  if (!remote) return local;
  if (!local) return remote;
  const lt = local.updatedAt || "";
  const rt = remote.updatedAt || "";
  if (rt > lt) {
    return { ...remote };
  }
  return { ...local };
}

function mergeStates(localState, remoteState) {
  const mergedClients = new Map();
  const mergedInterventions = new Map();

  // Index local
  for (const c of localState.clients) mergedClients.set(c.id, c);
  for (const i of localState.interventions) mergedInterventions.set(i.id, i);

  // Merge remote into local
  for (const rc of (remoteState.clients || [])) {
    const lc = mergedClients.get(rc.id);
    mergedClients.set(rc.id, mergeRecord(lc, rc));
  }
  for (const ri of (remoteState.interventions || [])) {
    const li = mergedInterventions.get(ri.id);
    mergedInterventions.set(ri.id, mergeRecord(li, ri));
  }

  return {
    schemaVersion: localState.schemaVersion,
    clients: Array.from(mergedClients.values()).filter(c => !c.deleted),
    interventions: Array.from(mergedInterventions.values()).filter(i => !i.deleted)
  };
}

async function pullFromSheets() {
  if (!isSheetsConfigured()) return null;
  if (!navigator.onLine) return null;
  try {
    const remote = await sheetsFetch("GET");
    if (!remote || remote.error) return null;
    return {
      clients: Array.isArray(remote.clients) ? remote.clients : [],
      interventions: Array.isArray(remote.interventions) ? remote.interventions : []
    };
  } catch {
    return null;
  }
}

async function pushToSheets(stateToSend) {
  if (!isSheetsConfigured()) return true;
  if (!navigator.onLine) {
    updateSyncStatus("offline");
    addToRetryQueue(stateToSend);
    return false;
  }
  try {
    updateSyncStatus("syncing");
    const result = await sheetsFetch("POST", stateToSend);
    if (result && result.ok) {
      updateSyncStatus("ok");
      lastSyncTime = new Date();
      renderSyncIndicator();
      return true;
    }
    throw new Error("Risposta non valida");
  } catch (err) {
    console.warn("Sheets push error:", err);
    updateSyncStatus("error");
    addToRetryQueue(stateToSend);
    return false;
  }
}

function addToRetryQueue(stateToSend) {
  sheetsRetryQueue.push({
    state: JSON.parse(JSON.stringify(stateToSend)),
    timestamp: Date.now()
  });
  if (sheetsRetryQueue.length > 5) {
    sheetsRetryQueue = sheetsRetryQueue.slice(-3);
  }
  saveRetryQueue();
}

async function processRetryQueue() {
  if (!sheetsRetryQueue.length || sheetsBusy || !isSheetsConfigured()) return;
  if (!navigator.onLine) return;

  const queued = sheetsRetryQueue.shift();
  saveRetryQueue();
  try {
    updateSyncStatus("syncing");
    const result = await sheetsFetch("POST", queued.state);
    if (result && result.ok) {
      updateSyncStatus("ok");
      lastSyncTime = new Date();
      renderSyncIndicator();
    } else {
      throw new Error("Retry fallito");
    }
  } catch {
    updateSyncStatus("error");
    if (sheetsRetryQueue.length < 5) {
      sheetsRetryQueue.unshift(queued);
      saveRetryQueue();
    }
  }
}

// --------------- Full sync: pull + merge + save ---------------

async function syncFromSheets() {
  if (!isSheetsConfigured() || sheetsBusy) return;
  sheetsBusy = true;
  try {
    updateSyncStatus("syncing");
    const remote = await pullFromSheets();
    if (!remote) {
      updateSyncStatus(navigator.onLine ? "error" : "offline");
      return;
    }

    // Merge remote with local state
    const merged = mergeStates(state, remote);

    // Apply merged state to local state
    state.clients = merged.clients;
    state.interventions = merged.interventions;

    // Save to localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

    // Push merged result back to sheets (filter deleted records)
    await pushToSheets({
      clients: state.clients.filter(c => !c.deleted).map(c => ({
        id: c.id,
        name: c.name,
        hourlyRate: c.hourlyRate,
        updatedAt: c.updatedAt || new Date().toISOString()
      })),
      interventions: state.interventions.filter(i => !i.deleted).map(i => ({
        id: i.id,
        clientId: i.clientId,
        date: i.date,
        start: i.start,
        end: i.end,
        minutes: i.minutes,
        description: i.description,
        status: i.status,
        paidAt: i.paidAt,
        createdAt: i.createdAt,
        updatedAt: i.updatedAt || new Date().toISOString()
      }))
    });

    updateSyncStatus("ok");
    lastSyncTime = new Date();
    renderSyncIndicator();

    // Trigger UI refresh
    ensureSeedDataShape();
    renderClientsDatalist();
    renderClientsList();
  } catch (err) {
    console.warn("Sync error:", err);
    updateSyncStatus("error");
  } finally {
    sheetsBusy = false;
  }
}

// --------------- Auto-push after saveState ---------------

let pushDebounceTimer = null;

function triggerSheetsPush() {
  if (!isSheetsConfigured()) return;
  if (pushDebounceTimer) clearTimeout(pushDebounceTimer);
  pushDebounceTimer = setTimeout(() => {
    pushToSheets({
      clients: state.clients.filter(c => !c.deleted).map(c => ({
        id: c.id,
        name: c.name,
        hourlyRate: c.hourlyRate,
        updatedAt: c.updatedAt || new Date().toISOString()
      })),
      interventions: state.interventions.filter(i => !i.deleted).map(i => ({
        id: i.id,
        clientId: i.clientId,
        date: i.date,
        start: i.start,
        end: i.end,
        minutes: i.minutes,
        description: i.description,
        status: i.status,
        paidAt: i.paidAt,
        createdAt: i.createdAt,
        updatedAt: i.updatedAt || new Date().toISOString()
      }))
    });
  }, 500);
}

// --------------- Init ---------------

function initSheetsSync() {
  if (sheetsInitialized) return;
  sheetsInitialized = true;

  renderSyncIndicator();

  // Initial pull from sheets
  if (isSheetsConfigured()) {
    syncFromSheets();
  }

  // Process retry queue when coming back online
  window.addEventListener("online", () => {
    renderSyncIndicator();
    if (isSheetsConfigured()) {
      processRetryQueue();
      setTimeout(syncFromSheets, 1000);
    }
  });

  window.addEventListener("offline", () => {
    updateSyncStatus("offline");
  });
}

// --------------- Setup UI (endpoint config) ---------------

function promptSheetsSetup() {
  const current = getSheetsEndpoint();
  const input = prompt(
    "Inserisci l'URL del Google Apps Script Web App.\n" +
    "Lo trovi in Google Apps Script > Deploy > Nuovo deploy > App Web.\n\n" +
    "URL attuale: " + (current || "(nessuno)") + "\n\n" +
    "Lascia vuoto per disabilitare il sync.",
    current
  );
  if (input === null) return;
  setSheetsEndpoint(input);
  renderSyncIndicator();
  if (isSheetsConfigured()) {
    syncFromSheets();
  }
}
