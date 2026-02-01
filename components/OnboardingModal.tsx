
import React, { useState, useEffect } from 'react';
import { AgentIdentity } from '../types';

interface OnboardingModalProps {
  onStart: () => void;
  agents: Record<string, AgentIdentity>;
}

const OnboardingModal: React.FC<OnboardingModalProps> = ({ onStart, agents }) => {
  const [isOpen, setIsOpen] = useState(true);

  const handleStart = () => {
    setIsOpen(false);
    setTimeout(onStart, 300); // Wait for exit animation
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-fade-in" />

      {/* Main Card */}
      <div className="relative w-full max-w-4xl w-[95%] md:w-full max-h-[90dvh] flex flex-col md:flex-row bg-neurix-900/90 border border-white/10 rounded-3xl shadow-2xl overflow-hidden animate-pop-in">
        
        {/* Left: Brand / Intro */}
        <div className="w-full md:w-1/3 bg-gradient-to-br from-neurix-900 to-neurix-950 p-6 md:p-8 flex flex-col justify-between border-b md:border-b-0 md:border-r border-white/5 shrink-0">
           <div>
              <div className="w-12 h-12 rounded-xl bg-neurix-accent/10 border border-neurix-accent/20 flex items-center justify-center mb-6 shadow-glow">
                  <div className="w-4 h-4 bg-neurix-accent rounded-full animate-pulse" />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-white mb-2 tracking-tight">NEURIX</h1>
              <p className="text-sm text-neurix-400 leading-relaxed">
                Autonomous Reasoning Engine & <br className="hidden md:block"/> transparent agent framework.
              </p>
           </div>

           <div className="mt-6 space-y-4">
              <div className="flex items-start gap-3">
                  <span className="text-neurix-accent mt-0.5 font-mono text-xs">01</span>
                  <p className="text-xs text-neurix-500">
                    <strong className="text-neurix-300 block mb-0.5">Planning</strong>
                    Goals are converted into directed acyclic graphs (DAGs) by NEXUS.
                  </p>
              </div>
              <div className="flex items-start gap-3">
                  <span className="text-neurix-success mt-0.5 font-mono text-xs">02</span>
                  <p className="text-xs text-neurix-500">
                    <strong className="text-neurix-300 block mb-0.5">Auto-Model Switching</strong>
                    Dynamically switches between Gemini 3 Pro (Logic) and Flash (Speed) per step.
                  </p>
              </div>
              <div className="flex items-start gap-3">
                  <span className="text-neurix-warning mt-0.5 font-mono text-xs">03</span>
                  <p className="text-xs text-neurix-500">
                    <strong className="text-neurix-300 block mb-0.5">Verification</strong>
                    AXION audits every output. Failures trigger auto-recovery.
                  </p>
              </div>
              <div className="flex items-start gap-3">
                  <span className="text-cyan-400 mt-0.5 font-mono text-xs">04</span>
                  <p className="text-xs text-neurix-500">
                    <strong className="text-neurix-300 block mb-0.5">Voice Command</strong>
                    Native speech recognition for hands-free directives.
                  </p>
              </div>
           </div>
        </div>

        {/* Right: Agent Grid */}
        <div className="flex-1 p-6 md:p-8 bg-black/20 overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-sm font-bold text-white uppercase tracking-widest">Neural Architecture</h2>
                <span className="text-[10px] px-2 py-1 rounded bg-white/5 border border-white/5 text-neurix-500">V2.4 ONLINE</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
                {(Object.values(agents) as AgentIdentity[]).filter(a => ['PLANNER', 'VERIFIER', 'EXECUTOR', 'SPECIALIST'].includes(a.role)).slice(0, 4).map((agent) => (
                    <div key={agent.id} className="p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors group">
                        <div className="flex justify-between items-start mb-2">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/40 ${agent.color}`}>
                                {agent.role}
                            </span>
                            <div className={`w-2 h-2 rounded-full ${agent.color.replace('text-', 'bg-')}`} />
                        </div>
                        <div className="text-sm font-bold text-white mb-0.5">{agent.name}</div>
                        <div className="text-[10px] text-neurix-500 line-clamp-2">
                           {agent.role === 'PLANNER' && "Architects complex workflows from natural language."}
                           {agent.role === 'VERIFIER' && "Audits outputs for factual accuracy and safety."}
                           {agent.name === 'HELIX' && "Specializes in deep research and data synthesis."}
                           {agent.name === 'VORTEX' && "Generates code, scripts, and technical implementations."}
                        </div>
                    </div>
                ))}
            </div>

            <button 
                onClick={handleStart}
                className="w-full py-3 rounded-xl bg-white text-black font-bold text-sm hover:bg-neurix-300 transition-colors shadow-lg shadow-white/10"
            >
                INITIALIZE SYSTEM
            </button>
        </div>

      </div>
    </div>
  );
};

export default OnboardingModal;
