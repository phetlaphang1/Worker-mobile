// Monitoring and Visualization Helpers
// Theo dõi và hiển thị hành vi automation

const ghostCursor = require('ghost-cursor');

/**
 * Enable visual monitoring for automation
 * Hiển thị mouse trail, action logs, và metrics
 */
class AutomationMonitor {
    constructor(page, options = {}) {
        this.page = page;
        this.options = {
            showMouse: true,
            showClicks: true,
            showTyping: true,
            showScrolls: true,
            logToConsole: true,
            logToFile: false,
            ...options
        };
        this.actions = [];
        this.startTime = Date.now();
    }

    /**
     * Enable mouse cursor visualization
     */
    async enableMouseVisualization() {
        // Use ghost-cursor's built-in helper with error handling
        try {
            await ghostCursor.installMouseHelper(this.page);
        } catch (error) {
            console.log('Ghost cursor helper failed, using custom visualization only');
        }

        // Add custom mouse trail
        await this.page.evaluateOnNewDocument(() => {
            // Create mouse trail element
            const style = document.createElement('style');
            style.innerHTML = `
                .mouse-trail {
                    position: fixed;
                    width: 20px;
                    height: 20px;
                    border: 2px solid red;
                    border-radius: 50%;
                    pointer-events: none;
                    z-index: 999999;
                    transition: all 0.1s;
                    animation: pulse 1s infinite;
                }
                @keyframes pulse {
                    0% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.2); opacity: 0.7; }
                    100% { transform: scale(1); opacity: 1; }
                }
                .click-marker {
                    position: fixed;
                    width: 30px;
                    height: 30px;
                    border: 3px solid blue;
                    border-radius: 50%;
                    pointer-events: none;
                    z-index: 999998;
                    animation: clickPulse 0.5s ease-out;
                }
                @keyframes clickPulse {
                    0% { transform: scale(0.5); opacity: 1; }
                    100% { transform: scale(2); opacity: 0; }
                }
            `;
            document.head.appendChild(style);

            // Track mouse movement
            let mouseTrail = null;
            document.addEventListener('mousemove', (e) => {
                if (!mouseTrail) {
                    mouseTrail = document.createElement('div');
                    mouseTrail.className = 'mouse-trail';
                    document.body.appendChild(mouseTrail);
                }
                mouseTrail.style.left = e.clientX - 10 + 'px';
                mouseTrail.style.top = e.clientY - 10 + 'px';
            });

            // Show click markers
            document.addEventListener('click', (e) => {
                const marker = document.createElement('div');
                marker.className = 'click-marker';
                marker.style.left = e.clientX - 15 + 'px';
                marker.style.top = e.clientY - 15 + 'px';
                document.body.appendChild(marker);
                setTimeout(() => marker.remove(), 500);
            });
        });

        console.log('✓ Mouse visualization enabled (red circle + trail)');
    }

    /**
     * Add action overlay to show current action
     */
    async addActionOverlay() {
        await this.page.evaluate(() => {
            // Create overlay element
            const overlay = document.createElement('div');
            overlay.id = 'action-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 10px;
                right: 10px;
                background: rgba(0, 0, 0, 0.8);
                color: #00ff00;
                padding: 15px;
                border-radius: 8px;
                font-family: monospace;
                font-size: 14px;
                z-index: 999999;
                max-width: 400px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.3);
            `;
            overlay.innerHTML = `
                <div style="color: #fff; font-weight: bold; margin-bottom: 10px;">
                    🤖 AUTOMATION MONITOR
                </div>
                <div id="action-status" style="color: #00ff00;">
                    Status: Starting...
                </div>
                <div id="action-counter" style="color: #ffff00; margin-top: 5px;">
                    Actions: 0
                </div>
                <div id="action-time" style="color: #00ffff; margin-top: 5px;">
                    Time: 0s
                </div>
                <div id="action-current" style="color: #ff00ff; margin-top: 10px;">
                    Current: Waiting...
                </div>
            `;
            document.body.appendChild(overlay);

            // Update timer
            setInterval(() => {
                const timeEl = document.getElementById('action-time');
                if (timeEl && window.automationStartTime) {
                    const elapsed = Math.floor((Date.now() - window.automationStartTime) / 1000);
                    timeEl.textContent = `Time: ${elapsed}s`;
                }
            }, 1000);
        });

        // Set start time
        await this.page.evaluate(() => {
            window.automationStartTime = Date.now();
        });

        console.log('✓ Action overlay added (top-right corner)');
    }

    /**
     * Log an action with visualization
     */
    async logAction(type, details) {
        const timestamp = Date.now() - this.startTime;
        const action = {
            type,
            details,
            timestamp: timestamp / 1000, // Convert to seconds
            time: new Date().toISOString()
        };

        this.actions.push(action);

        // Update overlay
        await this.page.evaluate((action, count) => {
            const statusEl = document.getElementById('action-status');
            const counterEl = document.getElementById('action-counter');
            const currentEl = document.getElementById('action-current');

            if (statusEl) statusEl.textContent = `Status: Active`;
            if (counterEl) counterEl.textContent = `Actions: ${count}`;
            if (currentEl) {
                let emoji = '🔄';
                switch(action.type) {
                    case 'click': emoji = '👆'; break;
                    case 'type': emoji = '⌨️'; break;
                    case 'scroll': emoji = '📜'; break;
                    case 'navigate': emoji = '🌐'; break;
                    case 'wait': emoji = '⏰'; break;
                }
                currentEl.innerHTML = `Current: ${emoji} ${action.type}<br/>
                    <span style="font-size: 12px; color: #aaa;">${action.details}</span>`;
            }
        }, action, this.actions.length);

        // Console log with colors
        if (this.options.logToConsole) {
            const colors = {
                click: '\x1b[36m',    // Cyan
                type: '\x1b[35m',     // Magenta
                scroll: '\x1b[33m',   // Yellow
                navigate: '\x1b[32m', // Green
                wait: '\x1b[90m'      // Gray
            };
            const color = colors[type] || '\x1b[37m';
            console.log(`${color}[${action.timestamp.toFixed(2)}s] ${type.toUpperCase()}: ${details}\x1b[0m`);
        }

        return action;
    }

    /**
     * Show typing visualization
     */
    async showTypingIndicator(text) {
        await this.page.evaluate((text) => {
            // Create typing indicator
            const indicator = document.createElement('div');
            indicator.style.cssText = `
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(255, 255, 0, 0.9);
                color: black;
                padding: 10px 20px;
                border-radius: 20px;
                font-family: monospace;
                z-index: 999999;
                animation: fadeInOut 2s;
            `;
            indicator.textContent = `Typing: "${text.substring(0, 30)}${text.length > 30 ? '...' : ''}"`;
            document.body.appendChild(indicator);

            // Add fade animation
            const style = document.createElement('style');
            style.innerHTML = `
                @keyframes fadeInOut {
                    0% { opacity: 0; transform: translateX(-50%) translateY(20px); }
                    20% { opacity: 1; transform: translateX(-50%) translateY(0); }
                    80% { opacity: 1; transform: translateX(-50%) translateY(0); }
                    100% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
                }
            `;
            document.head.appendChild(style);

            setTimeout(() => indicator.remove(), 2000);
        }, text);
    }

    /**
     * Generate action report
     */
    generateReport() {
        const totalTime = (Date.now() - this.startTime) / 1000;
        const actionCounts = {};

        this.actions.forEach(a => {
            actionCounts[a.type] = (actionCounts[a.type] || 0) + 1;
        });

        const report = {
            totalTime: totalTime.toFixed(2) + 's',
            totalActions: this.actions.length,
            averageActionTime: (totalTime / this.actions.length).toFixed(2) + 's',
            actionBreakdown: actionCounts,
            timeline: this.actions
        };

        console.log('\n' + '='.repeat(50));
        console.log('📊 AUTOMATION REPORT');
        console.log('='.repeat(50));
        console.log(`Total Time: ${report.totalTime}`);
        console.log(`Total Actions: ${report.totalActions}`);
        console.log(`Average Action Time: ${report.averageActionTime}`);
        console.log('\nAction Breakdown:');
        Object.entries(actionCounts).forEach(([type, count]) => {
            console.log(`  ${type}: ${count}`);
        });
        console.log('='.repeat(50));

        return report;
    }

    /**
     * Initialize all monitoring features
     */
    async initialize() {
        if (this.options.showMouse) {
            await this.enableMouseVisualization();
        }

        await this.addActionOverlay();

        console.log('✅ Monitoring system initialized');
        console.log('   - Mouse trail: RED circle');
        console.log('   - Click markers: BLUE pulse');
        console.log('   - Action overlay: TOP-RIGHT corner');
        console.log('   - Console logs: COLOR-CODED');

        return this;
    }
}

module.exports = AutomationMonitor;