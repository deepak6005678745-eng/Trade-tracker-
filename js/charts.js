const ChartModule = {
    canvas: null,
    ctx: null,

    init() {
        this.canvas = document.getElementById('pnl-canvas');
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        
        window.addEventListener('resize', () => {
            this.drawChart();
        });
    },

    drawChart() {
        if (!this.canvas || !this.ctx) return;

        const metrics = TradeManager.calculateMetrics();
        const emptyStateEl = document.getElementById('chart-empty-state');

        // Handle empty state or zero values
        if (metrics.totalCount === 0 || (metrics.totalProfit === 0 && metrics.totalLoss === 0)) {
            if (emptyStateEl) emptyStateEl.style.display = 'flex';
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            return;
        }

        if (emptyStateEl) emptyStateEl.style.display = 'none';

        // Set canvas resolution for crisp rendering on retina/mobile screens
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        
        this.ctx.scale(dpr, dpr);
        const width = rect.width;
        const height = rect.height;

        this.ctx.clearRect(0, 0, width, height);

        const profit = metrics.totalProfit;
        const loss = metrics.totalLoss; // positive value representation
        const maxVal = Math.max(profit, loss, 1);

        // Chart dimensions & padding
        const paddingBottom = 30;
        const paddingTop = 20;
        const chartHeight = height - paddingBottom - paddingTop;
        const barWidth = Math.min(width * 0.22, 70);
        const centerX = width / 2;
        const gap = barWidth * 0.8;

        const profitX = centerX - barWidth - (gap / 2);
        const lossX = centerX + (gap / 2);

        // Calculate bar heights
        const profitBarH = (profit / maxVal) * (chartHeight - 20);
        const lossBarH = (loss / maxVal) * (chartHeight - 20);

        const baselineY = height - paddingBottom;

        // Draw Profit Bar (Green)
        this.ctx.fillStyle = '#10b981';
        this.ctx.beginPath();
        if (this.ctx.roundRect) {
            this.ctx.roundRect(profitX, baselineY - profitBarH, barWidth, profitBarH, [6, 6, 0, 0]);
        } else {
            this.ctx.rect(profitX, baselineY - profitBarH, barWidth, profitBarH);
        }
        this.ctx.fill();

        // Draw Loss Bar (Red)
        this.ctx.fillStyle = '#ef4444';
        this.ctx.beginPath();
        if (this.ctx.roundRect) {
            this.ctx.roundRect(lossX, baselineY - lossBarH, barWidth, lossBarH, [6, 6, 0, 0]);
        } else {
            this.ctx.rect(lossX, baselineY - lossBarH, barWidth, lossBarH);
        }
        this.ctx.fill();

        // Labels & Amounts
        this.ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
        this.ctx.textAlign = 'center';

        // Profit text
        this.ctx.fillStyle = '#9ca3af';
        this.ctx.fillText('Total Profit', profitX + (barWidth / 2), baselineY + 16);
        this.ctx.fillStyle = '#10b981';
        this.ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, sans-serif';
        this.ctx.fillText(Utils.formatINR(profit), profitX + (barWidth / 2), baselineY - profitBarH - 8);

        // Loss text
        this.ctx.fillStyle = '#9ca3af';
        this.ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
        this.ctx.fillText('Total Loss', lossX + (barWidth / 2), baselineY + 16);
        this.ctx.fillStyle = '#ef4444';
        this.ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, sans-serif';
        this.ctx.fillText(Utils.formatINR(loss), lossX + (barWidth / 2), baselineY - lossBarH - 8);
    }
};
