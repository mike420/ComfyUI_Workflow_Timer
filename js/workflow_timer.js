import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const GlobalTimer = {
    startTime: 0,
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

        const elapsed = performance.now() - this.startTime;
        const timeString = this.formatTime(elapsed);

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

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.startTime = performance.now();
        this.lastTimeString = "";
        this.tick();
    },

    stop() {
        if (!this.isRunning) return;
        this.isRunning = false;
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }

        const finalTime = performance.now() - this.startTime;
        const finalTimeString = this.formatTime(finalTime);

        for (const node of this.activeNodes) {
            if (node.timerDisplay) {
                node.timerDisplay.textContent = finalTimeString;
            }
            if (node.lastTimeDisplay) {
                node.lastTimeDisplay.textContent = `Last: ${finalTimeString}`;
            }
            node.properties.elapsed_time_str = finalTimeString;
            node.properties.last_execution_time = finalTimeString;
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
            container.style.cssText = `
                display: flex; flex-direction: column; align-items: center; justify-content: center;
                width: 100%; height: 100%; background: #000; overflow: hidden; gap: 5px;
            `;

            // Main Timer
            const display = document.createElement("div");
            display.className = "workflow-timer-display";
            display.textContent = this.properties.elapsed_time_str;
            
            // Last Execution Label
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
        api.addEventListener("execution_start", () => GlobalTimer.start());
        api.addEventListener("executing", ({ detail }) => {
            if (!detail) GlobalTimer.stop();
        });
        api.addEventListener("execution_error", () => GlobalTimer.stop());
        api.addEventListener("execution_interrupted", () => GlobalTimer.stop());
    }
});