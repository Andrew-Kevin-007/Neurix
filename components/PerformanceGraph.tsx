import React, { useMemo } from 'react';
import { MetricHistoryPoint, AgentIdentity } from '../types';

interface PerformanceGraphProps {
  history: MetricHistoryPoint[];
  agents: Record<string, AgentIdentity>;
  activeAgentId?: string | null;
}

const PerformanceGraph: React.FC<PerformanceGraphProps> = ({ history, activeAgentId }) => {
  // Use fixed view for SVG
  const width = 120;
  const height = 32;
  
  const points = useMemo(() => {
    const data = history.slice(-30); // Last 30 points
    if (data.length < 2) return "";
    
    // Find active agent's specific track if selected, else average? 
    // For visual purity, we track the *active* agent's confidence line.
    
    const relevantPoints = data.map((pt, i) => {
        const x = (i / (data.length - 1)) * width;
        // If there's an active agent, prioritize their metric, else fallback to average of all
        const val = activeAgentId 
            ? (pt.metrics.averageConfidence || 0) 
            : 0.5; // Flatline if no active agent (cleaner)
        
        const y = height - (val * height);
        return `${x},${y}`;
    });
    
    return relevantPoints.join(' ');
  }, [history, activeAgentId]);

  return (
    <div className="flex items-center gap-3">
        {/* Label */}
        <div className="flex flex-col items-end">
            <span className="text-[9px] font-mono text-neurix-500 uppercase tracking-wider">Neural Load</span>
            <span className={`text-xs font-mono font-bold ${activeAgentId ? 'text-neurix-accent' : 'text-neurix-600'}`}>
               {activeAgentId ? 'ACTIVE' : 'IDLE'}
            </span>
        </div>
        
        {/* Mini Graph */}
        <div className="w-[120px] h-[32px] bg-black/40 border border-white/10 rounded relative overflow-hidden">
            {/* Grid Lines */}
            <div className="absolute top-1/2 w-full h-[1px] bg-white/5" />
            <div className="absolute left-1/3 h-full w-[1px] bg-white/5" />
            <div className="absolute left-2/3 h-full w-[1px] bg-white/5" />
            
            <svg width="100%" height="100%" className="absolute inset-0">
                <polyline 
                    points={points} 
                    fill="none" 
                    stroke={activeAgentId ? "#A855F7" : "#333"} 
                    strokeWidth="1.5" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                    className="transition-colors duration-300"
                />
            </svg>
            
            {/* Scanline overlay */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-pulse opacity-50 pointer-events-none" />
        </div>
    </div>
  );
};

export default PerformanceGraph;