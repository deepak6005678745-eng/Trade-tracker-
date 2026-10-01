const TradeManager = {
    trades: [],

    init() {
        this.trades = Storage.getTrades();
    },

    getAll() {
        return this.trades;
    },

    addTrade(tradeData) {
        const newTrade = {
            id: Utils.generateId(),
            symbol: tradeData.symbol.trim().toUpperCase(),
            market: tradeData.market,
            side: tradeData.side,
            entryPrice: parseFloat(tradeData.entryPrice),
            exitPrice: parseFloat(tradeData.exitPrice),
            positionSize: parseFloat(tradeData.positionSize),
            fees: parseFloat(tradeData.fees) || 0,
            pnl: parseFloat(tradeData.pnl),
            date: tradeData.date,
            notes: tradeData.notes ? tradeData.notes.trim() : ''
        };

        this.trades.unshift(newTrade); // Add to beginning
        Storage.saveTrades(this.trades);
        return newTrade;
    },

    updateTrade(id, tradeData) {
        const index = this.trades.findIndex(t => t.id === id);
        if (index !== -1) {
            this.trades[index] = {
                id: id,
                symbol: tradeData.symbol.trim().toUpperCase(),
                market: tradeData.market,
                side: tradeData.side,
                entryPrice: parseFloat(tradeData.entryPrice),
                exitPrice: parseFloat(tradeData.exitPrice),
                positionSize: parseFloat(tradeData.positionSize),
                fees: parseFloat(tradeData.fees) || 0,
                pnl: parseFloat(tradeData.pnl),
                date: tradeData.date,
                notes: tradeData.notes ? tradeData.notes.trim() : ''
            };
            Storage.saveTrades(this.trades);
            return true;
        }
        return false;
    },

    deleteTrade(id) {
        const initialLength = this.trades.length;
        this.trades = this.trades.filter(t => t.id !== id);
        if (this.trades.length !== initialLength) {
            Storage.saveTrades(this.trades);
            return true;
        }
        return false;
    },

    clearAll() {
        this.trades = [];
        Storage.saveTrades(this.trades);
    },

    calculateMetrics() {
        let totalProfit = 0;
        let totalLoss = 0;
        let winningTrades = 0;
        let losingTrades = 0;

        this.trades.forEach(t => {
            if (t.pnl > 0) {
                totalProfit += t.pnl;
                winningTrades++;
            } else if (t.pnl < 0) {
                totalLoss += Math.abs(t.pnl);
                losingTrades++;
            }
        });

        const netPnl = totalProfit - totalLoss;
        const totalResolved = winningTrades + losingTrades;
        const winRate = totalResolved > 0 ? (winningTrades / totalResolved) * 100 : 0;

        return {
            netPnl,
            totalProfit,
            totalLoss,
            winRate,
            totalCount: this.trades.length
        };
    }
};
