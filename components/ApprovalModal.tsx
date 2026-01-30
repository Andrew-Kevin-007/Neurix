
import React from 'react';
import { WorkflowStep, AgentIdentity } from '../types';

interface ApprovalModalProps {
  step: WorkflowStep;
  agent: AgentIdentity;
  onApprove: () => void;
  onReject: () => void;
}

const ApprovalModal: React.FC<ApprovalModalProps> = ({ step, agent, onApprove, onReject }) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Dimmed Background */}
      <div className="absolute inset-0 bg-black/90 backdrop-blur-sm animate-fade-in" />

      {/* Modal Content */}
      <div className="relative w-full max-w-lg bg-neurix-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-pop-in ring-1 ring-white/10">
        
        {/* Header - Industrial Warning Style */}
        <div className="px-6 py-4 bg-gradient-to-r from-neurix-800 to-neurix-900 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-orange-500 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                </div>
                <div>
                    <h2 className="text-sm font-bold text-white uppercase tracking-wide">Action Approval Required</h2>
                    <p className="text-[10px] text-neurix-400">Agent <span className={agent.color}>{agent.name}</span> is requesting permission.</p>
                </div>
            </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
            
            <div>
                <label className="text-[10px] font-bold text-neurix-500 uppercase tracking-widest mb-2 block">Planned Action</label>
                <div className="text-sm text-white font-medium bg-white/5 p-3 rounded-lg border border-white/5">
                    {step.label}
                </div>
            </div>

            <div>
                <label className="text-[10px] font-bold text-neurix-500 uppercase tracking-widest mb-2 flex justify-between">
                    <span>Payload Preview</span>
                    <span className="text-[9px] text-orange-400 font-mono">{step.toolId?.toUpperCase()} API</span>
                </label>
                <div className="bg-black/50 rounded-lg border border-white/10 overflow-hidden relative">
                    <pre className="p-4 text-[10px] font-mono text-neurix-300 overflow-x-auto custom-scrollbar leading-relaxed">
                        {JSON.stringify(step.parameters || {}, null, 2)}
                    </pre>
                    <div className="absolute top-0 right-0 p-1.5 bg-neurix-900/80 rounded-bl-lg border-l border-b border-white/10">
                        <span className="text-[8px] font-bold text-neurix-500 uppercase">JSON</span>
                    </div>
                </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg bg-orange-500/5 border border-orange-500/10">
                <svg className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-[10px] text-neurix-300 leading-relaxed">
                    This action interacts with an external system. Once approved, it cannot be undone by the NEURIX kernel.
                </p>
            </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-white/[0.02] border-t border-white/5 flex justify-end gap-3">
            <button 
                onClick={onReject}
                className="px-4 py-2 rounded-lg text-xs font-bold text-neurix-400 hover:text-white hover:bg-white/5 transition-colors"
            >
                REJECT ACTION
            </button>
            <button 
                onClick={onApprove}
                className="px-6 py-2 rounded-lg bg-neurix-success text-black text-xs font-bold hover:bg-green-400 transition-colors shadow-lg shadow-green-500/20 flex items-center gap-2"
            >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                APPROVE & EXECUTE
            </button>
        </div>

      </div>
    </div>
  );
};

export default ApprovalModal;
