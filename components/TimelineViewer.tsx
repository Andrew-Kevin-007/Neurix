import React, { useEffect, useRef } from 'react';
import { TimelineEvent, AgentIdentity } from '../types';

interface TimelineViewerProps {
  events: TimelineEvent[];
  agents: Record<string, AgentIdentity>;
}

const TimelineViewer: React.FC<TimelineViewerProps> = ({ events, agents }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events]);

  const getAgent = (id: string) => (Object.values(agents) as AgentIdentity[]).find(a => a.id === id);
  
  const getAgentColorHex = (twClass: string) => {
      if (twClass.includes('accent')) return '#A855F7';
      if (twClass.includes('success')) return '#30D158';
      if (twClass.includes('warning')) return '#FFD60A';
      if (twClass.includes('cyan')) return '#22d3ee';
      if (twClass.includes('fuchsia')) return '#e879f9';
      return '#86868B';
  };

  return (
    <div className="flex flex-col h-full font-sans select-none relative bg-neurix-900/20">
      {/* Sticky Header */}
      <div className="px-5 py-4 border-b border-white/5 bg-white/[0.02] backdrop-blur-md sticky top-0 z-20 flex justify-between items-center">
        <h3 className="text-[11px] font-bold text-neurix-300 uppercase tracking-widest">Timeline</h3>
        <div className="flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neurix-success opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-neurix-success"></span>
            </span>
            <span className="text-[9px] font-bold text-neurix-500 uppercase">Live</span>
        </div>
      </div>
      
      {/* Feed Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar relative">
        {events.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-30">
             <div className="w-1 h-12 bg-gradient-to-b from-transparent via-neurix-500 to-transparent" />
             <p className="mt-4 text-[10px] uppercase tracking-widest text-neurix-500">Sequence Pending</p>
          </div>
        )}
        
        {events.map((event, idx) => {
            const agent = getAgent(event.agentId);
            const isLast = idx === events.length - 1;
            const agentColorHex = getAgentColorHex(agent?.color || '');
            const isHandoff = event.type === 'AGENT_HANDOFF';
            const model = event.payload?.model;
            
            return (
                <div key={event.id} className="flex gap-4 relative animate-fade-in group">
                    {/* Timeline Line */}
                    {!isLast && (
                      <div className="absolute left-[5px] top-4 bottom-[-24px] w-[1px] bg-white/[0.05]"></div>
                    )}
                    
                    {/* Node */}
                    <div className="flex-shrink-0 z-10 mt-1.5">
                        <div className="w-3 h-3 rounded-full border border-white/10 bg-neurix-900 shadow-[0_0_10px_rgba(0,0,0,0.5)] flex items-center justify-center">
                            <div className="w-1 h-1 rounded-full" style={{ backgroundColor: agentColorHex }}></div>
                        </div>
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0 pt-0.5">
                        <div className="flex justify-between items-baseline mb-1">
                            <div className="flex items-center gap-2">
                                <span className={`text-[10px] font-bold tracking-wide ${agent?.color}`}>{agent?.name}</span>
                                {model && (
                                    <span className="text-[8px] px-1.5 py-px rounded bg-white/5 border border-white/10 text-neurix-500 font-mono">
                                        {model.replace('preview', '').replace('latest', '')}
                                    </span>
                                )}
                            </div>
                            <span className="text-[9px] text-neurix-500/40 font-mono">
                                {new Date(event.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' })}
                            </span>
                        </div>
                        
                        {isHandoff ? (
                             <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/5 relative group-hover:bg-white/[0.05] transition-colors">
                                <p className="text-[11px] text-neurix-100 font-medium leading-relaxed">
                                    {event.message}
                                </p>
                             </div>
                        ) : (
                            <p className="text-[11px] text-neurix-400 leading-relaxed font-normal">
                                {event.message}
                            </p>
                        )}
                    </div>
                </div>
            );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};

export default TimelineViewer;