import React, { useState } from 'react';
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

  const handleDeleteParam = (stepId: string, key: string) => {
      setSteps(prev => prev.map(s => {
          if (s.id !== stepId) return s;
          const newParams = { ...(s.parameters || {}) };
          delete newParams[key];
          return { ...s, parameters: newParams };
      }));
  };

  const handleAddParam = (stepId: string) => {
      // Find unique key
      let key = 'new_param';
      let count = 1;
      const currentParams = steps.find(s => s.id === stepId)?.parameters || {};
      while (currentParams[key]) {
          key = `new_param_${count}`;
          count++;
      }
      handleParamChange(stepId, key, '');
  };

  const handleSave = () => {
    onSave({ ...workflow, steps });
  };

  const selectedStep = steps.find(s => s.id === selectedStepId);

  return (
    <div className="absolute inset-0 z-50 bg-neurix-950 flex flex-col animate-fade-in">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 bg-neurix-900 flex justify-between items-center shrink-0">
            <div>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-neurix-warning animate-pulse" />
                    <h2 className="text-lg font-bold text-white tracking-tight">Workflow Editor</h2>
                </div>
                <p className="text-xs text-neurix-500 font-mono mt-0.5 max-w-md truncate">GOAL: {workflow.goal}</p>
            </div>
            <div className="flex gap-3">
                <button onClick={onCancel} className="px-4 py-2 rounded-lg text-xs font-bold text-neurix-400 hover:bg-white/5 transition-colors">
                    CANCEL
                </button>
                <button onClick={handleSave} className="px-6 py-2 rounded-lg bg-neurix-accent text-white text-xs font-bold hover:bg-fuchsia-400 transition-colors shadow-glow flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    SAVE CHANGES
                </button>
            </div>
        </div>

        {/* Body */}
        <div className="flex-1 flex overflow-hidden">
            {/* Sidebar List */}
            <div className="w-1/3 min-w-[250px] max-w-[350px] border-r border-white/5 bg-neurix-900/50 flex flex-col overflow-y-auto custom-scrollbar">
                {steps.map((step, idx) => (
                    <div 
                        key={step.id}
                        onClick={() => setSelectedStepId(step.id)}
                        className={`p-4 border-b border-white/5 cursor-pointer hover:bg-white/5 transition-colors group ${selectedStepId === step.id ? 'bg-white/10 border-l-2 border-l-neurix-accent' : 'border-l-2 border-l-transparent'}`}
                    >
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-[9px] font-bold text-neurix-500 uppercase tracking-widest group-hover:text-neurix-300 transition-colors">Step {idx + 1}</span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded bg-black/40 ${selectedStepId === step.id ? 'text-neurix-accent' : 'text-neurix-500'}`}>{step.actionType}</span>
                        </div>
                        <div className={`text-xs font-medium line-clamp-2 ${selectedStepId === step.id ? 'text-white' : 'text-neurix-300'}`}>{step.label}</div>
                    </div>
                ))}
            </div>

            {/* Detail View */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8 bg-black/20">
                {selectedStep ? (
                    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in">
                        
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-neurix-500 uppercase tracking-widest">Step Label</label>
                            <input 
                                className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-white focus:border-neurix-accent focus:outline-none transition-colors focus:ring-1 focus:ring-neurix-accent/50"
                                value={selectedStep.label}
                                onChange={(e) => handleFieldChange(selectedStep.id, 'label', e.target.value)}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-neurix-500 uppercase tracking-widest">Action Type</label>
                                <div className="relative">
                                    <select 
                                        className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-white focus:border-neurix-accent focus:outline-none appearance-none cursor-pointer hover:bg-white/10 transition-colors"
                                        value={selectedStep.actionType}
                                        onChange={(e) => handleFieldChange(selectedStep.id, 'actionType', e.target.value)}
                                    >
                                        {['RESEARCH', 'CODE', 'ANALYSIS', 'DECISION', 'CREATION'].map(t => (
                                            <option key={t} value={t}>{t}</option>
                                        ))}
                                    </select>
                                    <div className="absolute right-3 top-3.5 pointer-events-none text-neurix-500">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-neurix-500 uppercase tracking-widest">Assigned Agent</label>
                                <div className="relative">
                                    <select 
                                        className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-white focus:border-neurix-accent focus:outline-none appearance-none cursor-pointer hover:bg-white/10 transition-colors"
                                        value={selectedStep.assignedAgentId || ''}
                                        onChange={(e) => handleFieldChange(selectedStep.id, 'assignedAgentId', e.target.value || undefined)}
                                    >
                                        <option value="">Auto-Assign (System Decision)</option>
                                        {(Object.values(agents) as AgentIdentity[])
                                            .filter(a => ['PLANNER', 'ROUTER'].indexOf(a.role) === -1)
                                            .map(agent => (
                                            <option key={agent.id} value={agent.id} className={agent.color}>
                                                {agent.name} ({agent.role})
                                            </option>
                                        ))}
                                    </select>
                                    <div className="absolute right-3 top-3.5 pointer-events-none text-neurix-500">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-neurix-500 uppercase tracking-widest">Dependencies</label>
                            <div className="p-3 bg-white/5 border border-white/5 rounded-lg text-sm text-neurix-400 font-mono overflow-hidden text-ellipsis whitespace-nowrap">
                                {selectedStep.dependencies.length > 0 ? selectedStep.dependencies.join(', ') : 'ROOT (No Dependencies)'}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-neurix-500 uppercase tracking-widest">Detailed Instructions</label>
                            <textarea 
                                className="w-full h-40 bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-neurix-200 focus:border-neurix-accent focus:outline-none transition-colors resize-none leading-relaxed custom-scrollbar"
                                value={selectedStep.description}
                                onChange={(e) => handleFieldChange(selectedStep.id, 'description', e.target.value)}
                            />
                        </div>

                        <div className="space-y-3">
                            <div className="flex justify-between items-end border-b border-white/5 pb-2">
                                <label className="text-[10px] font-bold text-neurix-500 uppercase tracking-widest">Execution Parameters</label>
                                <button onClick={() => handleAddParam(selectedStep.id)} className="text-[10px] font-bold text-neurix-accent hover:text-white transition-colors flex items-center gap-1">
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                    ADD PARAM
                                </button>
                            </div>
                            <div className="bg-white/5 border border-white/10 rounded-lg overflow-hidden">
                                {Object.entries(selectedStep.parameters || {}).map(([key, val], i) => (
                                    <div key={i} className="flex flex-col md:flex-row border-b border-white/5 last:border-0 group hover:bg-white/5 transition-colors">
                                        <div className="w-full md:w-1/3 border-b md:border-b-0 md:border-r border-white/5 relative">
                                            <input 
                                                className="w-full bg-transparent p-3 text-xs font-mono text-neurix-400 focus:outline-none focus:text-neurix-accent placeholder-neurix-500/50"
                                                value={key}
                                                placeholder="Key"
                                                onChange={(e) => {
                                                    const oldVal = selectedStep.parameters?.[key];
                                                    // This is a bit hacky for key renaming: delete old, add new
                                                    // Ideally we'd use an array of objects for params in state, but this works for simple edits
                                                    if (e.target.value !== key) {
                                                        handleDeleteParam(selectedStep.id, key);
                                                        handleParamChange(selectedStep.id, e.target.value, oldVal as string);
                                                    }
                                                }}
                                            />
                                        </div>
                                        <div className="flex-1 flex items-center">
                                            <input 
                                                className="flex-1 bg-transparent p-3 text-xs text-white focus:outline-none placeholder-neurix-500/50"
                                                value={val}
                                                placeholder="Value"
                                                onChange={(e) => handleParamChange(selectedStep.id, key, e.target.value)}
                                            />
                                            <button 
                                                onClick={() => handleDeleteParam(selectedStep.id, key)}
                                                className="px-4 py-3 text-neurix-500 hover:text-neurix-danger opacity-0 group-hover:opacity-100 transition-all"
                                                title="Remove Parameter"
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {Object.keys(selectedStep.parameters || {}).length === 0 && (
                                    <div className="p-8 flex flex-col items-center justify-center text-neurix-500/40 gap-2">
                                        <svg className="w-6 h-6 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                                        <span className="text-xs italic">No parameters configured</span>
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                ) : (
                    <div className="h-full flex items-center justify-center text-neurix-500 text-sm">Select a step to edit details</div>
                )}
            </div>
        </div>
    </div>
  );
};

export default WorkflowEditor;