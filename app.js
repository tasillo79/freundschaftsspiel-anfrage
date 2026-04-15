// ─── Constants & Formatters ───

const STORAGE_KEYS = {
  einnahmen: "haushalt_einnahmen",
  fixausgaben: "haushalt_fixausgaben",
  variable: "haushalt_variable",
  rechnungen: "rechnungen",
};

const BUDGET_CATEGORIES = ["einnahmen", "fixausgaben", "variable"];

const STATUS_LABELS = {
  bezahlt: "Bezahlt",
  offen: "Offen",
  ueberfaellig: "Überfällig",
};

function formatCurrency(value) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

function formatDate(isoString) {
  if (!isoString) return "–";
  return new Intl.DateTimeFormat("de-DE").format(new Date(isoString + "T00:00:00"));
}

function todayISO() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// ─── Data Layer ───

function loadData(key) {
  try {
    const raw = localStorage.getItem(key);
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveData(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

function persist(category) {
  saveData(STORAGE_KEYS[category], state[category]);
}

// ─── Validation ───

function validateBudgetInput(bezeichnung, betragStr) {
  const trimmed = (bezeichnung || "").trim();
  const betrag = Number(betragStr);
  if (!trimmed) return null;
  if (!Number.isFinite(betrag) || betrag <= 0) return null;
  return { bezeichnung: trimmed, betrag };
}

function validateRechnungInput(empfaenger, betragStr, frist) {
  const trimmed = (empfaenger || "").trim();
  const betrag = Number(betragStr);
  if (!trimmed) return null;
  if (!Number.isFinite(betrag) || betrag <= 0) return null;
  if (!frist) return null;
  return { empfaenger: trimmed, betrag, frist };
}

// ─── Application State ───

const state = {
  einnahmen: loadData(STORAGE_KEYS.einnahmen),
  fixausgaben: loadData(STORAGE_KEYS.fixausgaben),
  variable: loadData(STORAGE_KEYS.variable),
  rechnungen: loadData(STORAGE_KEYS.rechnungen),
};

// ─── CRUD Operations ───

function addBudgetItem(category, bezeichnung, betrag) {
  state[category].push({
    id: crypto.randomUUID(),
    bezeichnung,
    betrag,
  });
  persist(category);
  renderAll();
}

function addRechnung(empfaenger, betrag, frist) {
  state.rechnungen.push({
    id: crypto.randomUUID(),
    empfaenger,
    betrag,
    frist,
    bezahlt: false,
  });
  persist("rechnungen");
  renderAll();
}

function deleteItem(category, id) {
  if (!window.confirm("Eintrag wirklich löschen?")) return;
  state[category] = state[category].filter((item) => item.id !== id);
  persist(category);
  renderAll();
}

function updateBudgetItem(category, id, bezeichnung, betrag) {
  const item = state[category].find((i) => i.id === id);
  if (!item) return;
  item.bezeichnung = bezeichnung;
  item.betrag = betrag;
  persist(category);
  renderAll();
}

function updateRechnung(id, empfaenger, betrag, frist) {
  const item = state.rechnungen.find((i) => i.id === id);
  if (!item) return;
  item.empfaenger = empfaenger;
  item.betrag = betrag;
  item.frist = frist;
  persist("rechnungen");
  renderAll();
}

function toggleBezahlt(id) {
  const item = state.rechnungen.find((i) => i.id === id);
  if (!item) return;
  item.bezahlt = !item.bezahlt;
  persist("rechnungen");
  renderAll();
}

// ─── Status Logic ───

function getRechnungStatus(rechnung) {
  if (rechnung.bezahlt) return "bezahlt";
  const today = todayISO();
  if (rechnung.frist < today) return "ueberfaellig";
  return "offen";
}

// ─── Rendering ───

function renderAll() {
  for (const category of BUDGET_CATEGORIES) {
    renderBudgetTable(category);
  }
  renderRechnungen();
  updateDashboard();
}

function renderBudgetTable(category) {
  const tbody = document.getElementById(`${category}-body`);
  const template = document.getElementById("budget-row-template");
  const sumEl = document.getElementById(`sum-${category}`);
  const isIncome = category === "einnahmen";

  tbody.innerHTML = "";
  let sum = 0;

  if (state[category].length === 0) {
    const emptyRow = document.createElement("tr");
    emptyRow.classList.add("empty-row");
    emptyRow.innerHTML = '<td colspan="3">Keine Einträge vorhanden</td>';
    tbody.append(emptyRow);
  }

  for (const item of state[category]) {
    const row = template.content.firstElementChild.cloneNode(true);

    row.querySelector(".col-bezeichnung").textContent = item.bezeichnung;

    const betragCell = row.querySelector(".col-betrag");
    betragCell.textContent = formatCurrency(item.betrag);
    betragCell.classList.add(isIncome ? "amount-income" : "amount-expense");

    row.querySelector(".btn-edit").addEventListener("click", () => {
      openEditModal(category, item.id);
    });

    row.querySelector(".btn-delete").addEventListener("click", () => {
      deleteItem(category, item.id);
    });

    tbody.append(row);
    sum += item.betrag;
  }

  sumEl.textContent = formatCurrency(sum);
}

function renderRechnungen() {
  const tbody = document.getElementById("rechnungen-body");
  const template = document.getElementById("rechnung-row-template");

  tbody.innerHTML = "";

  if (state.rechnungen.length === 0) {
    const emptyRow = document.createElement("tr");
    emptyRow.classList.add("empty-row");
    emptyRow.innerHTML = '<td colspan="5">Keine Rechnungen vorhanden</td>';
    tbody.append(emptyRow);
  }

  for (const item of state.rechnungen) {
    const row = template.content.firstElementChild.cloneNode(true);

    row.querySelector(".col-empfaenger").textContent = item.empfaenger;

    const betragCell = row.querySelector(".col-betrag");
    betragCell.textContent = formatCurrency(item.betrag);
    betragCell.classList.add("amount-expense");

    row.querySelector(".col-frist").textContent = formatDate(item.frist);

    const status = getRechnungStatus(item);
    const badge = row.querySelector(".status-badge");
    badge.textContent = STATUS_LABELS[status];
    badge.classList.add(`status-${status}`);

    if (status === "ueberfaellig") {
      row.classList.add("row-overdue");
    }

    const toggleBtn = row.querySelector(".btn-toggle-paid");
    if (item.bezahlt) {
      toggleBtn.innerHTML = "&#8617;";
      toggleBtn.title = "Als unbezahlt markieren";
    } else {
      toggleBtn.innerHTML = "&#10004;";
      toggleBtn.title = "Als bezahlt markieren";
    }
    toggleBtn.addEventListener("click", () => toggleBezahlt(item.id));

    row.querySelector(".btn-edit").addEventListener("click", () => {
      openEditModal("rechnungen", item.id);
    });

    row.querySelector(".btn-delete").addEventListener("click", () => {
      deleteItem("rechnungen", item.id);
    });

    tbody.append(row);
  }
}

// ─── Dashboard ───

function sumArray(items) {
  return items.reduce((sum, item) => sum + item.betrag, 0);
}

function updateDashboard() {
  const totalEinnahmen = sumArray(state.einnahmen);
  const totalFix = sumArray(state.fixausgaben);
  const totalVariable = sumArray(state.variable);
  const totalRechnungen = state.rechnungen
    .filter((r) => !r.bezahlt)
    .reduce((sum, r) => sum + r.betrag, 0);

  const totalAusgaben = totalFix + totalVariable + totalRechnungen;
  const saldo = totalEinnahmen - totalAusgaben;

  document.getElementById("dash-einnahmen").textContent = formatCurrency(totalEinnahmen);
  document.getElementById("dash-ausgaben").textContent = formatCurrency(totalAusgaben);

  const saldoEl = document.getElementById("dash-saldo");
  saldoEl.textContent = formatCurrency(saldo);
  saldoEl.classList.toggle("saldo-negative", saldo < 0);
  saldoEl.classList.toggle("saldo-positive", saldo >= 0);
}

// ─── Modal ───

let modalState = { category: null, id: null };

function openEditModal(category, id) {
  const modal = document.getElementById("edit-modal");
  const bezeichnungWrap = document.getElementById("modal-bezeichnung-wrap");
  const empfaengerWrap = document.getElementById("modal-empfaenger-wrap");
  const fristWrap = document.getElementById("modal-frist-wrap");
  const bezeichnungInput = document.getElementById("modal-bezeichnung");
  const empfaengerInput = document.getElementById("modal-empfaenger");
  const betragInput = document.getElementById("modal-betrag");
  const fristInput = document.getElementById("modal-frist");

  if (category === "rechnungen") {
    const item = state.rechnungen.find((i) => i.id === id);
    if (!item) return;

    bezeichnungWrap.hidden = true;
    bezeichnungInput.required = false;
    empfaengerWrap.hidden = false;
    empfaengerInput.required = true;
    fristWrap.hidden = false;
    fristInput.required = true;

    empfaengerInput.value = item.empfaenger;
    betragInput.value = item.betrag;
    fristInput.value = item.frist;

    document.getElementById("modal-title").textContent = "Rechnung bearbeiten";
  } else {
    const item = state[category].find((i) => i.id === id);
    if (!item) return;

    bezeichnungWrap.hidden = false;
    bezeichnungInput.required = true;
    empfaengerWrap.hidden = true;
    empfaengerInput.required = false;
    fristWrap.hidden = true;
    fristInput.required = false;

    bezeichnungInput.value = item.bezeichnung;
    betragInput.value = item.betrag;

    document.getElementById("modal-title").textContent = "Eintrag bearbeiten";
  }

  modalState = { category, id };
  modal.hidden = false;
}

function closeEditModal() {
  document.getElementById("edit-modal").hidden = true;
  document.getElementById("modal-form").reset();
  modalState = { category: null, id: null };
}

// ─── Event Listeners ───

// Budget category forms (Einnahmen, Fixe Ausgaben, Variable Ausgaben)
document.querySelectorAll(".inline-add[data-category]").forEach((form) => {
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const category = form.dataset.category;
    const inputs = form.querySelectorAll("input");
    const validated = validateBudgetInput(inputs[0].value, inputs[1].value);
    if (!validated) return;

    addBudgetItem(category, validated.bezeichnung, validated.betrag);
    form.reset();
  });
});

// Rechnung form
document.getElementById("rechnung-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const empfInput = document.getElementById("rechnung-empf");
  const betragInput = document.getElementById("rechnung-betrag");
  const fristInput = document.getElementById("rechnung-frist");

  const validated = validateRechnungInput(
    empfInput.value,
    betragInput.value,
    fristInput.value
  );
  if (!validated) return;

  addRechnung(validated.empfaenger, validated.betrag, validated.frist);
  e.target.reset();
});

// Modal form submit
document.getElementById("modal-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const { category, id } = modalState;
  if (!category || !id) return;

  if (category === "rechnungen") {
    const empfaenger = document.getElementById("modal-empfaenger").value;
    const betrag = document.getElementById("modal-betrag").value;
    const frist = document.getElementById("modal-frist").value;
    const validated = validateRechnungInput(empfaenger, betrag, frist);
    if (!validated) return;
    updateRechnung(id, validated.empfaenger, validated.betrag, validated.frist);
  } else {
    const bezeichnung = document.getElementById("modal-bezeichnung").value;
    const betrag = document.getElementById("modal-betrag").value;
    const validated = validateBudgetInput(bezeichnung, betrag);
    if (!validated) return;
    updateBudgetItem(category, id, validated.bezeichnung, validated.betrag);
  }

  closeEditModal();
});

// Modal cancel button
document.getElementById("modal-cancel").addEventListener("click", closeEditModal);

// Click on overlay to close modal
document.getElementById("edit-modal").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) closeEditModal();
});

// Escape key to close modal
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !document.getElementById("edit-modal").hidden) {
    closeEditModal();
  }
});

// ─── Initialization ───

renderAll();
