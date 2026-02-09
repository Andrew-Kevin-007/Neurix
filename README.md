
# NEURIX | Transparent Autonomous Reasoning Engine

![NEURIX Banner](https://via.placeholder.com/1200x600/0A0A0C/8B5CF6?text=NEURIX+Autonomous+Reasoning+Engine)

> **Built for the Google DeepMind Gemini Hackathon**

**NEURIX** is a visual autonomous agent framework that breaks the "black box" of AI. Unlike standard chatbots that simply stream text, NEURIX architects, executes, and verifies complex workflows in real-time using a multi-agent system powered by the **Gemini 3 Model Family**.

It transforms natural language goals into Directed Acyclic Graphs (DAGs), allowing you to watch the agent's "thought process," intervene when necessary, and verify code artifacts instantly.

## 🌟 Key Capabilities

### 🔄 Automatic Agent & Model Switching
NEURIX doesn't use a single model for everything. The **ROUTER** dynamically assigns the best agent for each step to optimize for cost, speed, and reasoning depth:
*   **Planning (NEXUS)**: Uses `gemini-3-pro-preview` for complex dependency mapping.
*   **Execution (ION)**: Uses `gemini-3-flash-preview` for high-throughput text and code tasks.
*   **Vision (VORTEX)**: Automatically switches to `gemini-3-pro-image-preview` when visual assets are required.

### ✏️ Live Workflow Injection
You are not a passive observer. At any point, you can **Pause Execution** and enter the **Workflow Studio**.
*   Add new steps mid-flight.
*   Edit parameters of pending steps.
*   Re-route dependencies.
*   **Inject Changes**: The system hot-swaps the graph logic without losing state.

### 🛡️ Error Handling & Self-Healing
Meet **AXION**, the Verifier Agent. It audits every output against the user's original goal.
*   **Verification**: If a step output is hallucinated or buggy, AXION rejects it.
*   **Auto-Remediation**: The system triggers a "Self-Healing" branch, generating new steps (e.g., "Apply Hotfix") to correct the error automatically before proceeding.

### 📊 Live System Monitoring
Real-time telemetry gives you a window into the agent's "brain":
*   **Neural Load**: Visualizes active agent velocity.
*   **Token Usage**: Tracks consumption per agent in real-time.
*   **Maintenance Mode**: Even after the task is done, a "Watchdog" process monitors the system health and alerts on degradation.

### 🧪 QA Phase
Execution isn't the end. NEURIX runs a final **Project QA Review** phase, scoring the reliability of the final output (0-100) before marking the mission as complete.

---

## 🎯 Hackathon Strategic Tracks

NEURIX is architected to compete in the following tracks:

### 1. 🧠 The Marathon Agent (Long-Context & Reliability)
*   **Self-Correcting DAGs**: Uses a `Planner-Executor-Verifier` loop.
*   **Native Thinking**: Leverages `thinkingConfig` (Thinking Levels) in **Gemini 3 Pro**.
*   **State Persistence**: The "Watchdog" mode scans for system degradation even after the main task is complete.

### 2. 🎨 Creative Autopilot (Multimodal)
*   **Nano Banana Pro**: Uses `gemini-3-pro-image-preview` for high-fidelity visual asset generation.
*   **Browser-Based Verification**: Includes a **Live Artifact Runtime** where generated HTML/JS code can be executed and verified inside a secure sandbox immediately.

---

## 🛠️ Getting Started

### Prerequisites
*   Node.js (v18+)
*   An API Key from [Google AI Studio](https://aistudio.google.com/).

### Installation

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/yourusername/neurix.git
    cd neurix
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Configure Environment**
    Create a `.env` file in the root directory:
    ```env
    API_KEY=your_gemini_api_key_here
    ```

4.  **Run the System**
    ```bash
    npm start
    ```

---

## 📄 License

MIT License. Built with ❤️ and ☕ for the Google Gemini Hackathon.
