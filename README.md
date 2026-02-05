# NEURIX | Transparent Autonomous Reasoning Engine

> **Built for the Google DeepMind Gemini Hackathon**

**NEURIX** is a transparent autonomous agent framework that visualizes the "black box" of AI agency. Unlike standard chatbots that simply stream text, NEURIX architects, executes, and verifies complex workflows in real-time using a multi-agent system powered by the **Gemini 3 Model Family**.

It transforms natural language goals into Directed Acyclic Graphs (DAGs), allowing you to watch the agent's "thought process," intervene when necessary, and verify code artifacts instantly.

## 🎯 Hackathon Strategic Tracks

NEURIX is specifically architected to compete in the following tracks:

1.  **🧠 The Marathon Agent**:
    *   **Self-Correcting DAGs**: Uses a `Planner-Executor-Verifier` loop to handle complex, multi-step tasks that persist state.
    *   **Native Thinking**: Leverages `thinkingConfig` (Thinking Levels) in Gemini 3 Pro to maintain reasoning depth across long execution chains.
    *   **Autonomous Maintenance**: Includes a "Watchdog" mode that scans for system degradation even after the main task is complete.

2.  **🎨 Creative Autopilot**:
    *   **Nano Banana Pro**: Uses `gemini-3-pro-image-preview` for high-fidelity, 1K/2K resolution visual asset generation.
    *   **Browser-Based Verification**: Includes a **Live Artifact Runtime** where generated HTML/JS code can be executed and verified inside a secure sandbox immediately.

## ✨ Key Features

*   **Hybrid Reasoning Engine**: Combines **Native Thinking** (Gemini 3 `thinkingBudget`) for deep logic with explicit Chain-of-Thought logs for transparency.
*   **Visual Thinking Process**: Watch the agent build its plan as a dynamic node graph. See dependencies, parallel execution paths, and real-time status.
*   **Multimodal Native**:
    *   Drag & Drop images to give the agent visual context (e.g., *"Write code to recreate this website screenshot"*).
    *   Generates visual assets seamlessly using **Gemini 3 Pro Image**.
*   **Action-Era Artifacts**:
    *   **Live Preview**: Instantly run and verify generated code (HTML/JS/Games) in an in-app browser sandbox.
    *   **Downloadable Assets**: Export code and images directly.
*   **Human-in-the-Loop**:
    *   **Approval Gates**: Critical actions (like external API calls) pause for user authorization.
    *   **Workflow Editor**: Manually intervene, edit parameters, or re-route the agent mid-flight.
*   **Reliability Layer**:
    *   **Auto-Remediation**: If the system detects a degraded state, it generates a "fix-it" branch on the fly.
    *   **Neural Memory**: Persists context across sessions using local storage.

## 🚀 Gemini Integration (Under the Hood)

NEURIX utilizes the specific strengths of the Gemini family to optimize cost and performance:

| Agent Module | Model Used | Reasoning |
| :--- | :--- | :--- |
| **Planning (NEXUS)** | `gemini-3-pro-preview` | Uses **Native Thinking** (`thinkingBudget: 2048`) to construct robust dependency graphs. |
| **Coding & Logic** | `gemini-3-pro-preview` | Uses **Native Thinking** to architect complex code solutions before generation. |
| **Fast Execution** | `gemini-3-flash-preview` | Used for tool bridging, summaries, and rapid decision-making steps to reduce latency. |
| **Creative (VORTEX)** | `gemini-3-pro-image-preview` | **(Nano Banana Pro)** Dedicated model for high-fidelity 1K+ image generation. |
| **Verification (AXION)** | `gemini-3-pro-preview` | Critical auditing requires the "Pro" model with allocated thinking tokens to detect hallucinations. |

## 🛠️ Getting Started

### Prerequisites
*   Node.js (v18+)
*   A Google Cloud Project with the **Gemini API** enabled.
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

## 🎥 Demo Script (For Hackathon Video)

Use this flow to showcase the best features of NEURIX in under 2 minutes:

1.  **The Hook (0:00-0:15)**: 
    *   Refresh the page. Let the **Boot Sequence** play (Sound FX + Log Stream).
    *   Narrator: *"AI shouldn't be a black box. This is NEURIX."*

2.  **The Challenge (0:15-0:40)**: 
    *   Upload a screenshot of a simple UI or a game concept.
    *   Use **Voice Input**: *"Analyze this image and write a Python script to recreate this game logic."*
    *   Show the **Planner (NEXUS)** generating the graph nodes in real-time.

3.  **The Execution (0:40-1:10)**: 
    *   Click on a running node. Show the **Live Logs** and the internal monologue.
    *   Highlight the **Artifacts Panel** populating with code files and images.
    *   *Key moment*: Click the **Live Preview** button on a code artifact to show the game running inside NEURIX (Track 2 Verification).

4.  **The Verification & Correction (1:10-1:40)**: 
    *   Ideally, find a prompt that might trigger a verification failure (or explain the feature).
    *   Show the **Verifier (AXION)** node turning Green (Pass) or Red (Fail).
    *   If Red, explain how the system automatically re-plans to fix the error without human help.

5.  **The Human Element (1:40-2:00)**: 
    *   Show the **Workflow Editor**. Change a parameter mid-execution.
    *   End with the **System Monitor** showing the token usage and "Mission Accomplished" state.

## 📄 License

MIT License. Built for the Google DeepMind Gemini Hackathon.