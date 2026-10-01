const ExportModule = {
    init() {
        const exportBtn = document.getElementById('export-json-btn');
        const importBtn = document.getElementById('import-json-btn');
        const fileInput = document.getElementById('import-file-input');
        const pdfBtn = document.getElementById('export-pdf-btn');

        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportJSON());
        }

        if (importBtn && fileInput) {
            importBtn.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', (e) => this.importJSON(e));
        }

        if (pdfBtn) {
            pdfBtn.addEventListener('click', () => {
                window.print();
            });
        }
    },

    exportJSON() {
        const trades = TradeManager.getAll();
        const dataStr = JSON.stringify(trades, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `kewa_trade_backup_${Utils.getTodayDateString()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 1000);
    },

    importJSON(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const parsed = JSON.parse(e.target.result);
                if (!Array.isArray(parsed)) {
                    throw new Error('Imported JSON is not a valid trade array.');
                }

                // Validate item structures lightly
                for (let item of parsed) {
                    if (!item.id || !item.symbol || typeof item.pnl !== 'number') {
                        throw new Error('Invalid trade record structure detected in backup.');
                    }
                }

                const confirmReplace = confirm(`Found ${parsed.length} trade(s) in backup. Do you want to replace existing saved trades? Click OK to replace or Cancel to abort.`);
                if (!confirmReplace) {
                    event.target.value = '';
                    return;
                }

                TradeManager.trades = parsed;
                Storage.saveTrades(TradeManager.trades);
                
                // Refresh UI via App controller
                if (typeof App !== 'undefined' && App.refreshUI) {
                    App.refreshUI();
                }

                alert('✅ Successfully imported trades from backup!');
            } catch (err) {
                console.error('Import error:', err);
                alert('❌ Import Failed: ' + err.message);
            } finally {
                event.target.value = ''; // Reset file input
            }
        };

        reader.onerror = () => {
            alert('❌ Failed to read the selected file.');
            event.target.value = '';
        };

        reader.readAsText(file);
    }
};
