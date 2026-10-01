const App = {
    init() {
        TradeManager.init();
        ChartModule.init();
        ExportModule.init();

        this.bindEvents();
        this.refreshUI();

        // Set default date to today in form
        const dateInput = document.getElementById('trade-date');
        if (dateInput && !dateInput.value) {
            dateInput.value = Utils.getTodayDateString();
        }
    },

    bindEvents() {
        const form = document.getElementById('trade-form');
        const cancelBtn = document.getElementById('cancel-edit-btn');
        const searchInput = document.getElementById('search-trades');
        const clearAllBtn = document.getElementById('clear-all-btn');

        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleFormSubmit();
            });
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.resetForm();
            });
        }

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.renderTable(e.target.value);
            });
        }

        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', () => {
                if (confirm('⚠️️ Are you sure you want to clear all trades? This action cannot be undone unless you exported a backup.')) {
                    TradeManager.clearAll();
                    this.refreshUI();
                    this.resetForm();
                }
            });
        }

        // Table event delegation for Edit / Delete actions
        const tableBody = document.getElementById('trades-table-body');
        if (tableBody) {
            tableBody.addEventListener('click', (e) => {
                const target = e.target.closest('button');
                if (!target) return;

                const id = target.getAttribute('data-id');
                if (target.classList.contains('edit-btn')) {
                    this.loadTradeForEdit(id);
                } else if (target.classList.contains('delete-btn')) {
                    if (confirm('Are you sure you want to delete this trade?')) {
                        TradeManager.deleteTrade(id);
                        this.refreshUI();
                    }
                }
            });
        }
    },

    handleFormSubmit() {
        const idField = document.getElementById('trade-id');
        const symbolField = document.getElementById('trade-symbol');
        const marketField = document.getElementById('trade-market');
        const sideField = document.getElementById('trade-side');
        const entryPriceField = document.getElementById('trade-entry-price');
        const exitPriceField = document.getElementById('trade-exit-price');
        const positionSizeField = document.getElementById('trade-position-size');
        const feesField = document.getElementById('trade-fees');
        const pnlField = document.getElementById('trade-pnl');
        const dateField = document.getElementById('trade-date');
        const notesField = document.getElementById('trade-notes');

        // Validation checks
        const symbol = symbolField.value.trim();
        const entryPrice = parseFloat(entryPriceField.value);
        const exitPrice = parseFloat(exitPriceField.value);
        const positionSize = parseFloat(positionSizeField.value);
        const fees = parseFloat(feesField.value) || 0;
        const pnl = parseFloat(pnlField.value);
        const date = dateField.value;

        if (!symbol) {
            alert('Please enter an asset or symbol.');
            symbolField.focus();
            return;
        }

        if (isNaN(entryPrice) || isNaN(exitPrice)) {
            alert('Please enter valid numerical values for entry and exit prices.');
            return;
        }

        if (isNaN(positionSize) || positionSize <= 0) {
            alert('Position size must be a positive number greater than zero.');
            positionSizeField.focus();
            return;
        }

        if (fees < 0) {
            alert('Fees cannot be negative.');
            feesField.focus();
            return;
        }

        if (isNaN(pnl)) {
            alert('Please enter a valid numerical P&L amount.');
            pnlField.focus();
            return;
        }

        if (!date) {
            alert('Please select a trade date.');
            dateField.focus();
            return;
        }

        const tradeData = {
            symbol,
            market: marketField.value,
            side: sideField.value,
            entryPrice,
            exitPrice,
            positionSize,
            fees,
            pnl,
            date,
            notes: notesField.value
        };

        const editId = idField.value;
        if (editId) {
            TradeManager.updateTrade(editId, tradeData);
        } else {
            TradeManager.addTrade(tradeData);
        }

        this.refreshUI();
        this.resetForm();
    },

    loadTradeForEdit(id) {
        const trades = TradeManager.getAll();
        const trade = trades.find(t => t.id === id);
        if (!trade) return;

        document.getElementById('trade-id').value = trade.id;
        document.getElementById('trade-symbol').value = trade.symbol;
        document.getElementById('trade-market').value = trade.market;
        document.getElementById('trade-side').value = trade.side;
        document.getElementById('trade-entry-price').value = trade.entryPrice;
        document.getElementById('trade-exit-price').value = trade.exitPrice;
        document.getElementById('trade-position-size').value = trade.positionSize;
        document.getElementById('trade-fees').value = trade.fees;
        document.getElementById('trade-pnl').value = trade.pnl;
        document.getElementById('trade-date').value = trade.date;
        document.getElementById('trade-notes').value = trade.notes || '';

        document.getElementById('save-trade-btn').textContent = 'Update Trade';
        document.getElementById('cancel-edit-btn').style.display = 'inline-block';

        // Scroll smoothly to form
        document.querySelector('.form-section').scrollIntoView({ behavior: 'smooth' });
    },

    resetForm() {
        const form = document.getElementById('trade-form');
        form.reset();
        document.getElementById('trade-id').value = '';
        document.getElementById('trade-fees').value = '0';
        document.getElementById('trade-date').value = Utils.getTodayDateString();
        document.getElementById('save-trade-btn').textContent = 'Save Trade';
        document.getElementById('cancel-edit-btn').style.display = 'none';
    },

    refreshUI() {
        this.renderDashboard();
        this.renderTable();
        ChartModule.drawChart();
    },

    renderDashboard() {
        const metrics = TradeManager.calculateMetrics();

        const netEl = document.getElementById('summary-net-pnl');
        const profitEl = document.getElementById('summary-total-profit');
        const lossEl = document.getElementById('summary-total-loss');
        const winRateEl = document.getElementById('summary-win-rate');
        const countEl = document.getElementById('summary-total-trades');

        netEl.textContent = Utils.formatINR(metrics.netPnl);
        netEl.className = 'metric-value ' + (metrics.netPnl > 0 ? 'positive' : metrics.netPnl < 0 ? 'negative' : '');

        profitEl.textContent = Utils.formatINR(metrics.totalProfit);
        lossEl.textContent = Utils.formatINR(metrics.totalLoss);
        winRateEl.textContent = metrics.winRate.toFixed(1) + '%';
        countEl.textContent = metrics.totalCount;
    },

    renderTable(searchQuery = '') {
        const tbody = document.getElementById('trades-table-body');
        const emptyState = document.getElementById('table-empty-state');
        const trades = TradeManager.getAll();

        const query = searchQuery.toLowerCase().trim();
        const filtered = trades.filter(t => {
            return t.symbol.toLowerCase().includes(query) ||
                   t.market.toLowerCase().includes(query) ||
                   t.side.toLowerCase().includes(query) ||
                   (t.notes && t.notes.toLowerCase().includes(query));
        });

        if (filtered.length === 0) {
            tbody.innerHTML = '';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';

        let html = '';
        filtered.forEach(t => {
            const pnlClass = t.pnl > 0 ? 'positive' : t.pnl < 0 ? 'negative' : '';
            const formattedPnl = Utils.formatINR(t.pnl);

            html += `
                <tr>
                    <td>${Utils.escapeHTML(t.date)}</td>
                    <td><strong>${Utils.escapeHTML(t.symbol)}</strong></td>
                    <td>${Utils.escapeHTML(t.market)}</td>
                    <td>${Utils.escapeHTML(t.side)}</td>
                    <td>${t.entryPrice} / ${t.exitPrice}</td>
                    <td class="${pnlClass}">${formattedPnl}</td>
                    <td>
                        <div class="action-btns">
                            <button class="btn btn-secondary btn-sm edit-btn" data-id="${t.id}" title="Edit Trade">✏️</button>
                            <button class="btn btn-danger-outline btn-sm delete-btn" data-id="${t.id}" title="Delete Trade">🗑️</button>
                        </div>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    }
};

// Initialize App on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
