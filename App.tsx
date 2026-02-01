
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AgentState, Workflow, WorkflowStep, StepStatus, LogEntry, TimelineEvent, TimelineEventType, AgentIdentity, ExecutionOverlay, ThoughtSignature, AgentMetrics, MetricHistoryPoint, Artifact } from './types';
import { generateWorkflow, executeWorkflowStep, replanWorkflow, verifyOutput, runMaintenanceScan, getModelForAction } from './services/gemini';
import WorkflowGraph from './components/WorkflowGraph';
import LogViewer from './components/LogViewer';
import TimelineViewer from './components/TimelineViewer';
import AgentStatusDisplay from './components/AgentStatus';
import PerformanceGraph from './components/PerformanceGraph';
import SystemMonitor from './components/SystemMonitor';
import OnboardingModal from './components/OnboardingModal';
import WorkflowEditor from './components/WorkflowEditor';
import ArtifactsPanel from './components/ArtifactsPanel';
import ApprovalModal from './components/ApprovalModal'; 
import VoiceInput from './components/VoiceInput';

// --- AGENT DEFINITIONS ---
const AGENTS: Record<string, AgentIdentity> = {
  ROUTER: { id: 'sys-router', role: 'ROUTER', name: 'ROUTER', version: '1.0', color: 'text-neurix-500', capabilities: [] },
  PLANNER: { id: 'nexus-arch', role: 'PLANNER', name: 'NEXUS', version: '2.4', color: 'text-neurix-accent', capabilities: ['PLANNING'] },
  VERIFIER: { id: 'axion-ov', role: 'VERIFIER', name: 'AXION', version: '3.1', color: 'text-neurix-warning', capabilities: ['VERIFICATION'] },
  HELIX: { id: 'helix-r', role: 'SPECIALIST', name: 'HELIX', version: '2.0', color: 'text-cyan-400', capabilities: ['RESEARCH', 'ANALYSIS'] },
  VORTEX: { id: 'vertex-c', role: 'SPECIALIST', name: 'VORTEX', version: '1.5', color: 'text-fuchsia-400', capabilities: ['CODE', 'CREATION'] },
  ECHO: { id: 'echo-g', role: 'SPECIALIST', name: 'ECHO', version: '2.2', color: 'text-yellow-400', capabilities: ['CREATION', 'DECISION'] },
  BRIDGE: { id: 'bridge-i', role: 'INTEGRATOR', name: 'BRIDGE', version: '1.1', color: 'text-orange-400', capabilities: ['INTEGRATION'] },
  EXECUTOR: { id: 'ion-op', role: 'EXECUTOR', name: 'ION', version: '1.9', color: 'text-neurix-success', capabilities: ['ALL'] },
};

const SUGGESTIONS = [
    { label: "Monitor & Alert", text: "Monitor Hacker News for 'AI Agents', summarize the top 3 posts, and send a Slack alert to #ai-news." },
    { label: "Code: Snake Game", text: "Write a complete Python script for a Snake game using the pygame library." },
    { label: "Research: Quantum", text: "Research the latest breakthroughs in solid-state batteries and summarize for a technical audience." },
];

const createInitialMetrics = (): AgentMetrics => ({ stepsExecuted: 0, averageConfidence: 0, verificationPassRate: 0, tokenUsage: 0, _totalConfidence: 0, _thoughtCount: 0, _verificationAttempts: 0, _verificationSuccesses: 0 });

type MobileTab = 'TIMELINE' | 'GRAPH' | 'SYSTEM';
type RightPanelTab = 'SYSTEM' | 'ARTIFACTS'; 
type SfxType = 'BOOT' | 'CLICK' | 'HOVER' | 'PROCESS' | 'SUCCESS' | 'ERROR' | 'ALERT';

export default function App() {
  // Initialize goal from localStorage if available (Neural Memory)
  const [goal, setGoal] = useState(() => localStorage.getItem('neurix_last_goal') || '');
  
  const [agentState, setAgentState] = useState<AgentState>(AgentState.INIT);
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]); 
  const [executionOverlay, setExecutionOverlay] = useState<ExecutionOverlay>({});
  const [currentStepId, setCurrentStepId] = useState<string | null>(null);
  const [selectedStep, setSelectedStep] = useState<WorkflowStep | null>(null);
  const [metrics, setMetrics] = useState<Record<string, AgentMetrics>>(() => {
      const initial: Record<string, AgentMetrics> = {};
      Object.values(AGENTS).forEach(agent => { initial[agent.id] = createInitialMetrics(); });
      return initial;
  });
  const [metricHistory, setMetricHistory] = useState<MetricHistoryPoint[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [hasVisited, setHasVisited] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>('GRAPH'); 
  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>('SYSTEM');
  const [isEditingPlan, setIsEditingPlan] = useState(false);
  const [pendingApprovalStep, setPendingApprovalStep] = useState<{ step: WorkflowStep, agent: AgentIdentity } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const stateRef = useRef(agentState);
  const workflowRef = useRef<Workflow | null>(null);
  const metricsRef = useRef(metrics);
  const executionOverlayRef = useRef(executionOverlay);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => { stateRef.current = agentState; }, [agentState]);
  useEffect(() => { workflowRef.current = workflow; }, [workflow]);
  useEffect(() => { metricsRef.current = metrics; }, [metrics]);
  useEffect(() => { executionOverlayRef.current = executionOverlay; }, [executionOverlay]);

  // Persist Goal to Neural Memory
  useEffect(() => {
      localStorage.setItem('neurix_last_goal', goal);
  }, [goal]);

  // --- AUDIO ENGINE (SFX) ---
  const initAudio = useCallback(() => {
    if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
    }
    // Ensure voices are loaded (Chrome quirk)
    if (window.speechSynthesis) {
        window.speechSynthesis.getVoices();
    }
  }, []);

  const playSfx = useCallback((type: SfxType) => {
    if (isMuted || !audioContextRef.current) return;
    
    const ctx = audioContextRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    switch (type) {
        case 'BOOT':
            osc.type = 'sine';
            osc.frequency.setValueAtTime(100, now);
            osc.frequency.exponentialRampToValueAtTime(600, now + 0.4);
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.2, now + 0.1);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
            osc.start(now);
            osc.stop(now + 0.8);
            break;
        case 'CLICK':
            osc.type = 'square';
            osc.frequency.setValueAtTime(800, now);
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
            break;
        case 'PROCESS':
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.linearRampToValueAtTime(300, now + 0.1);
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.15);
            osc.start(now);
            osc.stop(now + 0.15);
            break;
        case 'SUCCESS':
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, now);
            osc.frequency.setValueAtTime(1200, now + 0.1);
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.linearRampToValueAtTime(0.1, now + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
            osc.start(now);
            osc.stop(now + 0.4);
            break;
        case 'ERROR':
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.linearRampToValueAtTime(100, now + 0.2);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
            osc.start(now);
            osc.stop(now + 0.3);
            break;
        case 'ALERT':
            osc.type = 'square';
            osc.frequency.setValueAtTime(400, now);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
            osc.start(now);
            osc.stop(now + 0.3);
            setTimeout(() => {
                const osc2 = ctx.createOscillator();
                const gain2 = ctx.createGain();
                osc2.type = 'square';
                osc2.connect(gain2);
                gain2.connect(ctx.destination);
                osc2.frequency.setValueAtTime(400, now + 0.15);
                gain2.gain.setValueAtTime(0.1, now + 0.15);
                gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
                osc2.start(now + 0.15);
                osc2.stop(now + 0.45);
            }, 150);
            break;
    }
  }, [isMuted]);

  const activeAgentIds = React.useMemo(() => {
      if (!workflow) return [];
      const runningSteps = workflow.steps.filter(s => s.status === StepStatus.RUNNING);
      return runningSteps
        .map(s => executionOverlay[s.id]?.assignedAgentId)
        .filter(id => id !== undefined) as string[];
  }, [workflow, executionOverlay]);

  const speak = useCallback((text: string, priority: boolean = false) => {
      if (!('speechSynthesis' in window)) return;
      if (stateRef.current === AgentState.PAUSED && !priority) return;
      if (isMuted) return; 

      if (window.speechSynthesis.speaking && !priority) return;
      if (priority) window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.1; 
      utterance.pitch = 1.0;
      utterance.volume = 0.4; 
      
      const voices = window.speechSynthesis.getVoices();
      const techVoice = voices.find(v => v.name.includes('Google US English') || v.name.includes('Samantha'));
      if (techVoice) utterance.voice = techVoice;
      window.speechSynthesis.speak(utterance);
  }, [isMuted]);

  const addLog = useCallback((type: LogEntry['type'], message: string, metadata?: Record<string, any>) => {
    setLogs(prev => [...prev, { id: Math.random().toString(36).substr(2, 9), timestamp: Date.now(), type, message, metadata }]);
  }, []);

  const extractArtifacts = useCallback((step: WorkflowStep, output: string) => {
      const newArtifacts: Artifact[] = [];
      const timestamp = Date.now();
      const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
      let match;
      while ((match = codeBlockRegex.exec(output)) !== null) {
          const language = match[1] || 'text';
          const content = match[2];
          newArtifacts.push({
              id: Math.random().toString(36).substr(2, 9),
              stepId: step.id,
              type: 'CODE',
              title: `${step.label.replace(/\s+/g, '_')}_script.${language === 'python' ? 'py' : language === 'javascript' ? 'js' : 'txt'}`,
              content,
              language,
              timestamp
          });
      }
      if (output.startsWith('data:image')) {
          newArtifacts.push({
              id: Math.random().toString(36).substr(2, 9),
              stepId: step.id,
              type: 'IMAGE',
              title: `${step.label} Asset`,
              content: output,
              timestamp
          });
      }
      if (newArtifacts.length > 0) {
          setArtifacts(prev => [...prev, ...newArtifacts]);
          if (newArtifacts.some(a => a.type === 'IMAGE' || a.type === 'CODE')) setRightPanelTab('ARTIFACTS');
          addLog('SUCCESS', `Generated ${newArtifacts.length} new project artifacts.`);
          playSfx('SUCCESS');
          emitTimelineEvent('ARTIFACT_GENERATED', AGENTS.VORTEX, `Created ${newArtifacts.length} deliverables.`);
      }
  }, [addLog, playSfx]); 

  const runBootSequence = useCallback(async () => {
    initAudio();
    playSfx('BOOT');
    addLog('INFO', 'Initializing NEURIX Kernel v2.4...');
    await new Promise(r => setTimeout(r, 600));
    playSfx('PROCESS');
    addLog('INFO', 'Loading Neural Modules...', { modules: ['NEXUS', 'AXION', 'HELIX', 'VORTEX'] });
    await new Promise(r => setTimeout(r, 800));
    playSfx('PROCESS');
    addLog('INFO', 'Establishing Secure Handshake with Gemini-3...', { latency: '42ms' });
    await new Promise(r => setTimeout(r, 600));
    addLog('INFO', 'Restoring Neural Memory (LocalStorage)...');
    await new Promise(r => setTimeout(r, 400));
    playSfx('SUCCESS');
    addLog('SUCCESS', 'System Online. Awaiting directive.');
    speak("System Online. Ready for directive.");
  }, [addLog, speak, playSfx, initAudio]);

  const updateAgentMetrics = useCallback((agentId: string, updates: { confidence?: number, stepCompleted?: boolean, verificationResult?: boolean, tokens?: number }) => {
      setMetrics(prev => {
          const current = prev[agentId] || createInitialMetrics();
          const next = { ...current };
          if (updates.confidence !== undefined) { next._totalConfidence += updates.confidence; next._thoughtCount += 1; next.averageConfidence = next._totalConfidence / next._thoughtCount; }
          if (updates.stepCompleted) next.stepsExecuted += 1;
          if (updates.tokens) next.tokenUsage += updates.tokens;
          if (updates.verificationResult !== undefined) { next._verificationAttempts += 1; if (updates.verificationResult) next._verificationSuccesses += 1; next.verificationPassRate = next._verificationSuccesses / next._verificationAttempts; }
          setMetricHistory(h => {
              const newPoint = { timestamp: Date.now(), agentId, metrics: { ...next } };
              const newHistory = [...h, newPoint];
              return newHistory.length > 100 ? newHistory.slice(newHistory.length - 100) : newHistory;
          });
          return { ...prev, [agentId]: next };
      });
  }, []);

  const emitTimelineEvent = useCallback((type: TimelineEventType, agent: AgentIdentity, message: string, stepId?: string, payload?: any, customThought?: ThoughtSignature) => {
    const defaultThought: ThoughtSignature = { agentId: agent.id, thinkingLevel: 'L1_FAST', strategy: 'Heuristic', confidence: 0.95 + (Math.random() * 0.04) };
    const event: TimelineEvent = { id: Math.random().toString(36).substr(2, 9), timestamp: Date.now(), type, agentId: agent.id, stepId, message, thought: customThought || defaultThought, payload };
    setTimeline(prev => [...prev, event]);
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      playSfx('CLICK');
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        const base64Data = base64String.split(',')[1];
        setSelectedImage(base64Data);
        playSfx('SUCCESS');
        addLog('INFO', `Visual Context Loaded: ${file.name}`, { size: `${(file.size / 1024).toFixed(1)}KB` });
        speak("Visual context loaded.");
      };
      reader.readAsDataURL(file);
    }
  };

  const selectAgentForTask = (step: WorkflowStep, busyAgentIds: string[]): AgentIdentity => {
      if (step.assignedAgentId && Object.values(AGENTS).some(a => a.id === step.assignedAgentId)) return Object.values(AGENTS).find(a => a.id === step.assignedAgentId)!;
      const candidates = Object.values(AGENTS).filter(a => ['PLANNER','VERIFIER','ROUTER'].indexOf(a.role) === -1);
      const primary = candidates.find(a => a.capabilities.includes(step.actionType));
      if (primary && !busyAgentIds.includes(primary.id)) return primary;
      const alternative = candidates.find(a => a.id !== primary?.id && !busyAgentIds.includes(a.id) && (a.capabilities.includes(step.actionType) || a.capabilities.includes('ALL')));
      if (alternative) return alternative;
      return primary || candidates.find(a => a.role === 'EXECUTOR') || candidates[0];
  };

  const triggerStepExecution = useCallback(async (step: WorkflowStep, contextWorkflow: Workflow, assignedAgent: AgentIdentity) => {
      setCurrentStepId(step.id);
      playSfx('PROCESS');
      const activeModel = getModelForAction(step.actionType);

      if (step.actionType === 'INTEGRATION' && !step.approvalRequired) {
          setAgentState(AgentState.AWAITING_INPUT);
          setPendingApprovalStep({ step, agent: assignedAgent });
          playSfx('ALERT');
          addLog('WARNING', `Critical Action Paused: ${step.label}`, { agentName: assignedAgent.name, agentColor: assignedAgent.color });
          emitTimelineEvent('APPROVAL_REQUESTED', assignedAgent, `Requesting authorization for external action: ${step.toolId?.toUpperCase()}`, step.id);
          speak("Critical action requires approval.", true);
          return; 
      }

      const executionThought: ThoughtSignature = { agentId: assignedAgent.id, thinkingLevel: 'L2_REASONING', strategy: 'Probabilistic', confidence: 0.88 };
      setExecutionOverlay(prev => ({ ...prev, [step.id]: { verified: false, requiresCheckpoint: false, assignedAgentId: assignedAgent.id, executionThoughts: [executionThought], activeModel: activeModel } }));
      emitTimelineEvent('EXECUTION_START', assignedAgent, `Processing ${step.label}`, step.id, { model: activeModel }, executionThought);
      addLog('INFO', `Starting Step: ${step.label}`, { agentName: assignedAgent.name, agentColor: assignedAgent.color, model: activeModel });
      updateAgentMetrics(assignedAgent.id, { confidence: 0.88 });

      let simulatedTokens = 0;
      const tokenStreamer = setInterval(() => {
          const isBurst = Math.random() > 0.7;
          const tokens = isBurst ? Math.floor(Math.random() * 6) + 4 : Math.floor(Math.random() * 2) + 1;
          simulatedTokens += tokens;
          updateAgentMetrics(assignedAgent.id, { tokens });
      }, 200);

      try {
          const result = await executeWorkflowStep(step, contextWorkflow.steps, contextWorkflow.goal, selectedImage);
          
          clearInterval(tokenStreamer);
          const correction = result.tokens - simulatedTokens;
          updateAgentMetrics(assignedAgent.id, { stepCompleted: true, tokens: correction }); 
          addLog('THOUGHT', result.reasoning, { agentName: assignedAgent.name, agentColor: assignedAgent.color, model: result.model });
          addLog('INFO', 'Requesting AXION Verification...', { agentName: AGENTS.VERIFIER.name, agentColor: AGENTS.VERIFIER.color });
          const verification = await verifyOutput(step, result.output, contextWorkflow.goal);
          updateAgentMetrics(AGENTS.VERIFIER.id, { verificationResult: verification.passed, tokens: verification.tokens });
          if (verification.passed) {
              setWorkflow(prev => prev ? ({ ...prev, steps: prev.steps.map(s => s.id === step.id ? { ...s, status: StepStatus.COMPLETED, output: result.output, citations: result.citations, executedModel: result.model } : s) }) : null);
              extractArtifacts(step, result.output);
              playSfx('SUCCESS');
              emitTimelineEvent('VERIFICATION_PASS', AGENTS.VERIFIER, 'Output Verified: ' + verification.reason, step.id);
              addLog('SUCCESS', `Step completed: ${step.label}`, { agentName: assignedAgent.name, agentColor: assignedAgent.color, model: result.model });
          } else {
              setAgentState(AgentState.CHECKPOINT);
              playSfx('ERROR');
              emitTimelineEvent('VERIFICATION_FAIL', AGENTS.VERIFIER, 'Rejected: ' + verification.reason, step.id);
              addLog('WARNING', `Verification Failed: ${verification.reason}. Triggering self-correction protocol.`);
              speak("Anomaly detected. Initiating recovery protocol.", true);
              setWorkflow(prev => prev ? ({ ...prev, steps: prev.steps.map(s => s.id === step.id ? { ...s, status: StepStatus.FAILED, error: verification.reason } : s) }) : null);
              await handleFailure(step, contextWorkflow.steps, verification.reason, contextWorkflow.goal);
          }
      } catch (e) {
          clearInterval(tokenStreamer);
          playSfx('ERROR');
          setWorkflow(prev => prev ? ({ ...prev, steps: prev.steps.map(s => s.id === step.id ? { ...s, status: StepStatus.FAILED, error: String(e) } : s) }) : null);
          await handleFailure(step, contextWorkflow.steps, String(e), contextWorkflow.goal);
      }
  }, [emitTimelineEvent, updateAgentMetrics, addLog, speak, extractArtifacts, playSfx, selectedImage]); 

  const handleApproval = (approved: boolean) => {
      if (!pendingApprovalStep) return;
      const { step, agent } = pendingApprovalStep;
      playSfx(approved ? 'SUCCESS' : 'ERROR');
      if (approved) {
          addLog('SUCCESS', `Action Authorized by Operator. Resuming execution.`, { agentName: 'ROUTER', agentColor: AGENTS.ROUTER.color });
          speak("Access granted. Proceeding.");
          setAgentState(AgentState.EXECUTING);
          triggerStepExecution({ ...step, approvalRequired: true }, workflow!, agent);
      } else {
          addLog('WARNING', `Action Rejected by Operator. Aborting step.`, { agentName: 'ROUTER', agentColor: AGENTS.ROUTER.color });
          speak("Access denied. Aborting.");
          setWorkflow(prev => prev ? ({ ...prev, steps: prev.steps.map(s => s.id === step.id ? { ...s, status: StepStatus.FAILED, error: "Operator Rejected Action" } : s) }) : null);
          setAgentState(AgentState.EXECUTING); 
          handleFailure(step, workflow!.steps, "Operator Rejected Action", workflow!.goal);
      }
      setPendingApprovalStep(null);
  };

  const executeDispatcher = useCallback(() => {
    if (stateRef.current !== AgentState.EXECUTING) return;
    const currentWorkflow = workflowRef.current;
    if (!currentWorkflow) return;
    const executableSteps = currentWorkflow.steps.filter(step => step.status === StepStatus.PENDING && (step.dependencies.length === 0 || step.dependencies.every(depId => currentWorkflow.steps.find(s => s.id === depId)?.status === StepStatus.COMPLETED)));
    if (executableSteps.length === 0) {
        const hasRunning = currentWorkflow.steps.some(s => s.status === StepStatus.RUNNING);
        const hasPending = currentWorkflow.steps.some(s => s.status === StepStatus.PENDING);
        const hasApprovalWait = stateRef.current === AgentState.AWAITING_INPUT; 
        if (!hasRunning && !hasPending && !hasApprovalWait) {
            setAgentState(AgentState.MAINTENANCE);
            playSfx('SUCCESS');
            addLog('SUCCESS', 'Execution Phase Complete. Initiating Autonomous Maintenance Protocol.');
            speak("Mission objectives met. Entering maintenance mode.");
        }
        return;
    }
    const busyAgentIds = [...activeAgentIds]; 
    const assignments: { step: WorkflowStep, agent: AgentIdentity }[] = [];
    executableSteps.forEach(step => {
        const agent = selectAgentForTask(step, busyAgentIds);
        busyAgentIds.push(agent.id); 
        assignments.push({ step, agent });
    });
    setWorkflow(prev => prev ? ({ ...prev, steps: prev.steps.map(s => executableSteps.some(e => e.id === s.id) ? { ...s, status: StepStatus.RUNNING } : s) }) : null);
    assignments.forEach(({ step, agent }) => { triggerStepExecution(step, currentWorkflow, agent); });
  }, [activeAgentIds, triggerStepExecution, addLog, speak, playSfx]);

  const handleFailure = async (failedStep: WorkflowStep, allSteps: WorkflowStep[], error: string, goal: string) => {
      addLog('ERROR', `Failure detected in ${failedStep.label}. Initiating replan...`, { agentName: 'ROUTER', agentColor: AGENTS.ROUTER.color });
      try {
          const killList = new Set<string>();
          const findDownstream = (id: string) => { allSteps.forEach(s => { if (s.dependencies.includes(id)) { killList.add(s.id); findDownstream(s.id); } }); };
          findDownstream(failedStep.id);
          setWorkflow(prev => prev ? ({ ...prev, steps: prev.steps.map(s => killList.has(s.id) ? { ...s, status: StepStatus.FAILED, error: "Cascade Failure: Path Abandoned" } : s) }) : null);
          const { steps: newSteps, tokens } = await replanWorkflow(failedStep, allSteps, error, goal);
          updateAgentMetrics(AGENTS.PLANNER.id, { tokens, confidence: 0.8 });
          const lastCompletedStep = allSteps.filter(s => s.status === StepStatus.COMPLETED).pop();
          const timestamp = Date.now();
          const remappedSteps = newSteps.map((s, index) => {
              const newId = `replan-${timestamp}-${s.id}`;
              const newDeps = s.dependencies.reduce((acc, d) => { const internalDep = newSteps.find(ns => ns.id === d); if (internalDep) acc.push(`replan-${timestamp}-${d}`); return acc; }, [] as string[]);
              if (index === 0 && lastCompletedStep && newDeps.length === 0) newDeps.push(lastCompletedStep.id);
              return { ...s, id: newId, dependencies: newDeps, status: StepStatus.PENDING };
          });
          setWorkflow(prev => prev ? ({ ...prev, steps: [...prev.steps, ...remappedSteps] }) : null);
          playSfx('PROCESS');
          emitTimelineEvent('PHASE_CHANGE', AGENTS.PLANNER, 'Timeline Diverged. New Path Created.');
          addLog('SUCCESS', 'Recovery path generated. Resuming execution.');
          speak("Rerouting complete. Resuming.");
          setAgentState(AgentState.EXECUTING);
      } catch (e) {
          playSfx('ERROR');
          addLog('ERROR', "Critical Planner Failure during Recovery.");
          setAgentState(AgentState.FAILED);
      }
  };

  useEffect(() => { if (agentState === AgentState.EXECUTING) { const interval = setInterval(executeDispatcher, 1000); executeDispatcher(); return () => clearInterval(interval); } }, [agentState, executeDispatcher]);

  const toggleMute = () => { setIsMuted(!isMuted); window.speechSynthesis.cancel(); };
  const togglePause = () => {
      playSfx('CLICK');
      if (agentState === AgentState.EXECUTING) { setAgentState(AgentState.PAUSED); addLog('WARNING', 'Execution Paused by Operator.'); } 
      else if (agentState === AgentState.PAUSED) { setAgentState(AgentState.EXECUTING); addLog('INFO', 'Execution Resumed.'); }
  };
  const stopMaintenance = () => { playSfx('CLICK'); setAgentState(AgentState.COMPLETED); addLog('INFO', 'Maintenance Mode Halted by Operator.'); speak("Maintenance mode stopped."); };
  const resetSystem = () => { 
      playSfx('BOOT');
      setWorkflow(null); 
      setLogs([]); 
      setTimeline([]); 
      setArtifacts([]); 
      setAgentState(AgentState.INIT); 
      setGoal(''); 
      localStorage.removeItem('neurix_last_goal'); // Clear memory
      setSelectedImage(null); 
      addLog('INFO', 'System Reset. Neural Memory flushed.'); 
  };

  const handleGeneratePlan = async (customGoal?: string) => {
    initAudio(); 
    playSfx('CLICK');
    const targetGoal = customGoal || goal;
    if (!targetGoal.trim()) return;
    if (customGoal) setGoal(customGoal);
    setAgentState(AgentState.PLANNING);
    speak("Analyzing request.");
    emitTimelineEvent('PHASE_CHANGE', AGENTS.PLANNER, 'Initializing Planning Phase');
    addLog('INFO', `Directive received: "${targetGoal}"`);
    if (selectedImage) addLog('INFO', 'Processing Visual Input matrix...');
    addLog('THOUGHT', 'NEXUS Agent formulating execution strategy...', { agentName: AGENTS.PLANNER.name, agentColor: AGENTS.PLANNER.color });
    try {
      const { steps, tokens } = await generateWorkflow(targetGoal, selectedImage);
      setWorkflow({ version: 'v1', goal: targetGoal, steps });
      updateAgentMetrics(AGENTS.PLANNER.id, { tokens, stepCompleted: true, confidence: 0.95 });
      setAgentState(AgentState.REVIEW_PLAN);
      playSfx('SUCCESS');
      emitTimelineEvent('AGENT_HANDOFF', AGENTS.PLANNER, 'Workflow Generated. Awaiting Approval.');
      addLog('SUCCESS', 'Workflow generated successfully.', { tokensUsed: tokens, stepCount: steps.length });
      speak("Workflow generated. Awaiting approval.");
    } catch (error) {
      setAgentState(AgentState.FAILED);
      playSfx('ERROR');
      addLog('ERROR', String(error));
      speak("Error generating workflow.");
    }
  };

  const handleApprovePlan = () => {
    if (workflow) {
      playSfx('CLICK');
      setAgentState(AgentState.EXECUTING);
      emitTimelineEvent('PHASE_CHANGE', AGENTS.ROUTER, 'Execution Sequence Initiated.');
      addLog('INFO', 'User authorized execution. Transferring control to Router.');
      speak("Authorization confirmed. Executing.");
    }
  };

  const handleVoiceTranscript = (text: string) => {
      setGoal(prev => (prev ? `${prev} ${text}` : text));
  };

  // Maintenance Loop
  useEffect(() => {
    if (agentState !== AgentState.MAINTENANCE) return;
    const interval = setInterval(async () => {
        if (!workflowRef.current) return;
        addLog('INFO', 'Maintenance Watchdog: Scanning system integrity...', { agentName: 'AXION', agentColor: AGENTS.VERIFIER.color });
        emitTimelineEvent('MAINTENANCE_SCAN', AGENTS.VERIFIER, 'Executing background diagnostic sweep.');
        try {
            const scan = await runMaintenanceScan(workflowRef.current);
            updateAgentMetrics(AGENTS.VERIFIER.id, { tokens: scan.tokens });
            if (scan.status === 'DEGRADED') {
                playSfx('ALERT');
                addLog('WARNING', `Anomaly Detected: ${scan.message}`, { agentName: 'AXION', agentColor: AGENTS.VERIFIER.color });
                emitTimelineEvent('MAINTENANCE_REPORT', AGENTS.VERIFIER, `Anomaly: ${scan.message}`);
                speak("Anomaly detected in maintenance scan.");
            } else {
                addLog('SUCCESS', `System Stable: ${scan.message}`, { agentName: 'AXION', agentColor: AGENTS.VERIFIER.color });
            }
        } catch (e) { console.error("Maintenance scan failed", e); }
    }, 15000);
    return () => clearInterval(interval);
  }, [agentState, addLog, emitTimelineEvent, speak, updateAgentMetrics, playSfx]);

  // Helper for Copying Text
  const copyToClipboard = (text: string) => {
      navigator.clipboard.writeText(text);
      playSfx('SUCCESS');
      addLog('INFO', 'Output copied to clipboard.');
  };

  return (
    <div className="relative w-screen h-[100dvh] overflow-hidden font-sans selection:bg-neurix-accent/30 text-neurix-300">
      {!hasVisited && <OnboardingModal agents={AGENTS} onStart={() => { setHasVisited(true); runBootSequence(); }} />}
      {isEditingPlan && workflow && <WorkflowEditor workflow={workflow} agents={AGENTS} onSave={(updated) => { setWorkflow(updated); setIsEditingPlan(false); addLog('SUCCESS', 'Plan Updated manually by operator.'); }} onCancel={() => setIsEditingPlan(false)} />}
      
      {pendingApprovalStep && <ApprovalModal step={pendingApprovalStep.step} agent={pendingApprovalStep.agent} onApprove={() => handleApproval(true)} onReject={() => handleApproval(false)} />}

      {/* LAYER 0: Graph (Background) - Always rendered, z-index managed by container */}
      <div className="absolute inset-0 z-0">
         <WorkflowGraph steps={workflow?.steps || []} currentStepId={currentStepId} onStepClick={(step) => { setSelectedStep(step); setRightPanelTab('SYSTEM'); }} executionOverlay={executionOverlay} agents={AGENTS} />
      </div>

      {/* LAYER 1: Fluid Layout HUD */}
      <div className="absolute inset-0 z-20 pointer-events-none flex flex-col h-full overflow-hidden">
         
         {/* HEADER */}
         <header className="shrink-0 p-4 md:p-6 flex flex-col md:flex-row justify-between items-stretch md:items-start gap-3 pointer-events-auto">
             <div className="glass-panel px-4 py-3 rounded-2xl flex items-center justify-between md:justify-start gap-4">
                 <div className="flex items-center gap-3">
                     <div className="w-8 h-8 rounded-lg bg-neurix-900 border border-white/10 flex items-center justify-center">
                         <div className="w-2.5 h-2.5 bg-neurix-accent rounded-sm shadow-glow" />
                     </div>
                     <div>
                         <h1 className="text-sm font-bold tracking-tight text-white leading-none">NEURIX <span className="text-neurix-500 font-normal">OS</span></h1>
                         <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-mono text-neurix-500 tracking-wide uppercase">V2.4.0 <span className="text-neurix-success mx-1">•</span> ONLINE</span>
                            <span className="hidden md:inline-block w-px h-2 bg-neurix-500/30"></span>
                            <span className="hidden md:inline-block text-[9px] font-mono text-neurix-400 bg-white/5 px-1 rounded">GEMINI 2.0 FLASH</span>
                         </div>
                     </div>
                 </div>
                 <div className="md:hidden">
                    <button onClick={toggleMute} className={`p-2 rounded-lg border transition-all ${isMuted ? 'bg-neurix-danger/10 border-neurix-danger/30 text-neurix-danger' : 'bg-white/5 border-white/10 text-neurix-400 hover:text-white'}`}>
                        {isMuted ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg> : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>}
                    </button>
                 </div>
             </div>

             <div className="glass-panel px-6 py-3 rounded-2xl hidden md:flex items-center gap-8">
                 <PerformanceGraph history={metricHistory} agents={AGENTS} activeAgentIds={activeAgentIds} />
                 <div className="w-px h-6 bg-white/10" />
                 <AgentStatusDisplay state={agentState} />
             </div>
             <div className="glass-panel px-4 py-2 rounded-xl md:hidden flex justify-center">
                 <AgentStatusDisplay state={agentState} />
             </div>
         </header>

         {/* MAIN CONTENT AREA */}
         <div className="flex-1 min-h-0 flex gap-4 md:gap-6 px-4 md:px-6 pb-4 md:pb-6 overflow-hidden">
             
             {/* LEFT: Timeline */}
             <aside className={`
                flex-col min-h-0 pointer-events-auto transition-all duration-300 ease-in-out
                ${isEditingPlan ? 'opacity-0 pointer-events-none' : 'opacity-100'}
                ${mobileTab === 'TIMELINE' ? 'flex w-full absolute inset-4 z-30 bg-black/80 backdrop-blur-xl md:static md:w-[320px] 2xl:w-[360px] md:flex md:bg-transparent md:inset-auto' : 'hidden xl:flex w-[320px] 2xl:w-[360px]'}
             `}>
                 <div className="glass-panel flex-1 rounded-3xl overflow-hidden flex flex-col shadow-2xl md:shadow-none border border-white/10 md:border-white/5">
                     <TimelineViewer events={timeline} agents={AGENTS} />
                 </div>
             </aside>

             {/* CENTER: Graph/Input */}
             <main className={`
                relative flex flex-col items-center justify-end
                ${mobileTab === 'GRAPH' ? 'flex-1' : 'hidden lg:flex flex-1'}
             `}>
                 {/* Input / Suggestions / Controls */}
                 {(agentState === AgentState.INIT || agentState === AgentState.COMPLETED || agentState === AgentState.FAILED) && (
                     <div className="w-full max-w-xl pointer-events-auto animate-pop-in flex flex-col gap-4 mb-20 lg:mb-0">
                         {selectedImage && (
                            <div className="self-start glass-panel px-3 py-2 rounded-xl flex items-center gap-3">
                                 <img src={`data:image/png;base64,${selectedImage}`} className="h-8 w-8 rounded-lg object-cover" />
                                 <span className="text-[10px] font-mono uppercase text-neurix-300">Image Context Added</span>
                                 <button onClick={() => setSelectedImage(null)} className="text-neurix-500 hover:text-white">×</button>
                            </div>
                         )}

                         <div className="glass-panel p-1.5 rounded-2xl flex items-center gap-2 shadow-2xl transition-transform focus-within:scale-[1.01]">
                             <button onClick={() => fileInputRef.current?.click()} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-neurix-400 hover:text-white transition-colors">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                             </button>
                             <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />
                             
                             <input 
                                className="flex-1 bg-transparent border-none outline-none text-sm text-white placeholder-neurix-500 font-medium h-10 px-2"
                                placeholder="Enter directive or speak..."
                                value={goal}
                                onChange={(e) => setGoal(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleGeneratePlan()}
                                autoFocus
                             />
                             
                             <VoiceInput 
                                onTranscript={handleVoiceTranscript} 
                                isProcessing={agentState === AgentState.PLANNING}
                             />

                             <button onClick={() => handleGeneratePlan()} disabled={!goal.trim()} className="h-10 px-5 rounded-xl bg-neurix-100 text-black font-bold text-xs tracking-wide hover:bg-white transition-colors disabled:opacity-50">INITIATE</button>
                         </div>
                         
                         <div className="flex gap-2 justify-center flex-wrap">
                            {SUGGESTIONS.map((s, i) => (
                                <button key={i} onClick={() => handleGeneratePlan(s.text)} className="px-3 py-1.5 rounded-xl bg-black/40 border border-white/5 hover:border-white/20 text-[10px] text-neurix-500 hover:text-neurix-300 transition-colors">
                                    {s.label}
                                </button>
                            ))}
                         </div>
                     </div>
                 )}
                 
                 {/* Approval UI */}
                 {agentState === AgentState.REVIEW_PLAN && !isEditingPlan && (
                     <div className="pointer-events-auto animate-pop-in mb-20 lg:mb-0">
                         <div className="glass-panel px-6 py-3 rounded-full flex items-center gap-6 shadow-2xl">
                             <span className="text-[11px] text-neurix-300 font-medium tracking-wide hidden sm:inline">Awaiting Authorization</span>
                             <div className="h-4 w-px bg-white/10 hidden sm:block" />
                             <div className="flex gap-2">
                                <button onClick={() => setIsEditingPlan(true)} className="px-3 py-1.5 rounded-full hover:bg-white/5 text-[10px] font-bold text-neurix-400 hover:text-white transition-colors">EDIT</button>
                                <button onClick={() => setAgentState(AgentState.INIT)} className="px-3 py-1.5 rounded-full hover:bg-white/5 text-[10px] font-bold text-neurix-400 hover:text-white transition-colors">ABORT</button>
                                <button onClick={handleApprovePlan} className="px-4 py-1.5 rounded-full bg-neurix-success text-black text-[10px] font-bold hover:bg-emerald-400 transition-colors">EXECUTE</button>
                             </div>
                         </div>
                     </div>
                 )}
             </main>

             {/* RIGHT: Inspector */}
             <aside className={`
                flex-col min-h-0 pointer-events-auto transition-all duration-300 ease-in-out
                ${isEditingPlan ? 'opacity-0 pointer-events-none' : 'opacity-100'}
                ${mobileTab === 'SYSTEM' ? 'flex w-full absolute inset-4 z-30 bg-black/80 backdrop-blur-xl md:static md:w-[380px] 2xl:w-[420px] md:flex md:bg-transparent md:inset-auto' : 'hidden lg:flex w-[380px] 2xl:w-[420px]'}
             `}>
                 <div className="glass-panel flex-1 rounded-3xl overflow-hidden flex flex-col shadow-2xl md:shadow-none border border-white/10 md:border-white/5">
                     <div className="flex border-b border-white/5">
                         <button onClick={() => setRightPanelTab('SYSTEM')} className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-wider transition-colors ${rightPanelTab === 'SYSTEM' ? 'text-white bg-white/5' : 'text-neurix-500 hover:text-neurix-300'}`}>System</button>
                         <button onClick={() => setRightPanelTab('ARTIFACTS')} className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-wider transition-colors relative ${rightPanelTab === 'ARTIFACTS' ? 'text-white bg-white/5' : 'text-neurix-500 hover:text-neurix-300'}`}>Artifacts {artifacts.length > 0 && <span className="absolute top-2.5 right-4 w-1.5 h-1.5 bg-neurix-accent rounded-full" />}</button>
                     </div>
                     
                     <div className="flex-[3] min-h-0 border-b border-white/5 flex flex-col relative bg-neurix-900/40">
                         {rightPanelTab === 'ARTIFACTS' ? (
                             <ArtifactsPanel artifacts={artifacts} />
                         ) : selectedStep ? (
                            <div className="flex flex-col h-full animate-fade-in p-5 overflow-y-auto custom-scrollbar">
                                 <div className="flex items-center justify-between mb-4">
                                     <div className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[9px] font-mono text-neurix-300 uppercase tracking-widest">{selectedStep.actionType}</div>
                                     <button onClick={() => setSelectedStep(null)} className="text-neurix-600 hover:text-white transition-colors">×</button>
                                 </div>
                                 <h2 className="text-sm font-bold text-white mb-4 leading-relaxed">{selectedStep.label}</h2>
                                 
                                 <div className="space-y-6">
                                     <div>
                                         <label className="text-[9px] font-mono text-neurix-600 uppercase tracking-widest block mb-2">Parameters</label>
                                         <div className="bg-black/30 rounded border border-white/5 p-3 font-mono text-[10px] text-neurix-400 whitespace-pre-wrap">
                                            {selectedStep.description}
                                         </div>
                                     </div>
                                     
                                     {selectedStep.output && (
                                         <div>
                                             <div className="flex items-center justify-between mb-2">
                                                <label className="text-[9px] font-mono text-neurix-600 uppercase tracking-widest">Output</label>
                                                {!selectedStep.output.startsWith('data:image') && (
                                                    <button onClick={() => copyToClipboard(selectedStep.output!)} className="text-[9px] text-neurix-500 hover:text-white flex items-center gap-1 transition-colors">
                                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 011.414.586l4.414 4.414a1 1 0 01.586 1.414V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 01-2-2V5a2 2 0 012-2h4.586" /></svg>
                                                        COPY
                                                    </button>
                                                )}
                                             </div>
                                             <div className="bg-black/30 rounded border border-white/5 overflow-hidden">
                                                 {selectedStep.output.startsWith('data:image') ? (
                                                     <img src={selectedStep.output} className="w-full opacity-90 hover:opacity-100 transition-opacity" />
                                                 ) : (
                                                     <div className="p-3 text-[10px] font-mono text-neurix-300 leading-relaxed whitespace-pre-wrap break-words max-h-[300px] overflow-y-auto custom-scrollbar select-text">
                                                         {selectedStep.output.replace(/```/g, '')}
                                                     </div>
                                                 )}
                                             </div>
                                         </div>
                                     )}

                                     {selectedStep.citations && selectedStep.citations.length > 0 && (
                                         <div>
                                            <label className="text-[9px] font-mono text-neurix-600 uppercase tracking-widest block mb-2">Sources / Grounding</label>
                                            <div className="bg-white/[0.02] rounded p-2 border border-white/5 space-y-1">
                                                {selectedStep.citations.map((c, i) => (
                                                    <a key={i} href={c.uri} target="_blank" rel="noopener noreferrer" className="block text-[10px] text-neurix-400 hover:text-neurix-accent truncate flex items-center gap-2">
                                                        <span className="w-1 h-1 rounded-full bg-neurix-500"></span>
                                                        {c.title}
                                                    </a>
                                                ))}
                                            </div>
                                         </div>
                                     )}
                                     
                                     {selectedStep.reasoningTrace && (
                                         <div>
                                            <label className="text-[9px] font-mono text-neurix-600 uppercase tracking-widest block mb-2">Neural Trace</label>
                                            <div className="bg-white/[0.02] rounded p-3 text-[9px] text-neurix-500 font-mono border-l-2 border-neurix-accent/30 italic">
                                                {selectedStep.reasoningTrace}
                                            </div>
                                         </div>
                                     )}
                                 </div>
                            </div>
                         ) : (
                            <SystemMonitor metrics={metrics} agents={AGENTS} history={metricHistory} />
                         )}
                     </div>
                     <div className="flex-[2] min-h-0 bg-black/20 flex flex-col"><LogViewer logs={logs} /></div>
                 </div>
             </aside>
         </div>

         {/* MOBILE FLOATING DOCK */}
         <div className="lg:hidden absolute bottom-6 left-0 right-0 flex justify-center pointer-events-none z-40">
             <nav className="pointer-events-auto glass-panel rounded-2xl p-1.5 flex gap-1 shadow-2xl ring-1 ring-white/10">
                 <button 
                    onClick={() => setMobileTab('TIMELINE')}
                    className={`px-6 py-3 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all
                        ${mobileTab === 'TIMELINE' ? 'bg-white text-black shadow-lg scale-105' : 'text-neurix-400 hover:text-neurix-200'}
                    `}
                 >
                    Timeline
                 </button>
                 <button 
                    onClick={() => setMobileTab('GRAPH')}
                    className={`px-6 py-3 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all
                        ${mobileTab === 'GRAPH' ? 'bg-white text-black shadow-lg scale-105' : 'text-neurix-400 hover:text-neurix-200'}
                    `}
                 >
                    Graph
                 </button>
                 <button 
                    onClick={() => setMobileTab('SYSTEM')}
                    className={`px-6 py-3 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all
                        ${mobileTab === 'SYSTEM' ? 'bg-white text-black shadow-lg scale-105' : 'text-neurix-400 hover:text-neurix-200'}
                    `}
                 >
                    System
                 </button>
             </nav>
         </div>

      </div>
    </div>
  );
}
