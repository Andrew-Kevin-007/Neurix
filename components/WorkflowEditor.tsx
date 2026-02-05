
import React, { useState, useMemo } from 'react';
import { Workflow, WorkflowStep, AgentIdentity } from '../types';

interface WorkflowEditorProps {
  workflow: Workflow;
  agents: Record<string, AgentIdentity>;
  onSave: (updatedWorkflow: Workflow) => void;
  onCancel: () => void;
}

const WorkflowEditor: React.FC<WorkflowEditorProps> = ({ workflow, agents, onSave, onCancel }) => {
  const [steps, setSteps] = useState<WorkflowStep[]>(JSON.parse(JSON.stringify(workflow.steps)));
  const [selectedStepId, setSelectedStepId] = useState<string | null>(steps[0]?.id || null);

  const selectedStep = useMemo(() => steps.find(s => s.id === selectedStepId), [steps, selectedStepId]);

  // --- Handlers ---

  const handleFieldChange = (id: string, field: keyof WorkflowStep, value: any) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const handleParamChange = (stepId: string, key: string, value: string) => {
    setSteps(prev => prev.map(s => {
        if (s.id !== stepId) return s;
        const newParams = { ...(s.parameters || {}) };
        newParams[key] = value;
        return { ...s, parameters: newParams };
    }));
  };

  const handleParamKeyRename = (stepId: string, oldKey: string, newKey: string) => {
      setSteps(prev => prev.map(s => {
          if (s.id !== stepId) return s;
          const params = { ...(s.parameters || {}) };
          const value = params[oldKey];
          delete params[oldKey];
          params[newKey] = value;
          return { ...s, parameters: params };
      }));
  };

  const handleDeleteParam = (stepId: string, key: string) => {
      setSteps(prev => prev.map(s => {
          if (s.id !== stepId) return s;
          const newParams = { ...(s.parameters || {}) };
          delete newParams[key];
          return { ...s, parameters: newParams };
      }));
  };

  const handleAddParam = (stepId: string) => {
      let key = 'new_param';
      let count = 1;
      const currentParams = steps.find(s => s.id === stepId)?.parameters || {};
      while (currentParams[key]) {
          key = `new_param_${count}`;
          count++;
      }
      handleParamChange(stepId, key, '');
  };

  const toggleDependency = (stepId: string, depId: string) => {
      setSteps(prev => prev.map(s => {
          if (s.id !== stepId) return s;
          const deps = s.dependencies.includes(depId)
              ? s.dependencies.filter(d => d !== depId)
              : [...s.dependencies, depId];
          return { ...s, dependencies: deps };
      }));
  };

  const handleSave = () => {
    onSave({ ...workflow, steps });
  };

  // --- UI Helpers ---

  const getTypeColor = (type: string) => {
      switch(type) {
          case 'RESEARCH': return 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10';
          case 'CODE': return 'text-fuchsia-400 border-fuchsia-500/30 bg-fuchsia-500/10';
          case 'ANALYSIS': return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
          case 'DECISION': return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
          case 'CREATION': return 'text-rose-400 border-rose-500/30 bg-rose-500/10';
          case 'INTEGRATION': return 'text-orange-400 border-orange-500/30 bg-orange-500/10';
          default: return 'text-neurix-400 border-white/10 bg-white/5';
      }
  };

  const getTypeIcon = (type: string) => {
      switch(type) {
          case 'RESEARCH': return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />;
          case 'CODE': return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />;
          case 'ANALYSIS': return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />;
          case 'DECISION': return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />;
          case 'CREATION': return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />;
          case 'INTEGRATION': return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />;
          default: return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />;
      }
  };

  return (
    <div className="absolute inset-0 z-50 bg-neurix-950/95 backdrop-blur-sm flex flex-col animate-fade-in font-sans">
        
        {/* Top Navigation Bar */}
        <div className="h-14 px-6 border-b border-white/10 bg-neurix-900 flex justify-between items-center shrink-0 z-20 shadow-lg">
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-black/40 rounded border border-white/5">
                    <div className="w-2 h-2 rounded-full bg-neurix-accent animate-pulse" />
                    <span className="text-xs font-bold text-white tracking-widest uppercase">Workflow Studio</span>
                </div>
                <div className="h-4 w-px bg-white/10" />
                <p className="text-xs text-neurix-400 font-mono truncate max-w-md">Ref: {workflow.goal}</p>
            </div>
            
            <div className="flex gap-3">
                <button onClick={onCancel} className="px-4 py-1.5 rounded text-xs font-bold text-neurix-400 hover:text-white hover:bg-white/5 transition-colors border border-transparent">
                    Discard
                </button>
                <button onClick={handleSave} className="px-5 py-1.5 rounded bg-neurix-accent text-white text-xs font-bold hover:bg-fuchsia-500 transition-colors shadow-glow flex items-center gap-2 border border-white/10">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                    Deploy Changes
                </button>
            </div>
        </div>

        {/* Main Workspace */}
        <div className="flex-1 flex overflow-hidden">
            
            {/* Left Rail: Sequence Timeline (Visual) */}
            <div className="w-80 border-r border-white/5 bg-neurix-900/50 flex flex-col shrink-0">
                <div className="p-4 border-b border-white/5 bg-black/20">
                     <h3 className="text-[10px] font-bold text-neurix-500 uppercase tracking-widest mb-1">Execution Flow</h3>
                     <p className="text-[10px] text-neurix-600">Drag to reorder not supported in live mode.</p>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                    {steps.map((step, idx) => {
                        const style = getTypeColor(step.actionType);
                        return (
                            <div 
                                key={step.id}
                                onClick={() => setSelectedStepId(step.id)}
                                className={`
                                    relative p-3 rounded-xl cursor-pointer transition-all border group
                                    ${selectedStepId === step.id 
                                        ? 'bg-white/5 border-neurix-accent/50 shadow-[inset_0_0_20px_rgba(168,85,247,0.05)]' 
                                        : 'bg-transparent border-transparent hover:bg-white/[0.02] hover:border-white/5'
                                    }
                                `}
                            >
                                {/* Connector Line */}
                                {idx < steps.length - 1 && (
                                    <div className="absolute left-[22px] top-[40px] bottom-[-16px] w-px bg-white/5 group-hover:bg-white/10 z-0" />
                                )}

                                <div className="flex items-start gap-3 relative z-10">
                                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border shadow-sm ${style.split(' ')[1]} ${style.split(' ')[2]}`}>
                                        <svg className={`w-3.5 h-3.5 ${style.split(' ')[0]}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            {getTypeIcon(step.actionType)}
                                        </svg>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex justify-between items-center mb-0.5">
                                            <span className="text-[9px] font-mono text-neurix-500 uppercase">Step {idx + 1}</span>
                                            {selectedStepId === step.id && <div className="w-1.5 h-1.5 rounded-full bg-neurix-accent animate-pulse" />}
                                        </div>
                                        <div className={`text-xs font-medium truncate ${selectedStepId === step.id ? 'text-white' : 'text-neurix-300'}`}>
                                            {step.label}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    
                    {/* Add Step Placeholder */}
                    <div className="p-3 border border-dashed border-white/10 rounded-xl flex items-center justify-center gap-2 opacity-50 cursor-not-allowed">
                        <svg className="w-4 h-4 text-neurix-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        <span className="text-[10px] text-neurix-600 font-bold uppercase">End of Sequence</span>
                    </div>
                </div>
            </div>

            {/* Right Pane: Property Inspector */}
            <div className="flex-1 bg-[#050505] flex flex-col min-w-0">
                {selectedStep ? (
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <div className="max-w-4xl mx-auto p-8 space-y-8 animate-slide-in">
                            
                            {/* Header Section */}
                            <div className="flex items-start justify-between gap-6 pb-6 border-b border-white/5">
                                <div className="flex-1 space-y-4">
                                    <div>
                                        <label className="text-[10px] font-bold text-neurix-500 uppercase tracking-widest mb-1.5 block">Node Label</label>
                                        <input 
                                            className="w-full bg-transparent border-b border-white/10 text-xl font-bold text-white focus:border-neurix-accent focus:outline-none py-1 placeholder-white/20 font-sans"
                                            value={selectedStep.label}
                                            onChange={(e) => handleFieldChange(selectedStep.id, 'label', e.target.value)}
                                            placeholder="Name this step..."
                                        />
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-neurix-500 uppercase tracking-widest block">Action Type</label>
                                            <div className="relative group">
                                                <select 
                                                    className="appearance-none bg-white/5 hover:bg-white/10 border border-white/10 rounded px-3 py-1.5 pr-8 text-xs font-mono text-neurix-300 focus:border-neurix-accent focus:outline-none transition-colors cursor-pointer"
                                                    value={selectedStep.actionType}
                                                    onChange={(e) => handleFieldChange(selectedStep.id, 'actionType', e.target.value)}
                                                >
                                                    {['RESEARCH', 'CODE', 'ANALYSIS', 'DECISION', 'CREATION', 'INTEGRATION'].map(t => (
                                                        <option key={t} value={t}>{t}</option>
                                                    ))}
                                                </select>
                                                <div className="absolute right-2 top-2 pointer-events-none text-neurix-500">
                                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-neurix-500 uppercase tracking-widest block">Assigned Agent</label>
                                            <div className="relative group">
                                                <select 
                                                    className="appearance-none bg-white/5 hover:bg-white/10 border border-white/10 rounded px-3 py-1.5 pr-8 text-xs font-mono text-neurix-300 focus:border-neurix-accent focus:outline-none transition-colors cursor-pointer"
                                                    value={selectedStep.assignedAgentId || ''}
                                                    onChange={(e) => handleFieldChange(selectedStep.id, 'assignedAgentId', e.target.value || undefined)}
                                                >
                                                    <option value="">Auto (System)</option>
                                                    {(Object.values(agents) as AgentIdentity[])
                                                        .filter(a => ['PLANNER', 'ROUTER'].indexOf(a.role) === -1)
                                                        .map(agent => (
                                                        <option key={agent.id} value={agent.id}>{agent.name}</option>
                                                    ))}
                                                </select>
                                                <div className="absolute right-2 top-2 pointer-events-none text-neurix-500">
                                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-[10px] font-mono text-neurix-600 mb-1">NODE ID</div>
                                    <div className="text-xs font-mono text-neurix-400 bg-white/5 px-2 py-1 rounded select-all">{selectedStep.id}</div>
                                </div>
                            </div>

                            {/* Dependencies (Wiring) */}
                            <div className="space-y-3">
                                <label className="text-[10px] font-bold text-neurix-500 uppercase tracking-widest flex items-center gap-2">
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                                    Upstream Dependencies (Wait For)
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {steps.filter(s => s.id !== selectedStep.id).map(s => {
                                        const isConnected = selectedStep.dependencies.includes(s.id);
                                        return (
                                            <button 
                                                key={s.id}
                                                onClick={() => toggleDependency(selectedStep.id, s.id)}
                                                className={`
                                                    text-left px-3 py-2 rounded border text-xs font-mono transition-all flex items-center gap-2
                                                    ${isConnected 
                                                        ? 'bg-neurix-accent/10 border-neurix-accent text-white' 
                                                        : 'bg-white/5 border-transparent text-neurix-500 hover:bg-white/10 hover:text-neurix-300'
                                                    }
                                                `}
                                            >
                                                <div className={`w-2 h-2 rounded-full border ${isConnected ? 'bg-neurix-accent border-neurix-accent' : 'border-neurix-600'}`} />
                                                <span className="truncate">{s.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Parameters Grid */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-bold text-neurix-500 uppercase tracking-widest flex items-center gap-2">
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>
                                        Data Parameters
                                    </label>
                                    <button 
                                        onClick={() => handleAddParam(selectedStep.id)} 
                                        className="text-[10px] font-bold text-neurix-accent hover:text-white transition-colors bg-neurix-accent/10 hover:bg-neurix-accent/20 px-2 py-1 rounded border border-neurix-accent/20"
                                    >
                                        + ADD PARAMETER
                                    </button>
                                </div>

                                <div className="border border-white/10 rounded-lg overflow-hidden bg-black/40">
                                    {/* Table Header */}
                                    <div className="flex bg-white/5 border-b border-white/10 px-4 py-2">
                                        <div className="w-1/3 text-[9px] font-bold text-neurix-500 uppercase tracking-wider">Key</div>
                                        <div className="flex-1 text-[9px] font-bold text-neurix-500 uppercase tracking-wider">Value</div>
                                        <div className="w-8"></div>
                                    </div>
                                    
                                    {/* Table Rows */}
                                    {Object.entries(selectedStep.parameters || {}).map(([key, val], i) => (
                                        <div key={i} className="flex group border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                                            <div className="w-1/3 border-r border-white/5 p-0">
                                                <input 
                                                    className="w-full h-full bg-transparent px-4 py-3 text-xs font-mono text-neurix-300 focus:text-neurix-accent focus:bg-white/[0.02] outline-none placeholder-white/20"
                                                    value={key}
                                                    onChange={(e) => handleParamKeyRename(selectedStep.id, key, e.target.value)}
                                                    placeholder="param_key"
                                                />
                                            </div>
                                            <div className="flex-1 p-0 flex">
                                                <input 
                                                    className="flex-1 h-full bg-transparent px-4 py-3 text-xs font-mono text-white focus:bg-white/[0.02] outline-none placeholder-white/20"
                                                    value={val}
                                                    onChange={(e) => handleParamChange(selectedStep.id, key, e.target.value)}
                                                    placeholder="Value..."
                                                />
                                            </div>
                                            <div className="w-8 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer border-l border-white/5 hover:bg-neurix-danger/20"
                                                 onClick={() => handleDeleteParam(selectedStep.id, key)}
                                            >
                                                <svg className="w-3.5 h-3.5 text-neurix-500 hover:text-neurix-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                            </div>
                                        </div>
                                    ))}
                                    {Object.keys(selectedStep.parameters || {}).length === 0 && (
                                        <div className="p-6 text-center text-xs text-neurix-600 italic">No parameters defined.</div>
                                    )}
                                </div>
                            </div>

                            {/* Instructions (Prompt) */}
                            <div className="space-y-2 h-full flex flex-col">
                                <label className="text-[10px] font-bold text-neurix-500 uppercase tracking-widest flex items-center gap-2">
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                    Prompt / Instructions
                                </label>
                                <div className="relative flex-1">
                                    <textarea 
                                        className="w-full min-h-[160px] bg-black/40 border border-white/10 rounded-lg p-4 text-xs font-mono text-neurix-200 focus:border-neurix-accent focus:outline-none transition-colors leading-relaxed custom-scrollbar resize-y"
                                        value={selectedStep.description}
                                        onChange={(e) => handleFieldChange(selectedStep.id, 'description', e.target.value)}
                                        spellCheck={false}
                                    />
                                    <div className="absolute bottom-2 right-2 text-[9px] text-neurix-600 bg-black/80 px-1 rounded pointer-events-none">MARKDOWN SUPPORTED</div>
                                </div>
                            </div>

                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-neurix-600 gap-4">
                        <svg className="w-12 h-12 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" /></svg>
                        <span className="text-xs font-mono uppercase tracking-widest">Select a Node to Configure</span>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};

export default WorkflowEditor;
