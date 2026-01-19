import React, { useEffect, useRef } from 'react';
import { LogEntry } from '../types';

interface LogViewerProps {
  logs: LogEntry[];
}

const LogViewer: React.FC<LogViewerProps> = ({ logs }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const getLogColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'ERROR': return 'text-neurix-danger';
      case 'WARNING': return 'text-neurix-warning';
      case 'SUCCESS': return 'text-neurix-success';
      case 'THOUGHT': return 'text-neurix-accent';
      default: return 'text-neurix-400';
    }
  };

  return (
    <div className="flex flex-col h-full font-mono">
      <div className="px-5 py-2 border-b border-white/5 bg-white/[0.02] backdrop-blur flex items-center justify-between sticky top-0 z-10">
        <span className="text-[10px] font-bold text-neurix-500 uppercase tracking-widest">System Log</span>
        <div className="flex gap-1">
            <div className="w-1 h-1 rounded-full bg-neurix-500 opacity-50" />
            <div className="w-1 h-1 rounded-full bg-neurix-500 opacity-50" />
            <div className="w-1 h-1 rounded-full bg-neurix-500 opacity-50" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-1.5 custom-scrollbar">
        {logs.length === 0 && (
          <div className="h-full flex items-center justify-center text-[10px] text-neurix-500/30 italic">
            // System initialized
          </div>
        )}
        {logs.map((log) => {
            const agentName = log.metadata?.agentName;
            const agentColor = log.metadata?.agentColor;
            const model = log.metadata?.model;

            return (
              <div key={log.id} className="text-[10px] leading-relaxed flex gap-2 animate-fade-in group">
                <span className="text-neurix-500/40 select-none min-w-[44px]">
                  {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                
                <div className="flex-1 break-words">
                    {/* Agent Badge Inline */}
                    {agentName && (
                        <span className={`
                            inline-block px-1.5 py-0.5 rounded-[3px] bg-white/5 border border-white/10 mr-2 mb-0.5 
                            text-[8px] font-bold tracking-wider uppercase
                            ${agentColor || 'text-neurix-400'}
                        `}>
                            {agentName}
                        </span>
                    )}

                    {/* Model Badge Inline */}
                    {model && (
                        <span className="inline-block px-1.5 py-0.5 rounded-[3px] bg-white/5 border border-white/10 mr-2 mb-0.5 text-[8px] font-mono text-neurix-500">
                           {model}
                        </span>
                    )}

                    <span className={`font-medium ${getLogColor(log.type)}`}>
                      {log.type === 'THOUGHT' ? '>> ' : ''}
                      {log.message}
                    </span>
                    
                    {/* Metadata Dump (Hidden by default) */}
                    {log.metadata && Object.keys(log.metadata).length > 3 && (
                      <div className="mt-0.5 ml-2 pl-2 border-l border-white/10 text-neurix-500/60 hidden group-hover:block transition-all">
                        {JSON.stringify(log.metadata).slice(0, 100)}...
                      </div>
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

export default LogViewer;