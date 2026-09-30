
"use strict";

/* =========================================================
   KEWA TRADE TRACKER
   Frontend only | LocalStorage | No backend
   ========================================================= */

const STORAGE_KEY = "kewa_trade_tracker_v1";

const $ = (id) => document.getElementById(id);

let trades = [];
let pnlChart = null;
let currentPage = "dashboard";
let storageAvailable = true;

const MARKET_OPTIONS = ["Stocks", "Crypto", "Forex"];
const STATUS_OPTIONS = ["Open", "Closed"];
const DIRECTIONS = ["Long", "Short"];

/* -------------------- GENERAL HELPERS -------------------- */

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function todayLocal() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function makeId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `trade_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function numberValue(value) {
  if (value === "" || value === null || value === undefined) {
    return 0;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
}

function getTradePnl(trade) {
  const entry = numberValue(trade.entryPrice);
  const exit = numberValue(trade.exitPrice);
  const quantity = numberValue(trade.quantity);
  const fees = numberValue(trade.fees);

  if (
    !Number.isFinite(entry) ||
    !Number.isFinite(exit) ||
    !Number.isFinite(quantity) ||
    !Number.isFinite(fees)
  ) {
    return 0;
  }

  if (trade.status !== "Closed") {
    return 0;
  }

  const difference = trade.direction === "Short"
    ? entry - exit
    : exit - entry;

  return difference * quantity - fees;
}

function getPositionSize(trade) {
  const entry = numberValue(trade.entryPrice);
  const quantity = numberValue(trade.quantity);

  if (!Number.isFinite(entry) || !Number.isFinite(quantity)) {
    return 0;
  }

  return entry * quantity;
}

function formatMoney(amount, currency = "USD") {
  const value = Number(amount) || 0;

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 2
    }).format(value);
  } catch {
    return `${currency || "USD"} ${value.toFixed(2)}`;
  }
}

function formatPercent(value) {
  return `${(Number(value) || 0).toFixed(1)}%`;
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return escapeHTML(value);
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function showToast(message) {
  const toast = $("toast");

  if (!toast) {
    alert(message);
    return;
  }

  toast.textContent = message;
  toast.classList.add("show");
  toast.setAttribute("role", "status");

  if (showToast.timer) {
    clearTimeout(showToast.timer);
  }

  showToast.timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2800);
}

function setText(id, value) {
  const element = $(id);

  if (element) {
    element.textContent = value;
  }
}

function setHTML(id, value) {
  const element = $(id);

  if (element) {
    element.innerHTML = value;
  }
}

function setVisible(id, visible) {
  const element = $(id);

  if (element) {
    element.style.display = visible ? "" : "none";
  }
}

/* -------------------- STORAGE -------------------- */

function loadTrades() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (saved === null) {
      trades = [];
      storageAvailable = true;
      return;
    }

    const parsed = JSON.parse(saved);

    if (!Array.isArray(parsed)) {
      throw new Error("Saved trade data is not a valid list.");
    }

    trades = parsed.map(normalizeTrade);
    storageAvailable = true;
  } catch (error) {
    storageAvailable = false;
    console.error("Trade data could not be loaded:", error);

    trades = [];

    showToast(
      "Saved data could not be read. Existing browser data was not deleted."
    );
  }
}

function saveTrades() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
    storageAvailable = true;
    return true;
  } catch (error) {
    storageAvailable = false;
    console.error("Trade data could not be saved:", error);

    showToast(
      "Could not save data. Check browser storage and available space."
    );

    return false;
  }
}

/* -------------------- TRADE NORMALIZATION -------------------- */

function normalizeTrade(raw) {
  const trade = raw && typeof raw === "object" ? raw : {};

  const allowedMarkets = ["Stocks", "Crypto", "Forex"];
  const allowedDirections = ["Long", "Short"];
  const allowedStatuses = ["Open", "Closed"];

  const market = allowedMarkets.includes(trade.market)
    ? trade.market
    : "Stocks";

  const direction = allowedDirections.includes(trade.direction)
    ? trade.direction
    : "Long";

  const status = allowedStatuses.includes(trade.status)
    ? trade.status
    : "Closed";

  const numericFields = [
    "entryPrice",
    "exitPrice",
    "quantity",
    "fees",
    "stopLoss",
    "takeProfit"
  ];

  const normalized = {
    id: String(trade.id || makeId()),
    asset: String(trade.asset || trade.symbol || "Unnamed asset"),
    market,
    direction,
    status,
    tradeDate: /^\d{4}-\d{2}-\d{2}$/.test(String(trade.tradeDate || ""))
      ? String(trade.tradeDate)
      : todayLocal(),
    currency: String(trade.currency || "USD").toUpperCase(),
    notes: String(trade.notes || ""),
    createdAt: trade.createdAt || new Date().toISOString()
  };

  for (const field of numericFields) {
    const value = numberValue(trade[field]);
    normalized[field] =
      Number.isFinite(value) && value >= 0 ? value : 0;
  }

  return normalized;
}

function normalizeImportedTrades(data) {
  let imported;

  if (Array.isArray(data)) {
    imported = data;
  } else if (data && Array.isArray(data.trades)) {
    imported = data.trades;
  } else if (data && data.data && Array.isArray(data.data.trades)) {
    imported = data.data.trades;
  } else {
    throw new Error("Invalid backup: no trade list was found.");
  }

  if (imported.length > 10000) {
    throw new Error("This backup contains too many trades.");
  }

  const normalized = imported.map((trade) => {
    if (!trade || typeof trade !== "object" || Array.isArray(trade)) {
      throw new Error("Backup contains an invalid trade entry.");
    }

    const entry = numberValue(trade.entryPrice);
    const quantity = numberValue(trade.quantity);
    const exit = numberValue(trade.exitPrice);
    const fees = numberValue(trade.fees);

    if (
      !Number.isFinite(entry) ||
      !Number.isFinite(quantity) ||
      !Number.isFinite(exit) ||
      !Number.isFinite(fees) ||
      entry < 0 ||
      quantity < 0 ||
      exit < 0 ||
      fees < 0
    ) {
      throw new Error("Backup contains invalid numeric values.");
    }

    return normalizeTrade(trade);
  });

  const ids = new Set();

  return normalized.map((trade) => {
    if (ids.has(trade.id)) {
      trade.id = makeId();
    }

    ids.add(trade.id);
    return trade;
  });
}

/* -------------------- NAVIGATION -------------------- */

function getPageElement(pageName) {
  const aliases = {
    dashboard: ["page-dashboard", "dashboardPage"],
    journal: ["page-journal", "tradesPage", "journalPage"],
    add: ["page-add", "addTradePage"],
    backup: ["page-backup", "backupPage"]
  };

  const candidates = aliases[pageName] || [];

  for (const id of candidates) {
    const element = $(id);
    if (element) return element;
  }

  return null;
}

function showPage(pageName) {
  const validPages = ["dashboard", "journal", "add", "backup"];

  if (!validPages.includes(pageName)) {
    pageName = "dashboard";
  }

  currentPage = pageName;

  for (const name of validPages) {
    const page = getPageElement(name);

    if (page) {
      page.hidden = name !== pageName;
      page.classList.toggle("active", name === pageName);
    }
  }

  document.querySelectorAll(".nav-link").forEach((button) => {
    const target = button.dataset.page || button.dataset.goto;
    const active = target === pageName;

    button.classList.toggle("active", active);

    if (active) {
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
  });

  const headings = {
    dashboard: "Dashboard",
    journal: "Trade Journal",
    add: $("tradeId")?.value ? "Edit Trade" : "Add Trade",
    backup: "Backup & Reports"
  };

  setText("pageHeading", headings[pageName]);

  closeMobileMenu();

  if (pageName === "dashboard") {
    renderDashboard();
  }

  if (pageName === "journal") {
    renderJournal();
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openMobileMenu() {
  const sidebar = $("sidebar");
  const overlay = $("mobileOverlay") || $("overlay");

  if (sidebar) sidebar.classList.add("open");
  if (overlay) overlay.classList.add("show");
  document.body.classList.add("menu-open");
}

function closeMobileMenu() {
  const sidebar = $("sidebar");
  const overlay = $("mobileOverlay") || $("overlay");

  if (sidebar) sidebar.classList.remove("open");
  if (overlay) overlay.classList.remove("show");
  document.body.classList.remove("menu-open");
}

/* -------------------- FORM -------------------- */

function resetForm() {
  const form = $("tradeForm");

  if (form) form.reset();

  setValue("tradeId", "");
  setValue("tradeDate", todayLocal());
  setValue("direction", "Long");
  setValue("status", "Closed");
  setValue("currency", "USD");
  setText("formHeading", "Add New Trade");
  setText("formEyebrow", "TRADE DETAILS");
  setText("saveTradeBtn", "Save Trade");

  setVisible("cancelEditBtn", false);
  setText("formMessage", "");

  updatePnlPreview();
}

function setValue(id, value) {
  const element = $(id);

  if (element) {
    element.value = value;
  }
}

function readFormTrade() {
  const fields = [
    "entryPrice",
    "exitPrice",
    "quantity",
    "fees",
    "stopLoss",
    "takeProfit"
  ];

  const values = {};

  for (const field of fields) {
    const element = $(field);
    if (!element) continue;

    const raw = element.value.trim();

    if (raw === "") {
      values[field] = 0;
      continue;
    }

    const parsed = Number(raw);

    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new Error(
        `${field.replace(/([A-Z])/g, " $1")} must be a valid non-negative number.`
      );
    }

    values[field] = parsed;
  }

  const asset = ($("asset")?.value || "").trim();
  const market = $("market")?.value || "Stocks";
  const direction = $("direction")?.value || "Long";
  const status = $("status")?.value || "Closed";
  const tradeDate = $("tradeDate")?.value || todayLocal();
  const currency = ($("currency")?.value || "USD").trim().toUpperCase();
  const notes = ($("notes")?.value || "").trim();

  if (!asset) {
    throw new Error("Enter the asset or trading symbol.");
  }

  if (!MARKET_OPTIONS.includes(market)) {
    throw new Error("Select a valid market.");
  }

  if (!DIRECTIONS.includes(direction)) {
    throw new Error("Select Long or Short.");
  }

  if (!STATUS_OPTIONS.includes(status)) {
    throw new Error("Select Open or Closed.");
  }

  if (!tradeDate || !/^\d{4}-\d{2}-\d{2}$/.test(tradeDate)) {
    throw new Error("Select a valid trade date.");
  }

  if (values.entryPrice <= 0) {
    throw new Error("Entry price must be greater than zero.");
  }

  if (values.quantity <= 0) {
    throw new Error("Quantity must be greater than zero.");
  }

  if (status === "Closed" && values.exitPrice <= 0) {
    throw new Error("Enter an exit price for a closed trade.");
  }

  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error("Currency must be a three-letter code, e.g. USD or INR.");
  }

  return {
    asset,
    market,
    direction,
    status,
    tradeDate,
    currency,
    notes,
    ...values
  };
}

function handleSaveTrade(event) {
  event.preventDefault();

  let formTrade;

  try {
    formTrade = readFormTrade();
  } catch (error) {
    setText("formMessage", error.message);
    showToast(error.message);
    return;
  }

  const existingId = $("tradeId")?.value || "";
  const existingIndex = trades.findIndex(
    (trade) => trade.id === existingId
  );

  let nextTrades;

  if (existingIndex >= 0) {
    nextTrades = trades.map((trade, index) => {
      if (index !== existingIndex) return trade;

      return {
        ...trade,
        ...formTrade,
        id: trade.id,
        createdAt: trade.createdAt
      };
    });
  } else {
    nextTrades = [
      {
        ...formTrade,
        id: makeId(),
        createdAt: new Date().toISOString()
      },
      ...trades
    ];
  }

  const previousTrades = trades;
  trades = nextTrades;

  if (!saveTrades()) {
    trades = previousTrades;
    return;
  }

  renderDashboard();
  renderJournal();
  resetForm();

  showToast(existingIndex >= 0
    ? "Trade updated successfully."
    : "Trade saved successfully.");

  showPage("journal");
}

function startEdit(id) {
  const trade = trades.find((item) => item.id === id);

  if (!trade) {
    showToast("Trade not found.");
    return;
  }

  setValue("tradeId", trade.id);
  setValue("asset", trade.asset);
  setValue("market", trade.market);
  setValue("direction", trade.direction);
  setValue("status", trade.status);
  setValue("tradeDate", trade.tradeDate);
  setValue("currency", trade.currency);

  setValue("entryPrice", trade.entryPrice);
  setValue("exitPrice", trade.exitPrice);
  setValue("quantity", trade.quantity);
  setValue("fees", trade.fees);
  setValue("stopLoss", trade.stopLoss);
  setValue("takeProfit", trade.takeProfit);
  setValue("notes", trade.notes);

  setText("formHeading", "Edit Trade");
  setText("formEyebrow", "UPDATE TRADE");
  setText("saveTradeBtn", "Update Trade");
  setVisible("cancelEditBtn", true);

  updatePnlPreview();
  showPage("add");
}

function deleteTrade(id) {
  const trade = trades.find((item) => item.id === id);

  if (!trade) {
    showToast("Trade not found.");
    return;
  }

  if (!confirm(`Delete the trade "${trade.asset}"? This cannot be undone.`)) {
    return;
  }

  const previousTrades = trades;
  trades = trades.filter((item) => item.id !== id);

  if (!saveTrades()) {
    trades = previousTrades;
    return;
  }

  renderDashboard();
  renderJournal();

  if ($("tradeId")?.value === id) {
    resetForm();
  }

  showToast("Trade deleted.");
}

/* -------------------- LIVE PREVIEW -------------------- */

function updatePnlPreview() {
  const entry = numberValue($("entryPrice")?.value);
  const exit = numberValue($("exitPrice")?.value);
  const quantity = numberValue($("quantity")?.value);
  const fees = numberValue($("fees")?.value);
  const direction = $("direction")?.value || "Long";
  const status = $("status")?.value || "Closed";
  const currency = $("currency")?.value || "USD";

  const pnl = status === "Closed"
    ? ((direction === "Short" ? entry - exit : exit - entry) *
       quantity) - fees
    : 0;

  const safePnl = Number.isFinite(pnl) ? pnl : 0;
  const positionSize =
    Number.isFinite(entry * quantity) ? entry * quantity : 0;

  setText("previewPnl", formatMoney(safePnl, currency));
  setText("previewSize", formatMoney(positionSize, currency));

  const riskElement = $("previewRisk");

  if (riskElement) {
    const stopLoss = numberValue($("stopLoss")?.value);
    const risk = Math.abs(entry - stopLoss) * quantity;

    riskElement.textContent =
      stopLoss > 0 && entry > 0 && quantity > 0
        ? formatMoney(risk, currency)
        : "—";
  }

  const pnlElement = $("previewPnl");

  if (pnlElement) {
    pnlElement.classList.toggle("profit", safePnl > 0);
    pnlElement.classList.toggle("loss", safePnl < 0);
  }
}

/* -------------------- DASHBOARD -------------------- */

function getDashboardStats() {
  const closed = trades.filter(t => t.status === "Closed");
  const wins = closed.filter(t => getTradePnl(t) > 0);
  const totalPnl = closed.reduce((sum, t) => sum + getTradePnl(t), 0);

  const currencies = new Set(closed.map(t => t.currency));
  const currency = currencies.size === 1
    ? (closed[0]?.currency || "USD")
    : "USD";

  return {
    total: trades.length,
    closed: closed.length,
    wins: wins.length,
    winRate: closed.length ? wins.length / closed.length * 100 : 0,
    totalPnl,
    currency
  };
}

function renderDashboard() {
  const stats = getDashboardStats();

  setText("totalTrades", stats.total);
  setText("closedTrades", stats.closed);
  setText("winRate", formatPercent(stats.winRate));
  setText("netPnl", formatMoney(stats.totalPnl, stats.currency));
  setText("totalPnl", formatMoney(stats.totalPnl, stats.currency));
  setText("winningTrades", stats.wins);

  ["netPnl", "totalPnl"].forEach(id => {
    const element = $(id);
    if (!element) return;

    element.classList.toggle("profit", stats.totalPnl > 0);
    element.classList.toggle("loss", stats.totalPnl < 0);
  });

  renderRecentTrades();
  renderPnlChart();
  renderMarketBreakdown();
}

function renderRecentTrades() {
  const container = $("recentTrades");
  if (!container) return;

  const recent = [...trades]
    .sort((a, b) => String(b.tradeDate).localeCompare(String(a.tradeDate)))
    .slice(0, 5);

  if (!recent.length) {
    container.innerHTML =
      '<p class="empty-state">No trades yet. Add your first trade.</p>';

    setVisible("recentEmpty", true);
    return;
  }

  setVisible("recentEmpty", false);

  container.innerHTML = recent.map(trade => {
    const pnl = getTradePnl(trade);
    const pnlClass = pnl > 0 ? "profit" : pnl < 0 ? "loss" : "";

    return `
      <div class="trade-row">
        <div class="trade-info">
          <strong>${escapeHTML(trade.asset)}</strong>
          <span>${escapeHTML(trade.market)} · ${escapeHTML(trade.direction)}</span>
        </div>
        <div class="trade-result">
          <strong class="${pnlClass}">
            ${trade.status === "Closed"
              ? escapeHTML(formatMoney(pnl, trade.currency))
              : "Open"}
          </strong>
          <span>${escapeHTML(formatDate(trade.tradeDate))}</span>
        </div>
      </div>`;
  }).join("");
}

function renderPnlChart() {
  const canvas = $("pnlChart");

  if (!canvas || typeof Chart === "undefined") return;

  const closed = trades
    .filter(t => t.status === "Closed")
    .sort((a, b) => String(a.tradeDate).localeCompare(String(b.tradeDate)));

  const grouped = new Map();

  closed.forEach(trade => {
    grouped.set(
      trade.tradeDate,
      (grouped.get(trade.tradeDate) || 0) + getTradePnl(trade)
    );
  });

  const labels = [...grouped.keys()];
  let runningTotal = 0;

  const values = labels.map(date => {
    runningTotal += grouped.get(date);
    return Number(runningTotal.toFixed(2));
  });

  const emptyChart = $("emptyChart");
  if (emptyChart) emptyChart.style.display = labels.length ? "none" : "";

  if (pnlChart) {
    pnlChart.destroy();
    pnlChart = null;
  }

  pnlChart = new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Cumulative P&L",
        data: values,
        borderColor: "#8b5cf6",
        backgroundColor: "rgba(139, 92, 246, 0.15)",
        borderWidth: 2,
        fill: true,
        tension: 0.3,
        pointRadius: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: "index"
      },
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true }
      }
    }
  });
}

function renderMarketBreakdown() {
  const container = $("marketBreakdown");
  if (!container) return;

  const totals = {
    Stocks: 0,
    Crypto: 0,
    Forex: 0
  };

  trades.forEach(trade => {
    if (trade.status === "Closed") {
      totals[trade.market] =
        (totals[trade.market] || 0) + getTradePnl(trade);
    }
  });

  container.innerHTML = Object.entries(totals).map(([market, pnl]) => {
    const pnlClass = pnl > 0 ? "profit" : pnl < 0 ? "loss" : "";

    return `
      <div class="market-row">
        <span>${escapeHTML(market)}</span>
        <strong class="${pnlClass}">${escapeHTML(formatMoney(pnl))}</strong>
      </div>`;
  }).join("");
}

/* -------------------- JOURNAL & FILTERS -------------------- */

function renderJournal() {
  const container = $("journalTrades");
  if (!container) return;

  const query = ($("searchTrades")?.value || "").trim().toLowerCase();
  const marketFilter = $("filterMarket")?.value || "all";
  const statusFilter = $("filterStatus")?.value || "all";

  const filtered = [...trades]
    .filter(trade => {
      const matchesQuery =
        trade.asset.toLowerCase().includes(query) ||
        trade.notes.toLowerCase().includes(query);

      const matchesMarket =
        marketFilter === "all" ||
        marketFilter === "" ||
        trade.market === marketFilter;

      const matchesStatus =
        statusFilter === "all" ||
        statusFilter === "" ||
        trade.status === statusFilter;

      return matchesQuery && matchesMarket && matchesStatus;
    })
    .sort((a, b) => String(b.tradeDate).localeCompare(String(a.tradeDate)));

  setVisible("journalEmpty", filtered.length === 0);

  if (!filtered.length) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = filtered.map(trade => {
    const pnl = getTradePnl(trade);
    const pnlClass = pnl > 0 ? "profit" : pnl < 0 ? "loss" : "";

    return `
      <tr>
        <td>${escapeHTML(formatDate(trade.tradeDate))}</td>
        <td>
          <strong>${escapeHTML(trade.asset)}</strong>
          <small>${escapeHTML(trade.market)}</small>
        </td>
        <td>${escapeHTML(trade.direction)}</td>
        <td>${escapeHTML(trade.status)}</td>
        <td>${escapeHTML(formatMoney(trade.entryPrice, trade.currency))}</td>
        <td>${trade.status === "Closed"
          ? escapeHTML(formatMoney(trade.exitPrice, trade.currency))
          : "—"}</td>
        <td>${escapeHTML(String(trade.quantity))}</td>
        <td class="${pnlClass}">${trade.status === "Closed"
          ? escapeHTML(formatMoney(pnl, trade.currency))
          : "—"}</td>
        <td>
          <button type="button" data-edit="${escapeHTML(trade.id)}">Edit</button>
          <button type="button" data-delete="${escapeHTML(trade.id)}">Delete</button>
        </td>
      </tr>`;
  }).join("");
}

/* -------------------- JSON BACKUP -------------------- */

function exportBackup() {
  try {
    const backup = {
      app: "Kewa Trade Tracker",
      version: 1,
      exportedAt: new Date().toISOString(),
      trades
    };

    const blob = new Blob(
      [JSON.stringify(backup, null, 2)],
      { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `kewa-trade-backup-${todayLocal()}.json`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("JSON backup exported.");
  } catch (error) {
    console.error(error);
    showToast("Could not export the backup.");
  }
}

async function importBackup() {
  const file = $("importFile")?.files?.[0];

  if (!file) {
    showToast("Choose a JSON backup file first.");
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    showToast("Backup file is too large. Maximum size is 10 MB.");
    return;
  }

  try {
    const parsed = JSON.parse(await file.text());
    const imported = normalizeImportedTrades(parsed);

    if (!confirm(
      `Import ${imported.length} trades? Your current journal will be replaced.`
    )) {
      return;
    }

    const previousTrades = trades;
    trades = imported;

    if (!saveTrades()) {
      trades = previousTrades;
      return;
    }

    renderDashboard();
    renderJournal();

    if ($("importFile")) $("importFile").value = "";

    showToast(`${imported.length} trades imported successfully.`);
  } catch (error) {
    console.error("Import error:", error);
    showToast(error.message || "Could not import this backup.");
  }
}

/* -------------------- PRINT / PDF -------------------- */

function printReport() {
  renderDashboard();
  renderJournal();
  window.print();
}

/* -------------------- CLEAR DATA -------------------- */

function clearAllData() {
  if (!trades.length) {
    showToast("There are no trades to clear.");
    return;
  }

  const confirmation = prompt(
    "Type DELETE to permanently clear all trades saved in this browser."
  );

  if (confirmation !== "DELETE") {
    showToast("Clear data cancelled.");
    return;
  }

  const previousTrades = trades;
  trades = [];

  if (!saveTrades()) {
    trades = previousTrades;
    return;
  }

  renderDashboard();
  renderJournal();
  resetForm();

  showToast("All local trade data has been cleared.");
}

/* -------------------- EVENTS -------------------- */

function bindEvents() {
  document.querySelectorAll(".nav-link").forEach(button => {
    button.addEventListener("click", () => {
      const page = button.dataset.page || button.dataset.goto;
      if (page) showPage(page);
    });
  });

  document.querySelectorAll("[data-goto]").forEach(button => {
    button.addEventListener("click", () => {
      if (button.dataset.goto) showPage(button.dataset.goto);
    });
  });

  $("topAddBtn")?.addEventListener("click", () => {
    resetForm();
    showPage("add");
  });

  $("menuBtn")?.addEventListener("click", openMobileMenu);
  $("closeMenu")?.addEventListener("click", closeMobileMenu);
  $("mobileOverlay")?.addEventListener("click", closeMobileMenu);

  $("tradeForm")?.addEventListener("submit", handleSaveTrade);

  $("cancelEditBtn")?.addEventListener("click", () => {
    resetForm();
    showPage("journal");
  });

  [
    "entryPrice",
    "exitPrice",
    "quantity",
    "fees",
    "stopLoss",
    "takeProfit",
    "direction",
    "status",
    "currency"
  ].forEach(id => {
    const element = $(id);

    if (element) {
      element.addEventListener("input", updatePnlPreview);
      element.addEventListener("change", updatePnlPreview);
    }
  });

  ["searchTrades", "filterMarket", "filterStatus"].forEach(id => {
    const element = $(id);

    if (element) {
      element.addEventListener("input", renderJournal);
      element.addEventListener("change", renderJournal);
    }
  });

  document.addEventListener("click", event => {
    if (!(event.target instanceof Element)) return;

    const editButton = event.target.closest("[data-edit]");
    const deleteButton = event.target.closest("[data-delete]");

    if (editButton) startEdit(editButton.dataset.edit);
    if (deleteButton) deleteTrade(deleteButton.dataset.delete);
  });

  $("exportBtn")?.addEventListener("click", exportBackup);

  $("importBtn")?.addEventListener("click", () => {
    $("importFile")?.click();
  });

  $("importFile")?.addEventListener("change", importBackup);
  $("printBtn")?.addEventListener("click", printReport);
  $("clearDataBtn")?.addEventListener("click", clearAllData);
}

/* -------------------- INITIALIZATION -------------------- */

function init() {
  loadTrades();
  bindEvents();

  if ($("tradeDate") && !$("tradeDate").value) {
    $("tradeDate").value = todayLocal();
  }

  resetForm();
  renderDashboard();
  renderJournal();
  showPage("dashboard");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
