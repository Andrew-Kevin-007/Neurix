# NEURIX | Transparent Autonomous Reasoning Engine

![NEURIX Banner](https://via.placeholder.com/1200x600/0A0A0C/8B5CF6?text=NEURIX+Autonomous+Reasoning+Engine)

> **Built for the Google DeepMind Gemini Hackathon**

**NEURIX** is a visual autonomous agent framework that breaks the "black box" of AI. Unlike standard chatbots that simply stream text, NEURIX architects, executes, and verifies complex workflows in real-time using a multi-agent system powered by the **Gemini 3 Model Family**.

It transforms natural language goals into Directed Acyclic Graphs (DAGs), allowing you to watch the agent's "thought process," intervene when necessary, and verify code artifacts instantly.

## 🎯 Hackathon Strategic Tracks

NEURIX is architected to compete in the following tracks:

### 1. 🧠 The Marathon Agent (Long-Context & Reliability)
*   **Self-Correcting DAGs**: Uses a `Planner-Executor-Verifier` loop. If a step fails validation, the system automatically generates a remediation branch to fix itself without user intervention.
*   **Native Thinking**: Leverages `thinkingConfig` (Thinking Levels) in **Gemini 3 Pro** to maintain reasoning depth across long execution chains.
*   **State Persistence**: The "Watchdog" mode scans for system degradation even after the main task is complete.

### 2. 🎨 Creative Autopilot (Multimodal)
*   **Nano Banana Pro**: Uses `gemini-3-pro-image-preview` for high-fidelity, 1K/2K resolution visual asset generation.
*   **Browser-Based Verification**: Includes a **Live Artifact Runtime** where generated HTML/JS code can be executed and verified inside a secure sandbox immediately.

---

## ✨ Key Features

*   **Visual Thinking Process**: Watch the agent build its plan as a dynamic node graph. See dependencies, parallel execution paths, and real-time status.
*   **Hybrid Reasoning Engine**: Combines **Native Thinking** (Gemini 3 `thinkingBudget`) for deep logic with explicit Chain-of-Thought logs for transparency.
*   **Multimodal Native**:
    *   Drag & Drop images to give the agent visual context (e.g., *"Write code to recreate this website screenshot"*).
    *   Generates visual assets seamlessly.
*   **Action-Era Artifacts**:
    *   **Live Preview**: Instantly run and verify generated code (HTML/JS/Games) in an in-app browser sandbox.
    *   **Downloadable Assets**: Export code and images directly.
*   **Reliability Layer**:
    *   **Auto-Remediation**: If the system detects a degraded state or a failed QA check, it generates a "fix-it" branch on the fly.
    *   **Project QA Review**: A dedicated phase that scores the final output stability (0-100) before marking the project complete.

---

## 🚀 Gemini Integration (Under the Hood)

NEURIX utilizes the specific strengths of the Gemini family to optimize cost and performance:

| Agent Module | Model Used | Reasoning Strategy |
| :--- | :--- | :--- |
| **Planning (NEXUS)** | `gemini-3-pro-preview` | Uses **Native Thinking** (`thinkingBudget: 2048`) to construct robust dependency graphs. |
| **Logic & Coding** | `gemini-3-pro-preview` | Uses **Native Thinking** to architect complex code solutions before generation. |
| **Fast Execution** | `gemini-3-flash-preview` | Used for tool bridging, summaries, and rapid decision-making steps to reduce latency. |
| **Creative (VORTEX)** | `gemini-3-pro-image-preview` | **(Nano Banana Pro)** Dedicated model for high-fidelity 1K+ image generation. |
| **Verification (AXION)** | `gemini-3-pro-preview` | Critical auditing requires the "Pro" model to detect hallucinations and enforce safety. |

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
