
export enum AgentState {
  INIT = 'INIT',
  PLANNING = 'PLANNING',
  REVIEW_PLAN = 'REVIEW_PLAN',
  EXECUTING = 'EXECUTING',
  AWAITING_INPUT = 'AWAITING_INPUT', // NEW: Human-in-the-Loop
  PAUSED = 'PAUSED',
  CHECKPOINT = 'CHECKPOINT',
  MAINTENANCE = 'MAINTENANCE',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum StepStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  WAITING_FOR_APPROVAL = 'WAITING_FOR_APPROVAL', // NEW
}

export interface WorkflowStep {
  id: string;
  label: string;
  description: string;
  actionType: 'RESEARCH' | 'CODE' | 'ANALYSIS' | 'DECISION' | 'CREATION' | 'INTEGRATION';
  dependencies: string[];
  status: StepStatus;
  // v1 Schema extensions
  parameters?: Record<string, string>;
  alternatives?: string[];
  output?: string;
  error?: string;
  reasoningTrace?: string;
  citations?: { uri: string; title: string }[];
  assignedAgentId?: string;
  executedModel?: string;
  toolId?: string;
  approvalRequired?: boolean; // NEW: Flag for critical steps
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

// --- ARTIFACTS SYSTEM ---
export type ArtifactType = 'CODE' | 'IMAGE' | 'DOCUMENT' | 'DATA';

export interface Artifact {
    id: string;
    stepId: string;
    type: ArtifactType;
    title: string;
    content: string; // Text content or Base64/URL
    language?: string; // For code
    timestamp: number;
}

// --- NEURIX V2 EXTENSIONS (Architecture Overlay) ---

export type AgentRole = 'PLANNER' | 'EXECUTOR' | 'VERIFIER' | 'SPECIALIST' | 'ROUTER' | 'INTEGRATOR';

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
  | 'MAINTENANCE_SCAN'
  | 'MAINTENANCE_REPORT'
  | 'ARTIFACT_GENERATED'
  | 'APPROVAL_REQUESTED'; // NEW

export interface TimelineEvent {
  id: string;
  timestamp: number;
  type: TimelineEventType;
  agentId: string;
  stepId?: string;
  message: string;
  thought?: ThoughtSignature;
  payload?: any;
}

export interface StepOverlayData {
  verified: boolean;
  requiresCheckpoint: boolean;
  verificationNotes?: string;
  executionThoughts: ThoughtSignature[]; 
  assignedAgentId?: string;
  activeModel?: string;
}

export type ExecutionOverlay = Record<string, StepOverlayData>;

export interface AgentMetrics {
  stepsExecuted: number;
  averageConfidence: number;
  verificationPassRate: number;
  tokenUsage: number;
  
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
