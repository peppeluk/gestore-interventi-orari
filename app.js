const STORAGE_KEY = "ore_interventi_pwa_v1";
const SCHEMA_VERSION = 2;
const STATUS_PENDING = "pending";
const STATUS_SELECTED = "selected";
const STATUS_PAID = "paid";

const state = loadState();
const navStack = [];
let currentScreen = "home";
let currentClientId = null;
let currentClientFilter = "";
let detailShowAll = false;
let editingInterventionId = null;

const refs = {};

document.addEventListener("DOMContentLoaded", () => {
  bindRefs();
  bindEvents();
  ensureSeedDataShape();
  renderClientsDatalist();
  prepareNewForm();
  navigateTo("home", { push: false });
  registerServiceWorker();
});

function bindRefs() {
  refs.backBtn = document.getElementById("backBtn");
  refs.screenTitle = document.getElementById("screenTitle");
  refs.screenSubtitle = document.getElementById("screenSubtitle");
  refs.goClients = document.getElementById("goClients");
  refs.goNewIntervention = document.getElementById("goNewIntervention");

  refs.clientSearch = document.getElementById("clientSearch");
  refs.clientsList = document.getElementById("clientsList");
  refs.clientsDatalist = document.getElementById("clientsDatalist");

  refs.interventionForm = document.getElementById("interventionForm");
  refs.clientInput = document.getElementById("clientInput");
  refs.dateInput = document.getElementById("dateInput");
  refs.startInput = document.getElementById("startInput");
  refs.endInput = document.getElementById("endInput");
  refs.descInput = document.getElementById("descInput");
  refs.saveInterventionBtn = document.getElementById("saveInterventionBtn");
  refs.cancelEditBtn = document.getElementById("cancelEditBtn");

  refs.detailClientName = document.getElementById("detailClientName");
  refs.clientRateInput = document.getElementById("clientRateInput");
  refs.totalUnpaid = document.getElementById("totalUnpaid");
  refs.totalUnpaidAmount = document.getElementById("totalUnpaidAmount");
  refs.totalSelected = document.getElementById("totalSelected");
  refs.totalSelectedAmount = document.getElementById("totalSelectedAmount");
  refs.toggleAllBtn = document.getElementById("toggleAllBtn");
  refs.markSelectedPaidBtn = document.getElementById("markSelectedPaidBtn");
  refs.detailList = document.getElementById("detailList");

  refs.clientRowTpl = document.getElementById("clientRowTpl");
  refs.interventionRowTpl = document.getElementById("interventionRowTpl");
}

function bindEvents() {
  refs.backBtn.addEventListener("click", onBack);
  refs.goClients.addEventListener("click", () => navigateTo("clients"));
  refs.goNewIntervention.addEventListener("click", () => {
    prepareNewForm();
    navigateTo("new");
  });

  refs.clientSearch.addEventListener("input", evt => {
    currentClientFilter = String(evt.target.value || "").trim().toLocaleLowerCase();
    renderClientsList();
  });

  refs.clientsList.addEventListener("click", evt => {
    const actionBtn = evt.target.closest("button[data-action]");
    if (!actionBtn) return;
    const action = actionBtn.dataset.action || "";
    const clientId = actionBtn.dataset.clientId || "";
    if (!clientId || !action) return;

    if (action === "open") {
      openClientDetail(clientId);
      return;
    }
    if (action === "delete") {
      deleteClient(clientId);
    }
  });

  refs.interventionForm.addEventListener("submit", onSubmitIntervention);
  refs.cancelEditBtn.addEventListener("click", onCancelEdit);

  refs.markSelectedPaidBtn.addEventListener("click", () => {
    if (!currentClientId) return;
    const selected = state.interventions.filter(
      i => i.clientId === currentClientId && i.status === STATUS_SELECTED
    );
    if (!selected.length) return;
    const paidAt = new Date().toISOString();
    selected.forEach(item => {
      item.status = STATUS_PAID;
      item.paidAt = paidAt;
    });
    saveState();
    renderClientDetail();
    renderClientsList();
  });

  refs.toggleAllBtn.addEventListener("click", () => {
    detailShowAll = !detailShowAll;
    renderClientDetail();
  });

  refs.clientRateInput.addEventListener("change", onClientRateChange);

  refs.detailList.addEventListener("click", evt => {
    const actionBtn = evt.target.closest("button[data-action]");
    if (!actionBtn) return;

    const id = actionBtn.dataset.id || "";
    const action = actionBtn.dataset.action || "";
    if (!id || !action) return;

    if (action === "toggle-select") {
      toggleInterventionSelection(id);
      return;
    }
    if (action === "mark-paid") {
      markInterventionPaid(id);
      return;
    }
    if (action === "mark-unpaid") {
      markInterventionUnpaid(id);
      return;
    }
    if (action === "edit") {
      startEditIntervention(id);
      return;
    }
    if (action === "delete") {
      deleteIntervention(id);
    }
  });
}

function navigateTo(screen, options = {}) {
  const { push = true } = options;
  if (push && currentScreen) {
    navStack.push({ screen: currentScreen, clientId: currentClientId });
  }

  currentScreen = screen;
  updateHeaderForScreen(screen);
  showScreen(screen);

  if (screen === "clients") {
    renderClientsList();
  } else if (screen === "new") {
    renderClientsDatalist();
  } else if (screen === "client-detail") {
    renderClientDetail();
  }
}

function onBack() {
  if (!navStack.length) {
    navigateTo("home", { push: false });
    return;
  }
  const prev = navStack.pop();
  currentClientId = prev.clientId || null;
  navigateTo(prev.screen, { push: false });
}

function updateHeaderForScreen(screen) {
  if (screen === "home") {
    refs.screenTitle.textContent = "Ore Interventi";
    refs.screenSubtitle.textContent = "Gestione ore per cliente";
    refs.backBtn.hidden = true;
    return;
  }
  refs.backBtn.hidden = false;
  if (screen === "clients") {
    refs.screenTitle.textContent = "Clienti";
    refs.screenSubtitle.textContent = "Apri cliente e controlla ore non pagate";
    return;
  }
  if (screen === "new") {
    refs.screenTitle.textContent = editingInterventionId ? "Modifica intervento" : "Nuovo intervento";
    refs.screenSubtitle.textContent = editingInterventionId
      ? "Aggiorna data, orari e descrizione"
      : "Data, orari e descrizione";
    return;
  }
  if (screen === "client-detail") {
    const client = getClientById(currentClientId);
    refs.screenTitle.textContent = client ? client.name : "Cliente";
    refs.screenSubtitle.textContent = "Interventi non pagati e selezionati";
  }
}

function showScreen(screen) {
  document.querySelectorAll(".screen").forEach(el => {
    el.classList.toggle("is-active", el.id === `screen-${screen}`);
  });
}

function openClientDetail(clientId) {
  currentClientId = clientId;
  detailShowAll = false;
  navigateTo("client-detail");
}

function renderClientsDatalist() {
  refs.clientsDatalist.innerHTML = "";
  state.clients.forEach(client => {
    const option = document.createElement("option");
    option.value = client.name;
    refs.clientsDatalist.appendChild(option);
  });
}

function renderClientsList() {
  refs.clientsList.innerHTML = "";
  let clients = [...state.clients];
  clients.sort((a, b) => a.name.localeCompare(b.name, "it"));

  if (currentClientFilter) {
    clients = clients.filter(c =>
      c.name.toLocaleLowerCase().includes(currentClientFilter)
    );
  }

  if (!clients.length) {
    refs.clientsList.appendChild(
      createEmpty("Nessun cliente trovato. Inseriscilo dal form 'Nuovo intervento'.")
    );
    return;
  }

  clients.forEach(client => {
    const unpaid = getClientInterventions(client.id).filter(i => i.status !== STATUS_PAID);
    const totalMinutes = sumMinutes(unpaid);
    const row = refs.clientRowTpl.content.firstElementChild.cloneNode(true);
    row.querySelector(".client-name").textContent = client.name;
    row.querySelector(".client-meta").textContent =
      `${unpaid.length} interventi non pagati - ${formatMinutes(totalMinutes)}`;
    const openBtn = row.querySelector(".open-client-btn");
    const deleteBtn = row.querySelector(".delete-client-btn");
    openBtn.dataset.action = "open";
    openBtn.dataset.clientId = client.id;
    deleteBtn.dataset.action = "delete";
    deleteBtn.dataset.clientId = client.id;
    refs.clientsList.appendChild(row);
  });
}

function prepareNewForm(prefillClientName = "") {
  editingInterventionId = null;
  const now = new Date();
  const end = new Date(now.getTime() + 60 * 60000);
  refs.dateInput.value = toDateInputValue(now);
  refs.startInput.value = toTimeInputValue(now);
  refs.endInput.value = toTimeInputValue(end);
  refs.clientInput.value = prefillClientName;
  refs.descInput.value = "";
  refs.saveInterventionBtn.textContent = "Salva intervento";
  refs.cancelEditBtn.hidden = true;
  updateHeaderForScreen("new");
}

function onSubmitIntervention(evt) {
  evt.preventDefault();
  const clientName = normalizeClientName(refs.clientInput.value);
  if (!clientName) {
    alert("Inserisci un cliente.");
    refs.clientInput.focus();
    return;
  }

  const date = refs.dateInput.value;
  const start = refs.startInput.value;
  const end = refs.endInput.value;
  const description = String(refs.descInput.value || "").trim();

  if (!date || !start || !end) {
    alert("Compila data, ora inizio e ora fine.");
    return;
  }

  const minutes = computeDurationMinutes(start, end);
  if (minutes <= 0) {
    alert("Ora fine non valida: deve produrre una durata maggiore di 0 minuti.");
    return;
  }

  const client = ensureClient(clientName);
  const editing = editingInterventionId
    ? state.interventions.find(i => i.id === editingInterventionId)
    : null;

  if (editing) {
    editing.clientId = client.id;
    editing.date = date;
    editing.start = start;
    editing.end = end;
    editing.minutes = minutes;
    editing.description = description;
  } else {
    const intervention = {
      id: createId("int"),
      clientId: client.id,
      date,
      start,
      end,
      minutes,
      description,
      status: STATUS_SELECTED,
      paidAt: null,
      createdAt: new Date().toISOString()
    };
    state.interventions.push(intervention);
  }

  editingInterventionId = null;
  saveState();
  renderClientsDatalist();
  renderClientsList();
  currentClientId = client.id;
  navigateTo("client-detail");
}

function renderClientDetail() {
  const client = getClientById(currentClientId);
  refs.detailList.innerHTML = "";

  if (!client) {
    refs.detailClientName.textContent = "Cliente non trovato";
    refs.clientRateInput.value = "";
    refs.clientRateInput.disabled = true;
    refs.totalUnpaid.textContent = "0h 00m";
    refs.totalUnpaidAmount.textContent = "€ 0,00";
    refs.totalSelected.textContent = "0h 00m";
    refs.totalSelectedAmount.textContent = "€ 0,00";
    refs.toggleAllBtn.disabled = true;
    refs.markSelectedPaidBtn.disabled = true;
    refs.detailList.appendChild(createEmpty("Cliente non trovato."));
    return;
  }

  refs.detailClientName.textContent = client.name;
  refs.clientRateInput.disabled = false;
  refs.clientRateInput.value = formatRateInput(client.hourlyRate);

  const allItems = getClientInterventions(client.id).sort(compareInterventionsDesc);
  const unpaidItems = allItems.filter(item => item.status !== STATUS_PAID);
  const items = detailShowAll ? allItems : unpaidItems;
  const rate = getClientRate(client);

  const selectedItems = unpaidItems.filter(item => item.status === STATUS_SELECTED);
  refs.totalUnpaid.textContent = formatMinutes(sumMinutes(unpaidItems));
  refs.totalUnpaidAmount.textContent = formatCurrency(computeAmountFromMinutes(sumMinutes(unpaidItems), rate));
  refs.totalSelected.textContent = formatMinutes(sumMinutes(selectedItems));
  refs.totalSelectedAmount.textContent = formatCurrency(computeAmountFromMinutes(sumMinutes(selectedItems), rate));
  refs.toggleAllBtn.disabled = false;
  refs.toggleAllBtn.textContent = detailShowAll
    ? "Visualizza tutti gli interventi (attivo)"
    : "Visualizza tutti gli interventi";
  refs.markSelectedPaidBtn.disabled = selectedItems.length === 0;

  if (!items.length) {
    refs.detailList.appendChild(
      createEmpty(
        detailShowAll
          ? "Nessun intervento registrato per questo cliente."
          : "Nessun intervento non pagato per questo cliente."
      )
    );
    return;
  }

  items.forEach(item => {
    const node = refs.interventionRowTpl.content.firstElementChild.cloneNode(true);
    const amount = computeAmountFromMinutes(item.minutes, rate);
    node.querySelector(".int-date").textContent = formatDateHuman(item.date);
    node.querySelector(".int-time").textContent =
      `${item.start} - ${item.end} (${formatMinutes(item.minutes)}) - ${formatCurrency(amount)}`;
    node.querySelector(".int-desc").textContent = item.description || "Nessuna descrizione";
    const paidAtEl = node.querySelector(".int-paid-at");

    const badge = node.querySelector(".status-badge");
    const toggleBtn = node.querySelector(".toggle-select-btn");
    const paidBtn = node.querySelector(".mark-paid-btn");
    const editBtn = node.querySelector(".edit-int-btn");
    const deleteBtn = node.querySelector(".delete-int-btn");

    if (item.status === STATUS_PAID) {
      badge.textContent = "Pagato";
      badge.classList.add("status-paid");
      if (item.paidAt) {
        paidAtEl.hidden = false;
        paidAtEl.textContent = `Pagato il ${formatDateTimeHuman(item.paidAt)}`;
      } else {
        paidAtEl.hidden = false;
        paidAtEl.textContent = "Pagamento registrato";
      }
      toggleBtn.hidden = true;
      paidBtn.hidden = false;
      paidBtn.textContent = "Rendi non pagato";
    } else if (item.status === STATUS_SELECTED) {
      badge.textContent = "Selezionato";
      badge.classList.add("status-selected");
      toggleBtn.textContent = "Rimuovi selezione";
      toggleBtn.hidden = false;
      paidBtn.hidden = false;
    } else {
      badge.textContent = "Da pagare";
      badge.classList.add("status-pending");
      toggleBtn.textContent = "Seleziona per pagamento";
      toggleBtn.hidden = false;
      paidBtn.hidden = false;
      paidAtEl.hidden = true;
    }

    toggleBtn.dataset.action = "toggle-select";
    toggleBtn.dataset.id = item.id;
    paidBtn.dataset.action = item.status === STATUS_PAID ? "mark-unpaid" : "mark-paid";
    paidBtn.dataset.id = item.id;
    editBtn.dataset.action = "edit";
    editBtn.dataset.id = item.id;
    deleteBtn.dataset.action = "delete";
    deleteBtn.dataset.id = item.id;

    refs.detailList.appendChild(node);
  });
}

function toggleInterventionSelection(interventionId) {
  const item = state.interventions.find(i => i.id === interventionId);
  if (!item || item.status === STATUS_PAID) return;
  item.status = item.status === STATUS_SELECTED ? STATUS_PENDING : STATUS_SELECTED;
  saveState();
  renderClientDetail();
  renderClientsList();
}

function markInterventionPaid(interventionId) {
  const item = state.interventions.find(i => i.id === interventionId);
  if (!item || item.status === STATUS_PAID) return;
  item.status = STATUS_PAID;
  item.paidAt = new Date().toISOString();
  saveState();
  renderClientDetail();
  renderClientsList();
}

function markInterventionUnpaid(interventionId) {
  const item = state.interventions.find(i => i.id === interventionId);
  if (!item || item.status !== STATUS_PAID) return;
  item.status = STATUS_PENDING;
  item.paidAt = null;
  saveState();
  renderClientDetail();
  renderClientsList();
}

function startEditIntervention(interventionId) {
  const item = state.interventions.find(i => i.id === interventionId);
  if (!item) return;
  const client = getClientById(item.clientId);

  editingInterventionId = item.id;
  refs.clientInput.value = client ? client.name : "";
  refs.dateInput.value = item.date || toDateInputValue(new Date());
  refs.startInput.value = item.start || "09:00";
  refs.endInput.value = item.end || "10:00";
  refs.descInput.value = String(item.description || "");
  refs.saveInterventionBtn.textContent = "Aggiorna intervento";
  refs.cancelEditBtn.hidden = false;

  navigateTo("new");
}

function onCancelEdit() {
  if (!editingInterventionId) {
    navigateTo("home", { push: false });
    return;
  }
  editingInterventionId = null;
  prepareNewForm();
  if (currentClientId) {
    navigateTo("client-detail", { push: false });
  } else {
    navigateTo("home", { push: false });
  }
}

function deleteIntervention(interventionId) {
  const index = state.interventions.findIndex(i => i.id === interventionId);
  if (index < 0) return;

  const item = state.interventions[index];
  const message =
    `Eliminare questo intervento del ${formatDateHuman(item.date)} (${item.start}-${item.end})?`;
  if (!window.confirm(message)) return;

  state.interventions.splice(index, 1);
  if (editingInterventionId === interventionId) {
    editingInterventionId = null;
  }
  saveState();
  renderClientDetail();
  renderClientsList();
}

function deleteClient(clientId) {
  const client = getClientById(clientId);
  if (!client) return;

  const linkedCount = state.interventions.filter(i => i.clientId === clientId).length;
  if (linkedCount > 0) {
    alert(`Il cliente "${client.name}" ha ${linkedCount} interventi associati. Elimina prima gli interventi.`);
    return;
  }

  if (!window.confirm(`Eliminare il cliente "${client.name}"?`)) return;

  state.clients = state.clients.filter(c => c.id !== clientId);
  if (currentClientId === clientId) {
    currentClientId = null;
  }
  saveState();
  renderClientsDatalist();
  renderClientsList();
}

function ensureClient(name) {
  const normalized = normalizeClientName(name);
  const existing = state.clients.find(
    c => c.name.toLocaleLowerCase() === normalized.toLocaleLowerCase()
  );
  if (existing) return existing;

  const client = {
    id: createId("cli"),
    name: normalized,
    hourlyRate: 0
  };
  state.clients.push(client);
  state.clients.sort((a, b) => a.name.localeCompare(b.name, "it"));
  return client;
}

function normalizeClientName(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function getClientById(clientId) {
  return state.clients.find(c => c.id === clientId) || null;
}

function getClientInterventions(clientId) {
  return state.interventions.filter(i => i.clientId === clientId);
}

function compareInterventionsDesc(a, b) {
  if (a.date !== b.date) return b.date.localeCompare(a.date);
  if (a.start !== b.start) return b.start.localeCompare(a.start);
  return b.createdAt.localeCompare(a.createdAt);
}

function sumMinutes(items) {
  return items.reduce((acc, item) => acc + (Number(item.minutes) || 0), 0);
}

function getClientRate(client) {
  const rate = Number(client?.hourlyRate);
  if (!Number.isFinite(rate) || rate < 0) return 0;
  return rate;
}

function onClientRateChange() {
  const client = getClientById(currentClientId);
  if (!client) return;
  const rate = parseRateInput(refs.clientRateInput.value);
  client.hourlyRate = rate;
  refs.clientRateInput.value = formatRateInput(rate);
  saveState();
  renderClientDetail();
  renderClientsList();
}

function parseRateInput(value) {
  const normalized = String(value == null ? "" : value)
    .trim()
    .replace(",", ".");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed * 100) / 100;
}

function formatRateInput(rate) {
  const value = getClientRate({ hourlyRate: rate });
  return value === 0 ? "" : String(value);
}

function computeAmountFromMinutes(minutes, hourlyRate) {
  const mins = Math.max(0, Number(minutes) || 0);
  const rate = Math.max(0, Number(hourlyRate) || 0);
  return (mins / 60) * rate;
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR"
  }).format(Number(amount) || 0);
}

function computeDurationMinutes(startTime, endTime) {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  if (start == null || end == null) return 0;
  if (end === start) return 0;
  if (end > start) return end - start;
  return 24 * 60 - start + end;
}

function timeToMinutes(value) {
  const m = /^(\d{2}):(\d{2})$/.exec(String(value || ""));
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

function formatMinutes(minutesTotal) {
  const total = Math.max(0, Number(minutesTotal) || 0);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

function formatDateHuman(isoDate) {
  if (!isoDate) return "";
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return isoDate;
  const dt = new Date(year, month - 1, day);
  return dt.toLocaleDateString("it-IT", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function formatDateTimeHuman(isoString) {
  if (!isoString) return "";
  const dt = new Date(isoString);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function toDateInputValue(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toTimeInputValue(date) {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function createEmpty(text) {
  const div = document.createElement("div");
  div.className = "empty";
  div.textContent = text;
  return div;
}

function createId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { schemaVersion: SCHEMA_VERSION, clients: [], interventions: [] };
    const parsed = JSON.parse(raw);
    return {
      schemaVersion: Number(parsed.schemaVersion) || 1,
      clients: Array.isArray(parsed.clients) ? parsed.clients : [],
      interventions: Array.isArray(parsed.interventions) ? parsed.interventions : []
    };
  } catch (error) {
    console.warn("Stato non leggibile, reset dati:", error);
    return { schemaVersion: SCHEMA_VERSION, clients: [], interventions: [] };
  }
}

function ensureSeedDataShape() {
  let changed = false;
  state.schemaVersion = Number.isFinite(Number(state.schemaVersion)) ? Number(state.schemaVersion) : 1;
  state.clients = Array.isArray(state.clients) ? state.clients : [];
  state.interventions = Array.isArray(state.interventions) ? state.interventions : [];

  state.clients.forEach(client => {
    const rate = Number(client.hourlyRate);
    if (!Number.isFinite(rate) || rate < 0) {
      client.hourlyRate = 0;
      changed = true;
    } else {
      client.hourlyRate = Math.round(rate * 100) / 100;
    }
  });

  if (state.schemaVersion < SCHEMA_VERSION) {
    state.interventions.forEach(item => {
      if (item.status === STATUS_PENDING) {
        item.status = STATUS_SELECTED;
        changed = true;
      }
    });
    state.schemaVersion = SCHEMA_VERSION;
    changed = true;
  }

  state.interventions.forEach(item => {
    if (
      item.status !== STATUS_PENDING &&
      item.status !== STATUS_SELECTED &&
      item.status !== STATUS_PAID
    ) {
      item.status = STATUS_SELECTED;
      changed = true;
    }
    if (item.status === STATUS_PAID) {
      if (item.paidAt == null && item.createdAt) {
        item.paidAt = item.createdAt;
        changed = true;
      }
    } else if (item.paidAt != null) {
      item.paidAt = null;
      changed = true;
    }
  });

  if (changed) {
    saveState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("sw.js").catch(error => {
    console.warn("Service Worker non registrato:", error);
  });
}
