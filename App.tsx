
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AgentState, Workflow, WorkflowStep, StepStatus, LogEntry, TimelineEvent, TimelineEventType, AgentIdentity, ExecutionOverlay, ThoughtSignature, AgentMetrics, MetricHistoryPoint, Artifact } from './types';
import { generateWorkflow, executeWorkflowStep, replanWorkflow, verifyOutput, runMaintenanceScan, getModelForAction, generateRemediationPlan, runProjectQAReview } from './services/gemini';
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
    { label: "Code: Snake Game", text: "Write a complete Python script for a Snake game using the pygame library." },
    { label: "Research: Quantum", text: "Research the latest breakthroughs in solid-state batteries." },
];

const createInitialMetrics = (): AgentMetrics => ({ stepsExecuted: 0, averageConfidence: 0, verificationPassRate: 0, tokenUsage: 0, _totalConfidence: 0, _thoughtCount: 0, _verificationAttempts: 0, _verificationSuccesses: 0 });

type MobileTab = 'TIMELINE' | 'GRAPH' | 'SYSTEM';
type RightPanelTab = 'SYSTEM' | 'ARTIFACTS'; 
type SfxType = 'BOOT' | 'CLICK' | 'HOVER' | 'PROCESS' | 'SUCCESS' | 'ERROR' | 'ALERT';

export default function App() {
  const [goal, setGoal] = useState(() => localStorage.getItem('neurix_last_goal') || '');
  const [agentState, setAgentState] = useState<AgentState>(AgentState.INIT);
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false); // NEW: Demo Mode State

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
  const artifactsRef = useRef(artifacts);

  useEffect(() => { stateRef.current = agentState; }, [agentState]);
  useEffect(() => { workflowRef.current = workflow; }, [workflow]);
  useEffect(() => { metricsRef.current = metrics; }, [metrics]);
  useEffect(() => { executionOverlayRef.current = executionOverlay; }, [executionOverlay]);
  useEffect(() => { artifactsRef.current = artifacts; }, [artifacts]);
  useEffect(() => { localStorage.setItem('neurix_last_goal', goal); }, [goal]);

  const initAudio = useCallback(() => {
    if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioContextRef.current.state === 'suspended') audioContextRef.current.resume();
  }, []);

  const playSfx = useCallback((type: SfxType) => {
    if (isMuted || !audioContextRef.current) return;
    const ctx = audioContextRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    
    // Simple synthesized beeps
    osc.frequency.setValueAtTime(type === 'ERROR' ? 150 : type === 'SUCCESS' ? 800 : 400, now);
    if (type === 'BOOT') { osc.frequency.exponentialRampToValueAtTime(600, now + 0.4); }
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc.start(now);
    osc.stop(now + 0.3);
  }, [isMuted]);

  const activeAgentIds = React.useMemo(() => {
      if (!workflow) return [];
      const runningSteps = workflow.steps.filter(s => s.status === StepStatus.RUNNING);
      const ids = runningSteps.map(s => executionOverlay[s.id]?.assignedAgentId).filter(Boolean) as string[];
      return Array.from(new Set(ids));
  }, [workflow, executionOverlay]);

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
              title: `${step.label.replace(/\s+/g, '_')}.${language === 'python' ? 'py' : 'txt'}`,
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
          setRightPanelTab('ARTIFACTS');
          addLog('SUCCESS', `Generated ${newArtifacts.length} new artifacts.`);
      }
  }, [addLog]); 

  const runBootSequence = useCallback(async () => {
    initAudio();
    playSfx('BOOT');
    addLog('INFO', 'Initializing NEURIX Kernel v2.4...');
    await new Promise(r => setTimeout(r, 600));
    addLog('SUCCESS', 'System Online.');
  }, [addLog, playSfx, initAudio]);

  const updateAgentMetrics = useCallback((agentId: string, updates: any) => {
      setMetrics(prev => {
          const current = prev[agentId] || createInitialMetrics();
          const next = { ...current, ...updates }; // Simplified update logic
          if (updates.tokens) next.tokenUsage = (current.tokenUsage || 0) + updates.tokens;
          setMetricHistory(h => {
              const newPoint = { timestamp: Date.now(), agentId, metrics: { ...next } };
              return [...h, newPoint].slice(-50);
          });
          return { ...prev, [agentId]: next };
      });
  }, []);

  const emitTimelineEvent = useCallback((type: TimelineEventType, agent: AgentIdentity, message: string, stepId?: string, payload?: any, customThought?: ThoughtSignature) => {
    const event: TimelineEvent = { id: Math.random().toString(36).substr(2, 9), timestamp: Date.now(), type, agentId: agent.id, stepId, message, thought: customThought, payload };
    setTimeline(prev => [...prev, event]);
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Data = (reader.result as string).split(',')[1];
        setSelectedImage(base64Data);
        addLog('INFO', `Visual Context Loaded: ${file.name}`);
      };
      reader.readAsDataURL(file);
    }
  };

  const selectAgentForTask = (step: WorkflowStep): AgentIdentity => {
      if (step.assignedAgentId) return Object.values(AGENTS).find(a => a.id === step.assignedAgentId)!;
      return Object.values(AGENTS).find(a => a.capabilities.includes(step.actionType)) || AGENTS.EXECUTOR;
  };

  const triggerStepExecution = useCallback(async (step: WorkflowStep, contextWorkflow: Workflow, assignedAgent: AgentIdentity) => {
      setCurrentStepId(step.id);
      playSfx('PROCESS');
      const activeModel = getModelForAction(step.actionType);

      if (step.actionType === 'INTEGRATION' && !step.approvalRequired) {
          setAgentState(AgentState.AWAITING_INPUT);
          setPendingApprovalStep({ step, agent: assignedAgent });
          addLog('WARNING', `Critical Action Paused: ${step.label}`);
          return; 
      }

      setExecutionOverlay(prev => ({ ...prev, [step.id]: { verified: false, requiresCheckpoint: false, assignedAgentId: assignedAgent.id, executionThoughts: [], activeModel } }));
      emitTimelineEvent('EXECUTION_START', assignedAgent, `Processing ${step.label}`, step.id);
      addLog('INFO', `Starting: ${step.label}`, { agent: assignedAgent.name });

      try {
          const result = await executeWorkflowStep(step, contextWorkflow.steps, contextWorkflow.goal, selectedImage);
          
          updateAgentMetrics(assignedAgent.id, { stepCompleted: true, tokens: result.tokens });
          const verification = await verifyOutput(step, result.output, contextWorkflow.goal);
          
          if (verification.passed) {
              setWorkflow(prev => prev ? ({ ...prev, steps: prev.steps.map(s => s.id === step.id ? { ...s, status: StepStatus.COMPLETED, output: result.output } : s) }) : null);
              extractArtifacts(step, result.output);
              playSfx('SUCCESS');
              addLog('SUCCESS', `Completed: ${step.label}`);
          } else {
              setWorkflow(prev => prev ? ({ ...prev, steps: prev.steps.map(s => s.id === step.id ? { ...s, status: StepStatus.FAILED, error: verification.reason } : s) }) : null);
              await handleFailure(step, contextWorkflow.steps, verification.reason, contextWorkflow.goal);
          }
      } catch (e: any) {
          playSfx('ERROR');
          setWorkflow(prev => prev ? ({ ...prev, steps: prev.steps.map(s => s.id === step.id ? { ...s, status: StepStatus.FAILED, error: "Exec Failed" } : s) }) : null);
          await handleFailure(step, contextWorkflow.steps, String(e), contextWorkflow.goal);
      }
  }, [emitTimelineEvent, updateAgentMetrics, addLog, extractArtifacts, playSfx, selectedImage]); 

  const handleApproval = (approved: boolean) => {
      if (!pendingApprovalStep) return;
      if (approved) {
          setAgentState(AgentState.EXECUTING);
          triggerStepExecution({ ...pendingApprovalStep.step, approvalRequired: true }, workflow!, pendingApprovalStep.agent);
      } else {
          setWorkflow(prev => prev ? ({ ...prev, steps: prev.steps.map(s => s.id === pendingApprovalStep.step.id ? { ...s, status: StepStatus.FAILED } : s) }) : null);
          setAgentState(AgentState.EXECUTING);
      }
      setPendingApprovalStep(null);
  };

  const executeDispatcher = useCallback(() => {
    if (stateRef.current !== AgentState.EXECUTING) return;
    const currentWorkflow = workflowRef.current;
    if (!currentWorkflow) return;
    
    const executableSteps = currentWorkflow.steps.filter(step => 
        step.status === StepStatus.PENDING && 
        (step.dependencies.length === 0 || step.dependencies.every(depId => currentWorkflow.steps.find(s => s.id === depId)?.status === StepStatus.COMPLETED))
    );
    
    if (executableSteps.length === 0) {
        if (!currentWorkflow.steps.some(s => s.status === StepStatus.RUNNING || s.status === StepStatus.PENDING) && stateRef.current !== AgentState.QA_PHASE) {
            setAgentState(AgentState.QA_PHASE);
            addLog('INFO', 'Execution Complete. Starting QA.');
        }
        return;
    }
    
    setWorkflow(prev => prev ? ({ ...prev, steps: prev.steps.map(s => executableSteps.some(e => e.id === s.id) ? { ...s, status: StepStatus.RUNNING } : s) }) : null);
    executableSteps.forEach(step => triggerStepExecution(step, currentWorkflow, selectAgentForTask(step)));
  }, [triggerStepExecution, addLog]);

  const handleFailure = async (failedStep: WorkflowStep, allSteps: WorkflowStep[], error: string, goal: string) => {
      addLog('ERROR', `Failure in ${failedStep.label}. Replanning...`);
      try {
          const { steps: newSteps } = await replanWorkflow(failedStep, allSteps, error, goal);
          setWorkflow(prev => prev ? ({ ...prev, steps: [...prev.steps, ...newSteps] }) : null);
          setAgentState(AgentState.EXECUTING);
      } catch {
          setAgentState(AgentState.FAILED);
      }
  };

  useEffect(() => { if (agentState === AgentState.EXECUTING) { const interval = setInterval(executeDispatcher, 1000); return () => clearInterval(interval); } }, [agentState, executeDispatcher]);

  const handleGeneratePlan = async (customGoal?: string) => {
    initAudio(); 
    const targetGoal = customGoal || goal;
    if (!targetGoal.trim()) return;
    if (customGoal) setGoal(customGoal);
    setAgentState(AgentState.PLANNING);
    addLog('INFO', `Directive: "${targetGoal}"`);
    
    try {
      const { steps, tokens, isDemo } = await generateWorkflow(targetGoal, selectedImage);
      setIsDemoMode(isDemo); // Correctly set demo state based on result
      
      setWorkflow({ version: 'v1', goal: targetGoal, steps });
      setAgentState(AgentState.REVIEW_PLAN);
      playSfx('SUCCESS');
      addLog(isDemo ? 'WARNING' : 'SUCCESS', isDemo ? 'Workflow generated (Demo Mode).' : 'Workflow generated.');
    } catch (error) {
      setAgentState(AgentState.FAILED);
      addLog('ERROR', 'System Failure.');
    }
  };

  const handleApprovePlan = () => {
    setAgentState(AgentState.EXECUTING);
    addLog('INFO', 'Execution Initiated.');
  };

  // Live Injection
  const handleLiveWorkflowUpdate = (newWorkflow: Workflow) => {
      setWorkflow(newWorkflow);
      setIsEditingPlan(false);
      addLog('SUCCESS', 'Graph Updated.');
  };

  // QA Logic
  useEffect(() => {
     if (agentState !== AgentState.QA_PHASE) return;
     const performQA = async () => {
         if (!workflowRef.current) return;
         const qaResult = await runProjectQAReview(workflowRef.current, artifactsRef.current);
         if (qaResult.approved) {
             addLog('SUCCESS', `QA Passed (Score: ${qaResult.score}).`);
             setAgentState(AgentState.MAINTENANCE);
         } else {
             addLog('WARNING', `QA Failed. Fixing...`);
             const { steps } = await generateRemediationPlan(workflowRef.current.goal, "QA Fix", workflowRef.current.steps);
             setWorkflow(prev => prev ? ({ ...prev, steps: [...prev.steps, ...steps] }) : null);
             setAgentState(AgentState.EXECUTING);
         }
     };
     performQA();
  }, [agentState]);

  // Maintenance
  useEffect(() => {
    if (agentState !== AgentState.MAINTENANCE) return;
    const interval = setInterval(async () => {
        if (!workflowRef.current) return;
        const scan = await runMaintenanceScan(workflowRef.current);
        if (scan.status === 'DEGRADED') {
             // Auto fix logic here if needed
        }
    }, 15000);
    return () => clearInterval(interval);
  }, [agentState]);

  return (
    <div className="relative w-screen h-[100dvh] overflow-hidden font-sans selection:bg-neurix-accent/30 text-neurix-300">
      {!hasVisited && <OnboardingModal agents={AGENTS} onStart={() => { setHasVisited(true); runBootSequence(); }} />}
      {isEditingPlan && workflow && <WorkflowEditor workflow={workflow} agents={AGENTS} onSave={handleLiveWorkflowUpdate} onCancel={() => setIsEditingPlan(false)} isLiveMode={true} />}
      {pendingApprovalStep && <ApprovalModal step={pendingApprovalStep.step} agent={pendingApprovalStep.agent} onApprove={() => handleApproval(true)} onReject={() => handleApproval(false)} />}

      <div className="absolute inset-0 z-0">
         <WorkflowGraph steps={workflow?.steps || []} currentStepId={currentStepId} onStepClick={(step) => { setSelectedStep(step); setRightPanelTab('SYSTEM'); }} executionOverlay={executionOverlay} agents={AGENTS} />
      </div>

      <div className="absolute inset-0 z-20 pointer-events-none flex flex-col h-full overflow-hidden">
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
                            {isDemoMode && <span className="text-[9px] font-bold text-black bg-neurix-warning px-1 rounded animate-pulse">DEMO MODE</span>}
                         </div>
                     </div>
                 </div>
             </div>
             
             <div className="glass-panel px-6 py-3 rounded-2xl hidden md:flex items-center gap-8">
                 <PerformanceGraph history={metricHistory} agents={AGENTS} activeAgentIds={activeAgentIds} />
                 <div className="w-px h-6 bg-white/10" />
                 <AgentStatusDisplay state={agentState} />
             </div>
         </header>

         <div className="flex-1 min-h-0 flex gap-4 md:gap-6 px-4 md:px-6 pb-4 md:pb-6 overflow-hidden">
             <aside className={`flex-col min-h-0 pointer-events-auto transition-all duration-300 ease-in-out ${mobileTab === 'TIMELINE' ? 'flex w-full absolute inset-4 z-30 bg-black/80 backdrop-blur-xl md:static md:w-[320px]' : 'hidden xl:flex w-[320px]'}`}>
                 <div className="glass-panel flex-1 rounded-3xl overflow-hidden flex flex-col shadow-2xl md:shadow-none border border-white/10 md:border-white/5">
                     <TimelineViewer events={timeline} agents={AGENTS} />
                 </div>
             </aside>

             <main className={`relative flex flex-col items-center justify-end ${mobileTab === 'GRAPH' ? 'flex-1' : 'hidden lg:flex flex-1'}`}>
                 {(agentState === AgentState.INIT || agentState === AgentState.COMPLETED || agentState === AgentState.FAILED) && (
                     <div className="w-full max-w-xl pointer-events-auto animate-pop-in flex flex-col gap-4 mb-20 lg:mb-0">
                         <div className="glass-panel p-1.5 rounded-2xl flex items-center gap-2 shadow-2xl transition-transform focus-within:scale-[1.01]">
                             <button onClick={() => fileInputRef.current?.click()} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-neurix-400 hover:text-white transition-colors">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                             </button>
                             <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />
                             <input className="flex-1 bg-transparent border-none outline-none text-sm text-white placeholder-neurix-500 font-medium h-10 px-2" placeholder="Enter directive..." value={goal} onChange={(e) => setGoal(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleGeneratePlan()} />
                             <VoiceInput onTranscript={(text) => setGoal(prev => prev + ' ' + text)} isProcessing={agentState === AgentState.PLANNING} />
                             <button onClick={() => handleGeneratePlan()} disabled={!goal.trim()} className="h-10 px-5 rounded-xl bg-neurix-100 text-black font-bold text-xs tracking-wide hover:bg-white transition-colors disabled:opacity-50">INITIATE</button>
                         </div>
                         <div className="flex gap-2 justify-center flex-wrap">
                            {SUGGESTIONS.map((s, i) => (
                                <button key={i} onClick={() => handleGeneratePlan(s.text)} className="px-3 py-1.5 rounded-xl bg-black/40 border border-white/5 hover:border-white/20 text-[10px] text-neurix-500 hover:text-neurix-300 transition-colors">{s.label}</button>
                            ))}
                         </div>
                     </div>
                 )}
                 {(agentState === AgentState.REVIEW_PLAN || agentState === AgentState.EXECUTING) && !isEditingPlan && (
                     <div className="pointer-events-auto animate-pop-in mb-20 lg:mb-0">
                         <div className="glass-panel px-6 py-3 rounded-full flex items-center gap-6 shadow-2xl">
                             <div className="flex flex-col">
                                <span className="text-[11px] text-neurix-300 font-medium tracking-wide">{agentState === AgentState.EXECUTING ? 'System Running' : 'Awaiting Authorization'}</span>
                             </div>
                             <div className="flex gap-2">
                                <button onClick={() => setIsEditingPlan(true)} className="px-3 py-1.5 rounded-full hover:bg-white/5 text-[10px] font-bold text-neurix-400 hover:text-white uppercase">{agentState === AgentState.EXECUTING ? 'Live Edit' : 'Edit Plan'}</button>
                                {agentState === AgentState.REVIEW_PLAN && <button onClick={handleApprovePlan} className="px-4 py-1.5 rounded-full bg-neurix-success text-black text-[10px] font-bold hover:bg-emerald-400 transition-colors">EXECUTE</button>}
                             </div>
                         </div>
                     </div>
                 )}
             </main>

             <aside className={`flex-col min-h-0 pointer-events-auto transition-all duration-300 ease-in-out ${mobileTab === 'SYSTEM' ? 'flex w-full absolute inset-4 z-30 bg-black/80 backdrop-blur-xl md:static md:w-[380px]' : 'hidden lg:flex w-[380px]'}`}>
                 <div className="glass-panel flex-1 rounded-3xl overflow-hidden flex flex-col shadow-2xl md:shadow-none border border-white/10 md:border-white/5">
                     <div className="flex border-b border-white/5">
                         <button onClick={() => setRightPanelTab('SYSTEM')} className={`flex-1 py-3 text-[10px] font-bold uppercase ${rightPanelTab === 'SYSTEM' ? 'text-white bg-white/5' : 'text-neurix-500'}`}>System</button>
                         <button onClick={() => setRightPanelTab('ARTIFACTS')} className={`flex-1 py-3 text-[10px] font-bold uppercase ${rightPanelTab === 'ARTIFACTS' ? 'text-white bg-white/5' : 'text-neurix-500'}`}>Artifacts</button>
                     </div>
                     <div className="flex-[3] min-h-0 border-b border-white/5 flex flex-col relative bg-neurix-900/40">
                         {rightPanelTab === 'ARTIFACTS' ? <ArtifactsPanel artifacts={artifacts} /> : selectedStep ? (
                             <div className="p-5 overflow-y-auto custom-scrollbar">
                                 <h2 className="text-sm font-bold text-white mb-4">{selectedStep.label}</h2>
                                 <div className="space-y-4">
                                     <div className="bg-black/30 rounded border border-white/5 p-3 font-mono text-[10px] text-neurix-400">{selectedStep.description}</div>
                                     {selectedStep.output && (
                                         <div className="bg-black/30 rounded border border-white/5 overflow-hidden">
                                             {selectedStep.output.startsWith('data:image') ? <img src={selectedStep.output} className="w-full opacity-90" /> : <div className="p-3 text-[10px] font-mono text-neurix-300 whitespace-pre-wrap">{selectedStep.output.replace(/```/g, '')}</div>}
                                         </div>
                                     )}
                                 </div>
                             </div>
                         ) : <SystemMonitor metrics={metrics} agents={AGENTS} history={metricHistory} />}
                     </div>
                     <div className="flex-[2] min-h-0 bg-black/20 flex flex-col"><LogViewer logs={logs} /></div>
                 </div>
             </aside>
         </div>

         <div className="lg:hidden absolute bottom-6 left-0 right-0 flex justify-center pointer-events-none z-40">
             <nav className="pointer-events-auto glass-panel rounded-2xl p-1.5 flex gap-1 shadow-2xl ring-1 ring-white/10">
                 {['TIMELINE', 'GRAPH', 'SYSTEM'].map(tab => (
                     <button key={tab} onClick={() => setMobileTab(tab as MobileTab)} className={`px-6 py-3 rounded-xl text-[10px] font-bold uppercase ${mobileTab === tab ? 'bg-white text-black' : 'text-neurix-400'}`}>{tab}</button>
                 ))}
             </nav>
         </div>
      </div>
    </div>
  );
}
