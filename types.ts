
export enum AgentState {
  INIT = 'INIT',
  PLANNING = 'PLANNING',
  REVIEW_PLAN = 'REVIEW_PLAN',
  EXECUTING = 'EXECUTING',
  PAUSED = 'PAUSED',
  CHECKPOINT = 'CHECKPOINT',
  MAINTENANCE = 'MAINTENANCE', // New State
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum StepStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export interface WorkflowStep {
  id: string;
  label: string;
  description: string;
  actionType: 'RESEARCH' | 'CODE' | 'ANALYSIS' | 'DECISION' | 'CREATION';
  dependencies: string[];
  status: StepStatus;
  // v1 Schema extensions
  parameters?: Record<string, string>; // Changed to key-value map
  alternatives?: string[]; // Fallback strategies
  output?: string;
  error?: string;
  reasoningTrace?: string; // The "thought" process during execution
  citations?: { uri: string; title: string }[]; // NEW: Grounding sources
  assignedAgentId?: string; // NEW: Manual override for agent assignment
  executedModel?: string; // NEW: The specific Gemini model used for execution
}

export interface Workflow {
  version: string;
  goal: string;
  steps: WorkflowStep[];
}

export interface LogEntry {
  id: string;
  timestamp: number;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' | 'THOUGHT';
  message: string;
  metadata?: Record<string, any>;
}

export interface AgentContext {
  workflow: Workflow | null;
  logs: LogEntry[];
  currentStepId: string | null;
  state: AgentState;
}

// --- NEURIX V2 EXTENSIONS (Architecture Overlay) ---

export type AgentRole = 'PLANNER' | 'EXECUTOR' | 'VERIFIER' | 'SPECIALIST' | 'ROUTER';

export interface AgentIdentity {
  id: string;
  role: AgentRole;
  name: string;
  version: string; // e.g. "v2.1.0"
  color: string;   // UI visualization color (hex or tailwind class)
  capabilities: string[]; // ActionTypes this agent excels at
}

export interface ThoughtSignature {
  agentId: string;
  thinkingLevel: 'L1_FAST' | 'L2_REASONING';
  strategy: string; // e.g. "Heuristic", "Tree-Search", "ReAct"
  confidence: number; // 0.0 to 1.0
}

export type TimelineEventType = 
  | 'PHASE_CHANGE' 
  | 'AGENT_HANDOFF'
  | 'EXECUTION_START' 
  | 'EXECUTION_FAIL'
  | 'EXECUTION_COMPLETE' 
  | 'VERIFICATION_PASS' 
  | 'VERIFICATION_FAIL' 
  | 'CHECKPOINT_REQUEST'
  | 'CHECKPOINT_RESOLVED'
  | 'CHECKPOINT_AUTO'
  | 'MAINTENANCE_SCAN' // New event type
  | 'MAINTENANCE_REPORT'; // New event type

export interface TimelineEvent {
  id: string;
  timestamp: number;
  type: TimelineEventType;
  agentId: string;
  stepId?: string; // Link to V1 Step ID
  message: string;
  thought?: ThoughtSignature;
  payload?: any; // Flexible data payload for visualization
}

export interface StepOverlayData {
  verified: boolean;
  requiresCheckpoint: boolean;
  verificationNotes?: string;
  executionThoughts: ThoughtSignature[]; 
  assignedAgentId?: string; // Dynamically assigned agent
  activeModel?: string; // NEW: The model currently executing this step
}

// Maps V1 Step IDs to V2 Overlay Data
export type ExecutionOverlay = Record<string, StepOverlayData>;

export interface AgentMetrics {
  stepsExecuted: number;
  averageConfidence: number;
  verificationPassRate: number; // For Executor: (success / attempts)
  tokenUsage: number; // NEW: Total tokens consumed by this agent
  
  // Internal counters
  _totalConfidence: number;
  _thoughtCount: number;
  _verificationAttempts: number;
  _verificationSuccesses: number;
}

export interface MetricHistoryPoint {
  timestamp: number;
  agentId: string;
  metrics: AgentMetrics;
}