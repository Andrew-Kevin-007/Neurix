
# NEURIX Technical Manual

## 1. System Architecture Overview

NEURIX is a client-side **Autonomous Reasoning Engine** built on React 19. It implements a **Planner-Executor-Verifier** architecture pattern, leveraging the **Google Gemini 3 Model Family** to perform complex, multi-step tasks with self-correction capabilities.

### 1.1 Core Components

*   **NEXUS (Planner)**: Responsible for converting natural language goals into Directed Acyclic Graphs (DAGs). It breaks down high-level directives into atomic executable steps (`WorkflowStep`).
*   **ION (Executor)**: The runtime engine that executes individual steps. It dynamically selects the appropriate Gemini model based on the task type (e.g., Coding vs. Creative Writing).
*   **AXION (Verifier)**: A specialized QA agent that audits the output of every step. If verification fails, it triggers a "Self-Healing" protocol, instructing NEXUS to generate a remediation branch.
*   **ROUTER**: The central state machine that manages transitions between `PLANNING`, `EXECUTING`, `QA_PHASE`, and `MAINTENANCE`.

### 1.2 State Machine (`AgentState`)

The application state flows as follows:
1.  **INIT**: System standby, awaiting user input or voice command.
2.  **PLANNING**: NEXUS generates the dependency graph using `gemini-3-pro-preview`.
3.  **REVIEW_PLAN**: Human-in-the-loop phase to approve or edit the generated graph.
4.  **EXECUTING**: The execution loop processes steps that have their dependencies met.
5.  **AWAITING_INPUT**: System pauses for "Critical Action" approval (e.g., external API calls).
6.  **QA_PHASE**: Once all steps are complete, AXION performs a final project-wide audit.
7.  **MAINTENANCE**: A "Watchdog" loop that periodically scans the system health and triggers auto-remediation if degradation is detected.

---

## 2. Gemini Model Strategy

NEURIX employs a **Model Routing** strategy to optimize for both intelligence (Reasoning) and latency (Speed).

| Task Type | Model ID | Strategy |
| :--- | :--- | :--- |
| **PLANNING** | `gemini-3-pro-preview` | High reasoning depth required to understand dependencies. |
| **CODE** & **ANALYSIS** | `gemini-3-pro-preview` | Requires logic and correctness. |
| **CREATION** (Text) | `gemini-3-flash-preview` | Low latency, high throughput for creative writing. |
| **IMAGE_GEN** | `gemini-3-pro-image-preview` | **Nano Banana Pro**. Dedicated vision model. |
| **QA / VERIFICATION** | `gemini-3-pro-preview` | High strictness. Used to detect hallucinations in generated code. |

**File Reference**: `services/gemini.ts` -> `getModelForAction()`

---

## 3. Reliability & Fallback Protocols

### 3.1 Deterministic Simulation (Demo Mode)
To ensure system stability during presentations or API outages, NEURIX includes a robust **Demo Mode**.
*   **Trigger**: Automatically activates if the API Key is missing or if the API returns a `429 Quota Exceeded` error.
*   **Behavior**: Seamlessly switches to local mock data.
*   **Visual Indicator**: A yellow "DEMO MODE" badge appears in the header.

### 3.2 Self-Healing
If a step fails execution or verification:
1.  The step status is marked as `FAILED`.
2.  The Planner generates a "Remediation Branch" (new steps appended to the graph).
3.  Execution resumes on the new branch.

---

## 4. Subsystems

### 4.1 The Graph Engine (`WorkflowGraph.tsx`)
*   **Rendering**: Uses SVG for edges and HTML/CSS for nodes.
*   **Layout Algorithm**: Custom rank-based layout engine. Calculates the "Rank" of each node based on its dependencies.

### 4.2 The Live Runtime (`ArtifactsPanel.tsx`)
*   **Sandboxing**: Code artifacts (HTML/JS) are rendered inside an `<iframe>` with `sandbox="allow-scripts"`.
*   **Preview**: Users can verify generated web pages or games immediately within the dashboard.

### 4.3 Audio Engine (`App.tsx` -> `playSfx`)
*   **Implementation**: Web Audio API (`AudioContext`).
*   **Synthesis**: Generates SFX (beeps, processing hums) procedurally using Oscillators.

---

## 5. Troubleshooting

### 5.1 "API Quota Exceeded"
*   **Fix**: The system will automatically enter Demo Mode. No action required. To use the live API, ensure your `.env` has a valid `API_KEY` with billing enabled.

### 5.2 React Warnings
*   **Missing Keys**: Ensure all list mappings use unique IDs (e.g., `step.id`).
*   **Effect Dependencies**: `useEffect` hooks have been optimized to prevent infinite loops.

---

## 6. Directory Structure

```
/
├── components/          # React UI Components
│   ├── WorkflowGraph.tsx    # Visual DAG Renderer
│   ├── SystemMonitor.tsx    # Token usage & Agent velocity
│   ├── ArtifactsPanel.tsx   # Code/Image previewer
│   └── ...
├── services/            # Logic Layer
│   ├── gemini.ts        # Google GenAI SDK wrapper & Prompt Engineering
│   └── ...
├── types.ts             # TypeScript Interfaces
├── App.tsx              # Main Controller & State Store
├── index.html           # Entry point
└── README.md            # General Info
```
