import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AgentState, Workflow, WorkflowStep, StepStatus, LogEntry, TimelineEvent, TimelineEventType, AgentIdentity, ExecutionOverlay, ThoughtSignature, AgentMetrics, MetricHistoryPoint } from './types';
import { generateWorkflow, executeWorkflowStep, replanWorkflow, verifyOutput } from './services/gemini';
import WorkflowGraph from './components/WorkflowGraph';
import LogViewer from './components/LogViewer';
import TimelineViewer from './components/TimelineViewer';
import AgentStatusDisplay from './components/AgentStatus';
import PerformanceGraph from './components/PerformanceGraph';
import SystemMonitor from './components/SystemMonitor';
import OnboardingModal from './components/OnboardingModal';

// --- AGENT DEFINITIONS ---
const AGENTS: Record<string, AgentIdentity> = {
  ROUTER: { id: 'sys-router', role: 'ROUTER', name: 'ROUTER', version: '1.0', color: 'text-neurix-500', capabilities: [] },
  PLANNER: { id: 'nexus-arch', role: 'PLANNER', name: 'NEXUS', version: '2.4', color: 'text-neurix-accent', capabilities: ['PLANNING'] },
  VERIFIER: { id: 'axion-ov', role: 'VERIFIER', name: 'AXION', version: '3.1', color: 'text-neurix-warning', capabilities: ['VERIFICATION'] },
  HELIX: { id: 'helix-r', role: 'SPECIALIST', name: 'HELIX', version: '2.0', color: 'text-cyan-400', capabilities: ['RESEARCH', 'ANALYSIS'] },
  VORTEX: { id: 'vertex-c', role: 'SPECIALIST', name: 'VORTEX', version: '1.5', color: 'text-fuchsia-400', capabilities: ['CODE', 'CREATION'] },
  ECHO: { id: 'echo-g', role: 'SPECIALIST', name: 'ECHO', version: '2.2', color: 'text-yellow-400', capabilities: ['CREATION', 'DECISION'] },
  EXECUTOR: { id: 'ion-op', role: 'EXECUTOR', name: 'ION', version: '1.9', color: 'text-neurix-success', capabilities: ['ALL'] },
};

const SUGGESTIONS = [
    { label: "Code: Snake Game", text: "Write a complete Python script for a Snake game using the pygame library." },
    { label: "Research: Quantum Batteries", text: "Research the latest breakthroughs in solid-state batteries and summarize for a technical audience." },
    { label: "Analysis: EV Market", text: "Analyze current trends in the EV market and suggest a hypothetical product strategy." }
];

const CONFIDENCE_THRESHOLD = 0.8;
const createInitialMetrics = (): AgentMetrics => ({ stepsExecuted: 0, averageConfidence: 0, verificationPassRate: 0, tokenUsage: 0, _totalConfidence: 0, _thoughtCount: 0, _verificationAttempts: 0, _verificationSuccesses: 0 });

type MobileTab = 'TIMELINE' | 'GRAPH' | 'SYSTEM';

export default function App() {
  const [agentState, setAgentState] = useState<AgentState>(AgentState.INIT);
  const [goal, setGoal] = useState('');
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [executionOverlay, setExecutionOverlay] = useState<ExecutionOverlay>({});
  const [currentStepId, setCurrentStepId] = useState<string | null>(null);
  const [selectedStep, setSelectedStep] = useState<WorkflowStep | null>(null);
  const [metrics, setMetrics] = useState<Record<string, AgentMetrics>>(() => {
      const initial: Record<string, AgentMetrics> = {};
      Object.values(AGENTS).forEach(agent => { initial[agent.id] = createInitialMetrics(); });
      return initial;
  });
  const [metricHistory, setMetricHistory] = useState<MetricHistoryPoint[]>([]);
  
  // Multimodal & Control State
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [hasVisited, setHasVisited] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>('GRAPH'); // Mobile Navigation State

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Refs
  const stateRef = useRef(agentState);
  const workflowRef = useRef<Workflow | null>(null);
  const metricsRef = useRef(metrics);
  useEffect(() => { stateRef.current = agentState; }, [agentState]);
  useEffect(() => { workflowRef.current = workflow; }, [workflow]);
  useEffect(() => { metricsRef.current = metrics; }, [metrics]);

  const activeAgentId = currentStepId ? executionOverlay[currentStepId]?.assignedAgentId : null;

  // --- AUDIO FEEDBACK (JARVIS MODE) ---
  const speak = useCallback((text: string, priority: boolean = false) => {
      if (!('speechSynthesis' in window)) return;
      if (stateRef.current === AgentState.PAUSED && !priority) return;
      if (isMuted) return; // Mute Check

      // Don't spam
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
  }, [isMuted]); // Depend on Mute State

  // --- LOGIC HELPERS ---
  const addLog = useCallback((type: LogEntry['type'], message: string, metadata?: Record<string, any>) => {
    setLogs(prev => [...prev, { id: Math.random().toString(36).substr(2, 9), timestamp: Date.now(), type, message, metadata }]);
  }, []);

  // Boot Sequence
  const runBootSequence = useCallback(async () => {
    addLog('INFO', 'Initializing NEURIX Kernel v2.4...');
    await new Promise(r => setTimeout(r, 600));
    addLog('INFO', 'Loading Neural Modules...', { modules: ['NEXUS', 'AXION', 'HELIX', 'VORTEX'] });
    await new Promise(r => setTimeout(r, 800));
    addLog('INFO', 'Establishing Secure Handshake with Gemini-3...', { latency: '42ms' });
    await new Promise(r => setTimeout(r, 600));
    addLog('SUCCESS', 'System Online. Awaiting directive.');
    speak("System Online. Ready for directive.");
  }, [addLog, speak]);

  // --- DEMO GOD MODE: FORCE FAIL ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        // Shift + F to FORCE FAIL current step
        if (e.shiftKey && e.key === 'F' && stateRef.current === AgentState.EXECUTING) {
             const runningStep = workflowRef.current?.steps.find(s => s.status === StepStatus.RUNNING);
             if (runningStep) {
                 addLog('WARNING', 'MANUAL OVERRIDE: Simulating Critical Failure in ' + runningStep.label);
                 speak("Simulating critical failure.", true);
                 // Trigger failure logic manually
                 // We fake a verification failure
                 if (workflowRef.current) {
                    const failStep = runningStep;
                    // Update state to failed immediately to stop execution loop
                    setWorkflow(prev => prev ? ({ ...prev, steps: prev.steps.map(s => s.id === failStep.id ? { ...s, status: StepStatus.FAILED, error: "Simulated Anomaly" } : s) }) : null);
                    handleFailure(failStep, workflowRef.current.steps, "Manual Override: Simulated Failure", workflowRef.current.goal);
                 }
             }
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [speak]);

  const updateAgentMetrics = useCallback((agentId: string, updates: { confidence?: number, stepCompleted?: boolean, verificationResult?: boolean, tokens?: number }) => {
      setMetrics(prev => {
          const current = prev[agentId] || createInitialMetrics();
          const next = { ...current };
          if (updates.confidence !== undefined) {
              next._totalConfidence += updates.confidence;
              next._thoughtCount += 1;
              next.averageConfidence = next._totalConfidence / next._thoughtCount;
          }
          if (updates.stepCompleted) next.stepsExecuted += 1;
          if (updates.tokens) next.tokenUsage += updates.tokens;
          if (updates.verificationResult !== undefined) {
              next._verificationAttempts += 1;
              if (updates.verificationResult) next._verificationSuccesses += 1;
              next.verificationPassRate = next._verificationSuccesses / next._verificationAttempts;
          }
          
          setMetricHistory(h => {
              const newPoint = { timestamp: Date.now(), agentId, metrics: { ...next } };
              const newHistory = [...h, newPoint];
              if (newHistory.length > 100) {
                  return newHistory.slice(newHistory.length - 100);
              }
              return newHistory;
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
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        const base64Data = base64String.split(',')[1];
        setSelectedImage(base64Data);
        addLog('INFO', `Visual Context Loaded: ${file.name}`, { size: `${(file.size / 1024).toFixed(1)}KB` });
        speak("Visual context loaded.");
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerStepExecution = useCallback(async (step: WorkflowStep, contextWorkflow: Workflow) => {
      const candidates = Object.values(AGENTS).filter(a => ['PLANNER','VERIFIER','ROUTER'].indexOf(a.role) === -1);
      const assignedAgent = candidates.find(a => a.capabilities.includes(step.actionType)) || candidates[candidates.length - 1]; 

      setCurrentStepId(step.id);

      const executionThought: ThoughtSignature = { agentId: assignedAgent.id, thinkingLevel: 'L2_REASONING', strategy: 'Probabilistic', confidence: 0.88 };
      setExecutionOverlay(prev => ({ ...prev, [step.id]: { verified: false, requiresCheckpoint: false, assignedAgentId: assignedAgent.id, executionThoughts: [executionThought] } }));
      
      emitTimelineEvent('EXECUTION_START', assignedAgent, `Processing ${step.label}`, step.id, null, executionThought);
      addLog('INFO', `Starting Step: ${step.label}`, { agentName: assignedAgent.name, agentColor: assignedAgent.color });
      updateAgentMetrics(assignedAgent.id, { confidence: 0.88 });

      const tokenStreamer = setInterval(() => {
          const isBurst = Math.random() > 0.7;
          const tokens = isBurst ? Math.floor(Math.random() * 12) + 8 : Math.floor(Math.random() * 4) + 2;
          updateAgentMetrics(assignedAgent.id, { tokens });
      }, 200);

      try {
          const result = await executeWorkflowStep(step, contextWorkflow.steps, contextWorkflow.goal);
          
          clearInterval(tokenStreamer);
          updateAgentMetrics(assignedAgent.id, { stepCompleted: true, tokens: result.tokens }); 

          addLog('THOUGHT', result.reasoning, { agentName: assignedAgent.name, agentColor: assignedAgent.color });
          
          addLog('INFO', 'Requesting AXION Verification...', { agentName: AGENTS.VERIFIER.name, agentColor: AGENTS.VERIFIER.color });
          const verification = await verifyOutput(step, result.output, contextWorkflow.goal);
          updateAgentMetrics(AGENTS.VERIFIER.id, { verificationResult: verification.passed, tokens: verification.tokens });

          if (verification.passed) {
              setWorkflow(prev => prev ? ({ ...prev, steps: prev.steps.map(s => s.id === step.id ? { 
                  ...s, 
                  status: StepStatus.COMPLETED, 
                  output: result.output,
                  citations: result.citations 
              } : s) }) : null);

              emitTimelineEvent('VERIFICATION_PASS', AGENTS.VERIFIER, 'Output Verified: ' + verification.reason, step.id);
              addLog('SUCCESS', `Step completed: ${step.label}`, { agentName: assignedAgent.name, agentColor: assignedAgent.color });
          } else {
              setAgentState(AgentState.CHECKPOINT);
              emitTimelineEvent('VERIFICATION_FAIL', AGENTS.VERIFIER, 'Rejected: ' + verification.reason, step.id);
              addLog('WARNING', `Verification Failed: ${verification.reason}. Triggering self-correction protocol.`);
              speak("Anomaly detected. Initiating recovery protocol.", true);
              
              setWorkflow(prev => prev ? ({ ...prev, steps: prev.steps.map(s => s.id === step.id ? { ...s, status: StepStatus.FAILED, error: verification.reason } : s) }) : null);
              await handleFailure(step, contextWorkflow.steps, verification.reason, contextWorkflow.goal);
          }
      } catch (e) {
          clearInterval(tokenStreamer);
          setWorkflow(prev => prev ? ({ ...prev, steps: prev.steps.map(s => s.id === step.id ? { ...s, status: StepStatus.FAILED, error: String(e) } : s) }) : null);
          await handleFailure(step, contextWorkflow.steps, String(e), contextWorkflow.goal);
      }
  }, [emitTimelineEvent, updateAgentMetrics, addLog, speak]);

  const executeDispatcher = useCallback(() => {
    if (stateRef.current !== AgentState.EXECUTING) return;
    const currentWorkflow = workflowRef.current;
    if (!currentWorkflow) return;

    const executableSteps = currentWorkflow.steps.filter(step => 
        step.status === StepStatus.PENDING && 
        (step.dependencies.length === 0 || step.dependencies.every(depId => currentWorkflow.steps.find(s => s.id === depId)?.status === StepStatus.COMPLETED))
    );
    
    if (executableSteps.length === 0) {
        const hasRunning = currentWorkflow.steps.some(s => s.status === StepStatus.RUNNING);
        const hasPending = currentWorkflow.steps.some(s => s.status === StepStatus.PENDING);
        
        if (!hasRunning && !hasPending) {
            setAgentState(AgentState.COMPLETED);
            addLog('SUCCESS', 'All objectives met. Mission Complete.');
            speak("Mission accomplished. All objectives verified.");
        }
        return;
    }

    setWorkflow(prev => prev ? ({
        ...prev,
        steps: prev.steps.map(s => executableSteps.some(e => e.id === s.id) ? { ...s, status: StepStatus.RUNNING } : s)
    }) : null);

    if (executableSteps.length > 1) {
        addLog('INFO', `Parallel Dispatcher: Spawning ${executableSteps.length} autonomous agents.`);
    }

    executableSteps.forEach(step => triggerStepExecution(step, currentWorkflow));

  }, [triggerStepExecution, addLog, speak]);

  const handleGeneratePlan = async (customGoal?: string) => {
    const targetGoal = customGoal || goal;
    if (!targetGoal.trim()) return;
    
    if (customGoal) setGoal(customGoal); // Sync state

    setAgentState(AgentState.PLANNING);
    speak("Analyzing request.");
    emitTimelineEvent('PHASE_CHANGE', AGENTS.PLANNER, 'Initializing Planning Phase');
    addLog('INFO', `Directive received: "${targetGoal}"`);
    if (selectedImage) {
        addLog('INFO', 'Processing Visual Input matrix...');
    }
    addLog('THOUGHT', 'NEXUS Agent formulating execution strategy...', { agentName: AGENTS.PLANNER.name, agentColor: AGENTS.PLANNER.color });

    try {
      const { steps, tokens } = await generateWorkflow(targetGoal, selectedImage);
      setWorkflow({ version: 'v1', goal: targetGoal, steps });
      
      updateAgentMetrics(AGENTS.PLANNER.id, { tokens, stepCompleted: true, confidence: 0.95 });
      
      setAgentState(AgentState.REVIEW_PLAN);
      emitTimelineEvent('AGENT_HANDOFF', AGENTS.PLANNER, 'Workflow Generated. Awaiting Approval.');
      addLog('SUCCESS', 'Workflow generated successfully.', { tokensUsed: tokens, stepCount: steps.length });
      speak("Workflow generated. Awaiting approval.");
    } catch (error) {
      setAgentState(AgentState.FAILED);
      addLog('ERROR', String(error));
      speak("Error generating workflow.");
    }
  };

  const handleApprovePlan = () => {
    if (workflow) {
      setAgentState(AgentState.EXECUTING);
      emitTimelineEvent('PHASE_CHANGE', AGENTS.ROUTER, 'Execution Sequence Initiated.');
      addLog('INFO', 'User authorized execution. Transferring control to Router.');
      speak("Authorization confirmed. Executing.");
    }
  };

  const handleFailure = async (failedStep: WorkflowStep, allSteps: WorkflowStep[], error: string, goal: string) => {
      addLog('ERROR', `Failure detected in ${failedStep.label}. Initiating replan...`, { agentName: 'ROUTER', agentColor: AGENTS.ROUTER.color });
      
      try {
          // 1. Mark downstream steps as FAILED (Cascade) to visually kill the dead branch
          const killList = new Set<string>();
          const findDownstream = (id: string) => {
              allSteps.forEach(s => {
                  if (s.dependencies.includes(id)) {
                      killList.add(s.id);
                      findDownstream(s.id); // Recurse
                  }
              });
          };
          findDownstream(failedStep.id);
          
          setWorkflow(prev => prev ? ({
              ...prev,
              steps: prev.steps.map(s => killList.has(s.id) ? { ...s, status: StepStatus.FAILED, error: "Cascade Failure: Path Abandoned" } : s)
          }) : null);

          // 2. Generate new path
          const { steps: newSteps, tokens } = await replanWorkflow(failedStep, allSteps, error, goal);
          updateAgentMetrics(AGENTS.PLANNER.id, { tokens, confidence: 0.8 });
          
          const lastCompletedStep = allSteps.filter(s => s.status === StepStatus.COMPLETED).pop();
          const timestamp = Date.now();

          const remappedSteps = newSteps.map((s, index) => {
              const newId = `replan-${timestamp}-${s.id}`;
              const newDeps = s.dependencies.reduce((acc, d) => {
                  const internalDep = newSteps.find(ns => ns.id === d);
                  if (internalDep) acc.push(`replan-${timestamp}-${d}`);
                  return acc;
              }, [] as string[]);

              if (index === 0 && lastCompletedStep && newDeps.length === 0) {
                  newDeps.push(lastCompletedStep.id);
              }
              
              return { ...s, id: newId, dependencies: newDeps, status: StepStatus.PENDING };
          });

          setWorkflow(prev => prev ? ({ ...prev, steps: [...prev.steps, ...remappedSteps] }) : null);
          emitTimelineEvent('PHASE_CHANGE', AGENTS.PLANNER, 'Timeline Diverged. New Path Created.');
          addLog('SUCCESS', 'Recovery path generated. Resuming execution.');
          speak("Rerouting complete. Resuming.");
          
          setAgentState(AgentState.EXECUTING);
      } catch (e) {
          addLog('ERROR', "Critical Planner Failure during Recovery.");
          setAgentState(AgentState.FAILED);
      }
  };

  useEffect(() => { 
      if (agentState === AgentState.EXECUTING) {
          const interval = setInterval(executeDispatcher, 1000); 
          executeDispatcher();
          return () => clearInterval(interval);
      }
  }, [agentState, executeDispatcher]);

  // --- CONTROLS TOGGLE ---
  const toggleMute = () => {
      setIsMuted(!isMuted);
      window.speechSynthesis.cancel();
  };

  const togglePause = () => {
      if (agentState === AgentState.EXECUTING) {
          setAgentState(AgentState.PAUSED);
          addLog('WARNING', 'Execution Paused by Operator.');
      } else if (agentState === AgentState.PAUSED) {
          setAgentState(AgentState.EXECUTING);
          addLog('INFO', 'Execution Resumed.');
      }
  };

  const resetSystem = () => {
      setWorkflow(null);
      setLogs([]);
      setTimeline([]);
      setAgentState(AgentState.INIT);
      setGoal('');
      setSelectedImage(null);
      addLog('INFO', 'System Reset. Memory cleared.');
  };

  // --- RENDER HELPERS ---
  const renderOutput = (text: string) => {
      // Split by code blocks
      const parts = text.split(/(```[\s\S]*?```)/g);
      return parts.map((part, i) => {
         if (part.startsWith('```')) {
             // Extract language and code
             const match = part.match(/```(\w*)\n?([\s\S]*?)```/);
             const lang = match ? match[1] : '';
             const code = match ? match[2] : part.slice(3, -3);
             return (
                 <div key={i} className="my-3 rounded-lg bg-black/50 border border-white/10 overflow-hidden shadow-lg">
                     <div className="px-3 py-1.5 bg-white/5 border-b border-white/5 flex justify-between items-center">
                         <span className="text-[9px] font-mono text-neurix-400 uppercase font-bold">{lang || 'CODE'}</span>
                         <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(code);
                            }}
                            className="text-[9px] text-neurix-500 hover:text-white transition-colors"
                         >
                            COPY
                         </button>
                     </div>
                     <pre className="p-3 text-[10px] font-mono text-neurix-100 overflow-x-auto custom-scrollbar leading-relaxed">
                        <code>{code}</code>
                     </pre>
                 </div>
             )
         }
         return <div key={i} className="whitespace-pre-wrap">{part}</div>
      });
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-neurix-950 text-neurix-300 font-sans selection:bg-neurix-accent/30">
      
      {/* Onboarding Modal */}
      {!hasVisited && (
          <OnboardingModal 
            agents={AGENTS} 
            onStart={() => {
                setHasVisited(true);
                runBootSequence();
            }} 
          />
      )}

      {/* LAYER 0: Background Graph */}
      <div className="absolute inset-0 z-0">
         <WorkflowGraph 
            steps={workflow?.steps || []} 
            currentStepId={currentStepId}
            onStepClick={(step) => {
                setSelectedStep(step);
                setMobileTab('SYSTEM'); // Auto-switch to inspector on mobile when clicked
            }}
            executionOverlay={executionOverlay}
            agents={AGENTS}
         />
      </div>

      {/* LAYER 1: Vignette */}
      <div className="absolute inset-0 z-10 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_20%,#050505_120%)] opacity-60" />

      {/* LAYER 2: HUD Grid */}
      <div className="absolute inset-0 z-20 p-4 lg:p-6 pointer-events-none flex flex-col lg:grid lg:grid-cols-[340px_1fr_400px] lg:grid-rows-[auto_1fr] gap-4 lg:gap-6">
         
         {/* HEADER */}
         <header className="lg:col-span-3 flex flex-col md:flex-row justify-between items-stretch md:items-start gap-3 pointer-events-auto">
             <div className="glass-panel px-4 py-3 rounded-2xl flex items-center justify-between md:justify-start gap-4 shrink-0">
                 <div className="flex items-center gap-3">
                     <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                         <div className="w-2 h-2 bg-neurix-accent rounded-full animate-pulse shadow-glow" />
                     </div>
                     <div>
                         <h1 className="text-sm font-bold tracking-tight text-white leading-none">NEURIX <span className="text-neurix-500 font-normal">OS</span></h1>
                         <span className="text-[9px] font-mono text-neurix-500 tracking-wide">V2.4.0 <span className="text-neurix-success">• ONLINE</span></span>
                     </div>
                 </div>
                 
                 {/* CONTROLS */}
                 <div className="flex gap-2">
                     <button onClick={toggleMute} className={`p-2 rounded-lg border transition-all ${isMuted ? 'bg-neurix-danger/10 border-neurix-danger/30 text-neurix-danger' : 'bg-white/5 border-white/10 text-neurix-400 hover:text-white'}`}>
                         {isMuted ? (
                             <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>
                         ) : (
                             <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                         )}
                     </button>
                     {(agentState === AgentState.EXECUTING || agentState === AgentState.PAUSED) && (
                         <button onClick={togglePause} className={`p-2 rounded-lg border transition-all ${agentState === AgentState.PAUSED ? 'bg-neurix-warning/10 border-neurix-warning/30 text-neurix-warning' : 'bg-white/5 border-white/10 text-neurix-400 hover:text-white'}`}>
                             {agentState === AgentState.PAUSED ? (
                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                             ) : (
                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" /></svg>
                             )}
                         </button>
                     )}
                     {(agentState === AgentState.COMPLETED || agentState === AgentState.FAILED) && (
                         <button onClick={resetSystem} className="p-2 rounded-lg border bg-white/5 border-white/10 text-neurix-400 hover:text-white hover:bg-neurix-danger/20 hover:border-neurix-danger/50 hover:text-neurix-danger transition-all">
                             <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                         </button>
                     )}
                 </div>
             </div>
             
             <div className="glass-panel px-4 md:px-6 py-2.5 rounded-2xl flex items-center gap-4 md:gap-8 justify-between md:justify-start">
                 <div className="hidden md:block">
                     <PerformanceGraph history={metricHistory} agents={AGENTS} activeAgentId={activeAgentId} />
                 </div>
                 <div className="hidden md:block w-[1px] h-6 bg-white/10" />
                 <AgentStatusDisplay state={agentState} />
             </div>
         </header>

         {/* LEFT COLUMN: Timeline */}
         <aside className={`
            row-start-2 flex-col min-h-0 pointer-events-auto
            ${mobileTab === 'TIMELINE' ? 'flex flex-1' : 'hidden lg:flex'}
         `}>
             <div className="glass-panel flex-1 rounded-3xl overflow-hidden flex flex-col">
                 <TimelineViewer events={timeline} agents={AGENTS} />
             </div>
         </aside>

         {/* CENTER COLUMN: Interaction Zone */}
         <main className={`
            row-start-2 relative flex-col items-center justify-center
            ${mobileTab === 'GRAPH' ? 'flex flex-1' : 'hidden lg:flex pointer-events-none'}
         `}>
             
             {/* Spotlight Input */}
             {(agentState === AgentState.INIT || agentState === AgentState.COMPLETED || agentState === AgentState.FAILED) && (
                 <div className="w-full max-w-2xl pointer-events-auto animate-pop-in relative flex flex-col gap-4 mt-auto lg:mt-0 mb-4 lg:mb-0">
                     {selectedImage && (
                        <div className="absolute -top-16 left-0 bg-neurix-900 border border-white/10 p-1 rounded-lg shadow-xl animate-fade-in flex items-center gap-2">
                             <img src={`data:image/png;base64,${selectedImage}`} className="h-12 w-12 object-cover rounded" alt="Context" />
                             <div className="pr-3">
                                 <div className="text-[10px] text-neurix-400 font-bold uppercase">Image Context</div>
                                 <button onClick={() => setSelectedImage(null)} className="text-[10px] text-neurix-danger hover:underline">Remove</button>
                             </div>
                        </div>
                     )}

                     <div className="glass-panel rounded-2xl p-2 pl-4 flex items-center gap-2 shadow-2xl ring-1 ring-white/10 transition-transform focus-within:scale-[1.02]">
                         <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="p-2 rounded-lg hover:bg-white/10 text-neurix-500 hover:text-white transition-colors"
                            title="Add Image Context"
                         >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                         </button>
                         <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleImageUpload} 
                            className="hidden" 
                            accept="image/*"
                         />

                         <div className="w-[1px] h-6 bg-white/10 mx-2" />

                         <input 
                            className="flex-1 bg-transparent border-none outline-none text-base md:text-xl text-white placeholder-neurix-500 font-medium h-12 md:h-14"
                            placeholder={selectedImage ? "What to do with image?" : "Enter mission objective..."}
                            value={goal}
                            onChange={(e) => setGoal(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleGeneratePlan()}
                            autoFocus
                         />
                         <button 
                            onClick={() => handleGeneratePlan()}
                            disabled={!goal.trim()}
                            className="h-10 px-6 rounded-xl bg-neurix-100 text-black font-semibold text-xs tracking-wide hover:bg-white transition-colors disabled:opacity-50"
                         >
                            RUN
                         </button>
                     </div>

                     {/* Suggestions */}
                     <div className="flex gap-2 md:gap-3 justify-center overflow-x-auto pb-1 no-scrollbar mask-gradient">
                        {SUGGESTIONS.map((s, i) => (
                            <button 
                                key={i}
                                onClick={() => handleGeneratePlan(s.text)}
                                className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/20 text-[10px] text-neurix-400 hover:text-white transition-all text-left group min-w-[140px] max-w-[200px] shrink-0"
                            >
                                <div className="font-bold text-neurix-accent group-hover:text-neurix-300 transition-colors mb-0.5">{s.label}</div>
                            </button>
                        ))}
                     </div>

                     <div className="mt-2 hidden md:flex justify-center gap-4 text-[10px] font-mono text-neurix-500/60 uppercase tracking-widest">
                         <span>⌘K Commands</span>
                         <span>System Idle</span>
                         <span>Gemini-3 Flash</span>
                     </div>
                 </div>
             )}

             {/* Review Controls */}
             {agentState === AgentState.REVIEW_PLAN && (
                 <div className="absolute bottom-4 md:bottom-12 pointer-events-auto animate-pop-in w-full flex justify-center px-4">
                     <div className="glass-panel px-6 py-4 rounded-full flex flex-col md:flex-row gap-4 md:gap-6 items-center shadow-2xl">
                         <span className="text-xs text-white font-medium tracking-wide whitespace-nowrap">Plan Generated.</span>
                         <div className="h-px w-full md:w-px md:h-4 bg-white/10" />
                         <div className="flex gap-3">
                            <button onClick={handleApprovePlan} className="px-6 py-2 bg-neurix-success text-black text-xs font-bold rounded-full hover:bg-green-400 transition-colors shadow-lg shadow-green-500/20">
                                AUTHORIZE
                            </button>
                            <button onClick={() => setAgentState(AgentState.INIT)} className="px-4 py-2 text-neurix-400 text-xs font-bold hover:text-white transition-colors">
                                DISCARD
                            </button>
                         </div>
                     </div>
                 </div>
             )}
         </main>

         {/* RIGHT COLUMN: Inspector + Logs */}
         <aside className={`
            row-start-2 flex-col min-h-0 pointer-events-auto gap-4
            ${mobileTab === 'SYSTEM' ? 'flex flex-1' : 'hidden lg:flex'}
         `}>
             {/* Unified Inspector Panel */}
             <div className="glass-panel flex-1 rounded-3xl overflow-hidden flex flex-col">
                 
                 {/* Top Half: Step Details OR System Monitor */}
                 <div className="flex-[3] min-h-0 border-b border-white/5 flex flex-col relative bg-neurix-900/20">
                     {selectedStep ? (
                        <div className="flex flex-col h-full animate-fade-in">
                            <div className="p-5 border-b border-white/5 bg-white/[0.02] backdrop-blur-md sticky top-0 z-10 flex justify-between items-start">
                                 <div className="flex-1">
                                     <div className="flex items-center justify-between mb-3">
                                         <div className="px-2 py-0.5 rounded border border-neurix-accent/20 bg-neurix-accent/10 text-[9px] font-bold text-neurix-accent uppercase tracking-widest">
                                             {selectedStep.actionType}
                                         </div>
                                         <div className={`w-1.5 h-1.5 rounded-full ${selectedStep.status === StepStatus.RUNNING ? 'bg-neurix-success animate-pulse' : 'bg-neurix-500'}`} />
                                     </div>
                                     <h2 className="text-base font-bold leading-snug text-white line-clamp-2">{selectedStep.label}</h2>
                                 </div>
                                 <button onClick={() => setSelectedStep(null)} className="ml-4 p-1 hover:bg-white/10 rounded">
                                     <svg className="w-4 h-4 text-neurix-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                 </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">
                                 <div>
                                     <label className="text-[9px] font-mono text-neurix-500 uppercase tracking-widest mb-1.5 block">Directive</label>
                                     <p className="text-xs text-neurix-300 leading-relaxed opacity-90">{selectedStep.description}</p>
                                 </div>
                                 
                                 {selectedStep.output && (
                                     <div className="p-3 rounded-lg bg-white/5 border border-white/5 text-xs font-mono text-neurix-100 overflow-hidden">
                                         <span className="text-neurix-success block mb-2 text-[9px] uppercase tracking-wider">Output</span>
                                         {selectedStep.output.startsWith('data:image') ? (
                                             <div className="relative group">
                                                 <img src={selectedStep.output} className="w-full rounded border border-white/10" alt="Generated Asset" />
                                                 <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                     <a href={selectedStep.output} download={`neurix-asset-${selectedStep.id}.png`} className="px-3 py-1 bg-white text-black text-[10px] font-bold rounded hover:bg-neurix-300">
                                                         DOWNLOAD
                                                     </a>
                                                 </div>
                                             </div>
                                         ) : (
                                             // RICH CODE RENDERING
                                             renderOutput(selectedStep.output)
                                         )}
                                     </div>
                                 )}

                                 {/* CITATIONS DISPLAY (GROUNDING) */}
                                 {selectedStep.citations && selectedStep.citations.length > 0 && (
                                     <div className="mt-2">
                                         <label className="text-[9px] font-mono text-neurix-500 uppercase tracking-widest mb-2 block">Sources</label>
                                         <div className="flex flex-wrap gap-2">
                                             {selectedStep.citations.map((c, i) => (
                                                 <a key={i} href={c.uri} target="_blank" rel="noopener noreferrer" 
                                                    className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/5 text-[10px] text-neurix-400 truncate max-w-[200px] block transition-colors">
                                                     {c.title || new URL(c.uri).hostname}
                                                 </a>
                                             ))}
                                         </div>
                                     </div>
                                 )}

                                 {(executionOverlay[selectedStep.id]?.executionThoughts.length > 0 || logs.find(l => l.type === 'THOUGHT' && l.message.includes(selectedStep.actionType))) && (
                                     <div>
                                         <label className="text-[9px] font-mono text-neurix-500 uppercase tracking-widest mb-2 block">Reasoning Trace</label>
                                         <div className="space-y-1.5">
                                             {logs.filter(l => l.type === 'THOUGHT' && l.message.includes('[NEURIX')).slice(-1).map(l => (
                                                 <div key={l.id} className="p-2 rounded bg-white/5 text-[10px] text-neurix-400 font-mono whitespace-pre-wrap">
                                                     {l.message}
                                                 </div>
                                             ))}
                                             
                                             {executionOverlay[selectedStep.id].executionThoughts.map((t, i) => (
                                                 <div key={i} className="flex items-center gap-2 text-[10px] text-neurix-400">
                                                     <div className="h-px w-2 bg-neurix-500/30" />
                                                     <span className="italic">{t.strategy}</span>
                                                     <span className="ml-auto font-mono text-neurix-500">{(t.confidence * 100).toFixed(0)}%</span>
                                                 </div>
                                             ))}
                                         </div>
                                     </div>
                                 )}
                            </div>
                        </div>
                     ) : (
                        <SystemMonitor metrics={metrics} agents={AGENTS} history={metricHistory} />
                     )}
                 </div>

                 {/* Bottom Half: Logs */}
                 <div className="flex-[2] min-h-0 bg-black/20 flex flex-col">
                     <LogViewer logs={logs} />
                 </div>
             </div>
         </aside>

         {/* MOBILE NAVIGATION */}
         <nav className="lg:hidden pointer-events-auto shrink-0 glass-panel rounded-xl p-1.5 flex justify-around">
             <button 
                onClick={() => setMobileTab('TIMELINE')}
                className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all
                    ${mobileTab === 'TIMELINE' ? 'bg-white/10 text-white shadow-sm' : 'text-neurix-500 hover:text-neurix-300'}
                `}
             >
                Timeline
             </button>
             <button 
                onClick={() => setMobileTab('GRAPH')}
                className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all
                    ${mobileTab === 'GRAPH' ? 'bg-white/10 text-white shadow-sm' : 'text-neurix-500 hover:text-neurix-300'}
                `}
             >
                Graph
             </button>
             <button 
                onClick={() => setMobileTab('SYSTEM')}
                className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all
                    ${mobileTab === 'SYSTEM' ? 'bg-white/10 text-white shadow-sm' : 'text-neurix-500 hover:text-neurix-300'}
                `}
             >
                System
             </button>
         </nav>

      </div>
    </div>
  );
}