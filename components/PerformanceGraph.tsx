import React, { useMemo } from 'react';
import { MetricHistoryPoint, AgentIdentity } from '../types';

interface PerformanceGraphProps {
  history: MetricHistoryPoint[];
  agents: Record<string, AgentIdentity>;
  activeAgentIds?: string[];
}

const PerformanceGraph: React.FC<PerformanceGraphProps> = ({ history, activeAgentIds = [] }) => {
  // Use fixed view for SVG
  const width = 120;
  const height = 32;
  
  // Create paths for each active agent or a general activity line
  const paths = useMemo(() => {
    const data = history.slice(-30); // Last 30 points
    if (data.length < 2) return [];
    
    // If no specific agents are active, show nothing or flatline
    if (activeAgentIds.length === 0) return [];

    return activeAgentIds.map(agentId => {
        const agentData = data.filter(d => d.agentId === agentId);
        // If we don't have enough data for this specific agent in the recent window, skip
        if (agentData.length < 2) return null;
        
        // Map to coordinates
        const pts = data.map((pt, i) => {
            // Find metric for this agent at this timestamp (or close enough)
            // Ideally history is interleaved. simpler approach: assume history contains all
            const metric = history.find(h => h.timestamp === pt.timestamp && h.agentId === agentId);
            const val = metric ? metric.metrics.averageConfidence : 0;
            
            const x = (i / (data.length - 1)) * width;
            const y = height - (val * height);
            return `${x},${y}`;
        });
        
        return { id: agentId, d: pts.join(' ') };
    }).filter(Boolean) as { id: string, d: string }[];
    
  }, [history, activeAgentIds]);

  return (
    <div className="flex items-center gap-3">
        {/* Label */}
        <div className="flex flex-col items-end">
            <span className="text-[9px] font-mono text-neurix-500 uppercase tracking-wider">Neural Load</span>
            <span className={`text-xs font-mono font-bold ${activeAgentIds.length > 0 ? 'text-neurix-accent' : 'text-neurix-600'}`}>
               {activeAgentIds.length > 0 ? `${activeAgentIds.length} ACTIVE` : 'IDLE'}
            </span>
        </div>
        
        {/* Mini Graph */}
        <div className="w-[120px] h-[32px] bg-black/40 border border-white/10 rounded relative overflow-hidden">
            {/* Grid Lines */}
            <div className="absolute top-1/2 w-full h-[1px] bg-white/5" />
            <div className="absolute left-1/3 h-full w-[1px] bg-white/5" />
            <div className="absolute left-2/3 h-full w-[1px] bg-white/5" />
            
            <svg width="100%" height="100%" className="absolute inset-0">
                {paths.map(path => (
                    <polyline 
                        key={path.id}
                        points={path.d} 
                        fill="none" 
                        stroke="#A855F7" // Could use agent color here if passed down
                        strokeWidth="1.5" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                        className="transition-all duration-300 opacity-80"
                    />
                ))}
                {paths.length === 0 && (
                    <line x1="0" y1={height/2} x2={width} y2={height/2} stroke="#333" strokeWidth="1" />
                )}
            </svg>
            
            {/* Scanline overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-pulse opacity-50 pointer-events-none" />
        </div>
    </div>
  );
};

export default PerformanceGraph;