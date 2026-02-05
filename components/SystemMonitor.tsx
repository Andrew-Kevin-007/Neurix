
import React, { useMemo } from 'react';
import { AgentMetrics, AgentIdentity, MetricHistoryPoint } from '../types';

interface SystemMonitorProps {
  metrics: Record<string, AgentMetrics>;
  agents: Record<string, AgentIdentity>;
  history: MetricHistoryPoint[];
}

// Helper for smooth Bezier curves
const getSmoothPath = (points: {x: number, y: number}[]) => {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let d = `M ${points[0].x} ${points[0].y}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    
    // Control points for a smooth S-curve interpolation
    // This creates a fluid transition between points
    const cp1x = p0.x + (p1.x - p0.x) * 0.5;
    const cp1y = p0.y;
    const cp2x = p0.x + (p1.x - p0.x) * 0.5;
    const cp2y = p1.y;

    d += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p1.x} ${p1.y}`;
  }
  return d;
};

const SystemMonitor: React.FC<SystemMonitorProps> = ({ metrics, agents, history }) => {
  const totalSystemTokens = (Object.values(metrics) as AgentMetrics[]).reduce((acc, m) => acc + m.tokenUsage, 0);
  
  // Sort agents by token usage descending
  const sortedAgents = (Object.values(agents) as AgentIdentity[])
    .filter(a => metrics[a.id].tokenUsage > 0)
    .sort((a, b) => metrics[b.id].tokenUsage - metrics[a.id].tokenUsage);

  const getAgentColorHex = (twClass: string) => {
      if (twClass.includes('accent')) return '#A855F7';
      if (twClass.includes('success')) return '#30D158';
      if (twClass.includes('warning')) return '#FFD60A';
      if (twClass.includes('cyan')) return '#22d3ee';
      if (twClass.includes('fuchsia')) return '#e879f9';
      if (twClass.includes('yellow')) return '#facc15';
      return '#86868B';
  };

  const graphData = useMemo(() => {
    // If no history, return empty
    if (history.length < 2) return { paths: {}, minY: 0, maxY: 50 };

    const now = Date.now();
    const startTime = history[0].timestamp;
    // Keep a consistent window (e.g. 10 seconds) or dynamic based on history depth
    const timeWindow = Math.max(now - startTime, 10000); 

    const paths: Record<string, string> = {};
    const agentIds = Object.keys(metrics);
    
    // Calculate global max for scaling (minimum 20 to avoid huge spikes on low data)
    let globalMaxDelta = 20;

    // 1. Calculate Deltas (Velocity) per Agent
    const agentDeltas: Record<string, {x: number, y: number}[]> = {};

    agentIds.forEach(id => {
        const agentHistory = history.filter(h => h.agentId === id);
        if (agentHistory.length < 2) return;

        const points: {x: number, y: number}[] = [];
        
        agentHistory.forEach((pt, i) => {
            if (i === 0) return; // Need previous point for delta
            const prev = agentHistory[i-1];
            
            // Calculate Delta (Tokens generated since last update)
            const delta = pt.metrics.tokenUsage - prev.metrics.tokenUsage;
            if (delta > globalMaxDelta) globalMaxDelta = delta;

            const x = ((pt.timestamp - startTime) / timeWindow) * 100;
            points.push({ x, y: delta });
        });

        // Extend to "Now" - Drop to zero if no recent activity (Heartbeat effect)
        const lastPt = points[points.length - 1];
        if (lastPt) {
            const currentX = ((now - startTime) / timeWindow) * 100;
            // If the last update was recent (<500ms), hold the value, otherwise drop to 0
            const isRecent = (now - agentHistory[agentHistory.length-1].timestamp) < 500;
            // Add intermediate point for smoother drop-off if needed, but simple drop is okay with bezier
            points.push({ x: currentX, y: isRecent ? lastPt.y : 0 });
        }

        agentDeltas[id] = points;
    });

    // 2. Generate SVG Paths (Smoothed)
    Object.keys(agentDeltas).forEach(id => {
        const points = agentDeltas[id];
        if (points.length === 0) return;

        // Normalize points to screen coordinates
        const screenPoints = points.map(pt => {
             // Normalize Y (0 to globalMax) -> (100 to 0 coords)
             // Use Math.max(globalMaxDelta, 1) to prevent division by zero
             const normalizedY = pt.y / Math.max(globalMaxDelta, 1);
             // Use 90% of height, with 5% padding at bottom
             const y = 100 - (normalizedY * 90) - 5; 
             return { x: pt.x, y };
        });

        paths[id] = getSmoothPath(screenPoints);
    });

    return { paths, minY: 0, maxY: globalMaxDelta };
  }, [history, metrics]);

  return (
    <div className="flex flex-col h-full animate-fade-in">
        {/* Header */}
        <div className="p-5 border-b border-white/5 bg-white/[0.02] backdrop-blur-md sticky top-0 z-10">
            <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-bold text-neurix-500 uppercase tracking-widest">System Monitor</span>
                <span className="w-1.5 h-1.5 rounded-full bg-neurix-success shadow-[0_0_8px_rgba(48,209,88,0.5)]" />
            </div>
            <h2 className="text-base font-bold text-white">Resource Analytics</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar space-y-6">
            
            {/* Total Usage Big Stat */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-neurix-800 to-neurix-900 border border-white/5">
                <span className="block text-[10px] uppercase tracking-wider text-neurix-400 mb-1">Total Token Usage</span>
                <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-mono font-bold text-white">{totalSystemTokens.toLocaleString()}</span>
                    <span className="text-xs text-neurix-500">tks</span>
                </div>
            </div>

            {/* Token Usage Graph */}
            <div>
                 <div className="flex justify-between items-end mb-2">
                    <span className="block text-[10px] uppercase tracking-wider text-neurix-500">Live Velocity (tks/tick)</span>
                    <div className="flex gap-3 text-[9px] font-mono text-neurix-500">
                        <span>PEAK: {Math.round(graphData.maxY)}</span>
                    </div>
                 </div>
                 
                 <div className="h-40 w-full bg-black/40 border border-white/5 rounded-lg relative overflow-hidden">
                     {/* Y-Axis Grid */}
                     <div className="absolute inset-0 flex flex-col justify-between p-2 pointer-events-none opacity-20">
                         <div className="w-full h-px bg-white/20" />
                         <div className="w-full h-px bg-white/20" />
                         <div className="w-full h-px bg-white/20" />
                     </div>

                     {Object.keys(graphData.paths).length > 0 ? (
                         <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                             {Object.entries(graphData.paths).map(([id, d]) => {
                                 // Find agent by ID
                                 const agent = (Object.values(agents) as AgentIdentity[]).find(a => a.id === id);
                                 if (!agent) return null;
                                 
                                 return (
                                     <path 
                                        key={id} 
                                        d={d} 
                                        fill="none" 
                                        stroke={getAgentColorHex(agent.color)} 
                                        strokeWidth="2" 
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        vectorEffect="non-scaling-stroke"
                                        className="transition-all duration-300"
                                     />
                                 );
                             })}
                         </svg>
                     ) : (
                         <div className="absolute inset-0 flex items-center justify-center">
                             <div className="flex flex-col items-center gap-2">
                                <div className="w-full h-[1px] bg-neurix-500/20 w-32"></div>
                                <span className="text-[10px] text-neurix-500/50 uppercase tracking-widest">Awaiting Telemetry...</span>
                             </div>
                         </div>
                     )}
                     
                     {/* Live Indicator Line */}
                     <div className="absolute right-0 top-0 bottom-0 w-px bg-neurix-danger/50 shadow-[0_0_10px_rgba(255,69,58,0.5)]" />
                 </div>
            </div>

            {/* Agent Breakdown Legend */}
            <div>
                <span className="block text-[10px] uppercase tracking-wider text-neurix-500 mb-3">Active Agents</span>
                <div className="space-y-3">
                    {sortedAgents.length === 0 ? (
                        <div className="text-xs text-neurix-600 italic text-center py-4">System Idle</div>
                    ) : sortedAgents.map(agent => {
                        const usage = metrics[agent.id].tokenUsage;
                        const percentage = totalSystemTokens > 0 ? (usage / totalSystemTokens) * 100 : 0;
                        
                        return (
                            <div key={agent.id} className="group">
                                <div className="flex justify-between items-end mb-1">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${agent.color.replace('text-', 'bg-')}`} />
                                        <span className={`text-[10px] font-bold tracking-wide text-neurix-200`}>{agent.name}</span>
                                    </div>
                                    <span className="text-[10px] font-mono text-neurix-300">{usage.toLocaleString()}</span>
                                </div>
                                {/* Bar Background */}
                                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                    {/* Bar Fill */}
                                    <div 
                                        className={`h-full rounded-full transition-all duration-300 ease-out ${agent.color.replace('text-', 'bg-')}`} 
                                        style={{ width: `${percentage}%` }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    </div>
  );
};

export default SystemMonitor;
