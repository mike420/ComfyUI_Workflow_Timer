import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const VERSION = "1.0.5"

const GlobalTimer = {
    startTime: 0,
    accumulatedTime: 0, // Track time across pauses
    isRunning: false,
    activeNodes: new Set(),
    lastTimeString: "",
    rafId: null,

    formatTime(ms) {
        if (ms < 0) ms = 0;
        const m = (ms / 60000) | 0;
        const s = ((ms % 60000) / 1000) | 0;
        const msPart = Math.floor(ms % 1000);

        return (
            (m < 10 ? "0" : "") + m + ":" +
            (s < 10 ? "0" : "") + s + ":" +
            (msPart + "").padStart(3, "0")
        );
    },

    tick() {
        if (!this.isRunning) return;

        const currentSegment = performance.now() - this.startTime;
        const totalElapsed = this.accumulatedTime + currentSegment;
        const timeString = this.formatTime(totalElapsed);

        if (timeString !== this.lastTimeString) {
            this.lastTimeString = timeString;
            for (const node of this.activeNodes) {
                if (node.timerDisplay) {
                    node.timerDisplay.textContent = timeString;
                }
            }
        }
        this.rafId = requestAnimationFrame(() => this.tick());
    },

    start(isResume = false) {
        if (this.isRunning) return;
        
        if (!isResume) {
            this.accumulatedTime = 0; // Reset on new execution
        }
        
        this.isRunning = true;
        this.startTime = performance.now();
        this.tick();

        // Set color to White when running/resuming
        this.updateColor("#ffffff");
    },

    /**
     * @param {string} status - 'success' (Green), 'pause' (Red), 'error' (Red)
     */
    stop(status = 'success') {
        if (!this.isRunning && status === 'pause') return; // Already paused
        
        if (this.isRunning) {
            this.accumulatedTime += (performance.now() - this.startTime);
            this.isRunning = false;
        }

        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }

        const finalTimeString = this.formatTime(this.accumulatedTime);

        for (const node of this.activeNodes) {
            if (node.timerDisplay) {
                node.timerDisplay.textContent = finalTimeString;
            }
            if (status === 'success') {
                if (node.lastTimeDisplay) {
                    node.lastTimeDisplay.textContent = `Last: ${finalTimeString}`;
                }
                node.properties.elapsed_time_str = finalTimeString;
                node.properties.last_execution_time = finalTimeString;
            }
        }

		// Color Logic
        if (status === 'success') {
            this.updateColor("#4caf50"); // Finished: Green
        } else if (status === 'pause') {
            this.updateColor("#ff9800"); // Paused: Orange
        } else {
            this.updateColor("#f44336"); // Error/Cancel: Red
        }
    },

    updateColor(color) {
        for (const node of this.activeNodes) {
            if (node.timerDisplay) {
                node.timerDisplay.style.color = color;
            }
        }
    },

    registerNode(node) { this.activeNodes.add(node); },
    unregisterNode(node) { this.activeNodes.delete(node); }
};

function loadStylesheet() {
    const cssUrl = new URL("workflow_timer.css", import.meta.url);
    if (!document.querySelector(`link[href="${cssUrl}"]`)) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = cssUrl;
        document.head.appendChild(link);
    }
}

app.registerExtension({
    name: "MagicTools.WorkflowTimer",

    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== "MTWorkflowTimerNode") return;

        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            onNodeCreated?.apply(this, arguments);

            this.size = [420, 130];
            this.properties = this.properties || {};
            this.properties.elapsed_time_str = this.properties.elapsed_time_str || "00:00:000";
            this.properties.last_execution_time = this.properties.last_execution_time || "None";
            
            this.color = "#333333";
            this.bgcolor = "#000000";

            const container = document.createElement("div");
            container.id = "workflow-timer";

            const display = document.createElement("div");
            display.className = "workflow-timer-display";
            display.textContent = this.properties.elapsed_time_str;
            display.style.color = "#ffffff"; // Default white
            
            const lastTime = document.createElement("div");
            lastTime.className = "workflow-timer-last-run";
            lastTime.textContent = `Last Execution: ${this.properties.last_execution_time}`;
            
            container.appendChild(display);
            container.appendChild(lastTime);
            
            this.timerDisplay = display;
            this.lastTimeDisplay = lastTime;

            this.addDOMWidget("workflowTimer", "timer", container);

            this.onResize = function (size) {
                const mainFontSize = Math.max(20, Math.min(size[0] / 8, size[1] / 1.8));
                display.style.fontSize = `${mainFontSize}px`;
                lastTime.style.fontSize = `${Math.max(10, mainFontSize / 4)}px`;
            };

            GlobalTimer.registerNode(this);
        };

        const onRemoved = nodeType.prototype.onRemoved;
        nodeType.prototype.onRemoved = function () {
            GlobalTimer.unregisterNode(this);
            onRemoved?.apply(this, arguments);
        };
    },

    setup() {
        loadStylesheet(); 	
        
        // Standard Execution Events
        api.addEventListener("execution_start", () => GlobalTimer.start(false));
        api.addEventListener("execution_success", () => GlobalTimer.stop('success'));
        api.addEventListener("execution_error", () => GlobalTimer.stop('error'));
        api.addEventListener("execution_interrupted", () => GlobalTimer.stop('error'));

        // --- Image Compare Integration ---
        api.addEventListener("mt.image_compare_preview", (event) => {
            // Check the detail for the isSkipping flag set by image_compare_pause.js
            if (event.detail && event.detail.isSkipping) return; 
            GlobalTimer.stop('pause'); // Pause (Orange)
        });

        // --- Pause Node Integration ---
        api.addEventListener("pause_workflow", (event) => {
            GlobalTimer.stop('pause'); // Pause (Orange)
        });					

        const originalFetch = window.fetch;
        window.fetch = function() {
            const url = typeof arguments[0] === 'string' ? arguments[0] : '';
            
            if (url.includes('/image_compare_pause/continue/') || url.includes('/pause_workflow/continue/')) {
                GlobalTimer.start(true); // Resume timer as White
            } else if (url.includes('/image_compare_pause/cancel') || url.includes('/pause_workflow/cancel')) {
                GlobalTimer.stop('error'); // Ensure Red on cancel
            }
            
            return originalFetch.apply(this, arguments);
        };
    }
});