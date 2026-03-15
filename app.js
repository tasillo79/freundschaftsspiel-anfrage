const STORAGE_KEY = "financeEntries";

const typeLabels = {
  income: "Einnahme",
  "expense-fixed": "Ausgabe fix",
  "expense-variable": "Ausgabe variabel",
  "reserve-in": "Rücklage Zugang",
  "reserve-out": "Rücklage Abgang",
  "future-expense": "Künftige Ausgabe",
};

const form = document.getElementById("entry-form");
const typeInput = document.getElementById("entry-type");
const amountInput = document.getElementById("entry-amount");
const labelInput = document.getElementById("entry-label");
const dateInput = document.getElementById("entry-date");
const recurringInput = document.getElementById("entry-recurring");
const recurringWrap = document.getElementById("recurring-wrap");
const entriesBody = document.getElementById("entries-body");
const clearAllButton = document.getElementById("clear-all");
const rowTemplate = document.getElementById("entry-row-template");

const summaryElements = {
  income: document.getElementById("sum-income"),
  fixed: document.getElementById("sum-fixed"),
  variable: document.getElementById("sum-variable"),
  reserve: document.getElementById("sum-reserve"),
  future: document.getElementById("sum-future"),
  balance: document.getElementById("sum-balance"),
};

let entries = loadEntries();

dateInput.valueAsDate = new Date();
updateRecurringVisibility();
render();

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const amount = Number(amountInput.value);
  if (!Number.isFinite(amount) || amount <= 0) {
    return;
  }

  const entry = {
    id: crypto.randomUUID(),
    type: typeInput.value,
    amount,
    label: labelInput.value.trim(),
    date: dateInput.value,
    recurring: recurringInput.checked,
  };

  entries.unshift(entry);
  persistEntries();
  form.reset();
  dateInput.valueAsDate = new Date();
  updateRecurringVisibility();
  render();
});

typeInput.addEventListener("change", updateRecurringVisibility);

clearAllButton.addEventListener("click", () => {
  if (!entries.length) {
    return;
  }

  const confirmation = window.confirm("Wirklich alle Einträge löschen?");
  if (!confirmation) {
    return;
  }

  entries = [];
  persistEntries();
  render();
});

function updateRecurringVisibility() {
  const recurringTypes = ["income", "expense-fixed", "expense-variable"];
  const show = recurringTypes.includes(typeInput.value);
  recurringWrap.hidden = !show;
  recurringInput.checked = show && recurringInput.checked;
}

function loadEntries() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    const parsed = JSON.parse(value);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isValidEntry);
  } catch {
    return [];
  }
}

function isValidEntry(entry) {
  return Boolean(
    entry &&
      typeof entry.id === "string" &&
      typeof entry.type === "string" &&
      Number.isFinite(Number(entry.amount)) &&
      typeof entry.label === "string" &&
      typeof entry.date === "string"
  );
}

function persistEntries() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function render() {
  entriesBody.innerHTML = "";

  for (const entry of entries) {
    const row = rowTemplate.content.firstElementChild.cloneNode(true);
    row.querySelector(".col-date").textContent = formatDate(entry.date);
    row.querySelector(".col-type").textContent = typeLabels[entry.type] || entry.type;
    row.querySelector(".col-label").textContent = entry.label;

    const amountNode = row.querySelector(".col-amount");
    amountNode.textContent = formatCurrency(entry.amount);
    amountNode.classList.add(isNegativeType(entry.type) ? "neg" : "pos");

    row.querySelector(".col-recurring").textContent = entry.recurring ? "Laufend" : "Einmalig";

    row.querySelector(".delete-btn").addEventListener("click", () => {
      entries = entries.filter((candidate) => candidate.id !== entry.id);
      persistEntries();
      render();
    });

    entriesBody.append(row);
  }

  updateSummary();
}

function updateSummary() {
  let income = 0;
  let fixed = 0;
  let variable = 0;
  let reserve = 0;
  let future = 0;

  for (const entry of entries) {
    switch (entry.type) {
      case "income":
        income += entry.amount;
        break;
      case "expense-fixed":
        fixed += entry.amount;
        break;
      case "expense-variable":
        variable += entry.amount;
        break;
      case "reserve-in":
        reserve += entry.amount;
        break;
      case "reserve-out":
        reserve -= entry.amount;
        break;
      case "future-expense":
        future += entry.amount;
        break;
      default:
        break;
    }
  }

  const balance = income - fixed - variable - future;

  summaryElements.income.textContent = formatCurrency(income);
  summaryElements.fixed.textContent = formatCurrency(fixed);
  summaryElements.variable.textContent = formatCurrency(variable);
  summaryElements.reserve.textContent = formatCurrency(reserve);
  summaryElements.future.textContent = formatCurrency(future);
  summaryElements.balance.textContent = formatCurrency(balance);
  summaryElements.balance.classList.toggle("neg", balance < 0);
  summaryElements.balance.classList.toggle("pos", balance >= 0);
}

function isNegativeType(type) {
  return ["expense-fixed", "expense-variable", "reserve-out", "future-expense"].includes(type);
}

function formatCurrency(value) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

function formatDate(value) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("de-DE").format(new Date(value));
}
