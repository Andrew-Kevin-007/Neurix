
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { WorkflowStep, StepStatus, ExecutionOverlay, AgentIdentity } from '../types';

interface WorkflowGraphProps {
  steps: WorkflowStep[];
  currentStepId: string | null;
  onStepClick: (step: WorkflowStep) => void;
  executionOverlay?: ExecutionOverlay;
  agents?: Record<string, AgentIdentity>;
}

const NODE_WIDTH = 260; 
const NODE_HEIGHT = 100;
const RANK_GAP = 320; 
const BRANCH_GAP = 140; 

const styles = `
  @keyframes dash {
    to { stroke-dashoffset: 0; }
  }
  .edge-path {
    stroke-dasharray: 8, 8;
    stroke-dashoffset: 100;
    animation: dash 30s linear infinite;
  }
  
  @keyframes stream {
    to { stroke-dashoffset: -100; }
  }
  .stream-line {
    stroke-dasharray: 10, 40;
    stroke-dashoffset: 0;
    animation: stream 0.8s linear infinite;
  }

  .node-wrapper {
    transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease;
  }
`;

const WorkflowGraph: React.FC<WorkflowGraphProps> = ({ steps, currentStepId, onStepClick, executionOverlay = {}, agents = {} }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ x: 0, y: 0, scale: 0.9 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });

  // --- LAYOUT ENGINE ---
  const layout = useMemo(() => {
    if (steps.length === 0) return { nodes: [], edges: [] };

    const ranks: Record<string, number> = {};
    const getRank = (id: string, visited = new Set<string>()): number => {
        if (ranks[id] !== undefined) return ranks[id];
        if (visited.has(id)) return 0; 
        visited.add(id);
        const step = steps.find(s => s.id === id);
        if (!step || step.dependencies.length === 0) {
            ranks[id] = 0; return 0;
        }
        const maxDepRank = Math.max(...step.dependencies.map(d => getRank(d, new Set(visited))));
        ranks[id] = maxDepRank + 1;
        return maxDepRank + 1;
    };
    steps.forEach(s => getRank(s.id));

    const nodesByRank: Record<number, WorkflowStep[]> = {};
    steps.forEach(s => {
        const r = ranks[s.id];
        if (!nodesByRank[r]) nodesByRank[r] = [];
        nodesByRank[r].push(s);
    });

    const nodes: any[] = [];
    Object.keys(nodesByRank).sort((a,b) => Number(a)-Number(b)).forEach(rankStr => {
        const rank = Number(rankStr);
        const rankNodes = nodesByRank[rank];
        const totalHeight = (rankNodes.length - 1) * BRANCH_GAP;
        const startY = -totalHeight / 2;
        
        rankNodes.forEach((node, i) => {
            nodes.push({
                ...node,
                x: rank * RANK_GAP,
                y: startY + i * BRANCH_GAP
            });
        });
    });

    const edges = [];
    steps.forEach(s => {
        const targetNode = nodes.find(n => n.id === s.id);
        s.dependencies.forEach(depId => {
            const sourceNode = nodes.find(n => n.id === depId);
            if (sourceNode && targetNode) {
                edges.push({ 
                    id: `${sourceNode.id}-${targetNode.id}`,
                    from: sourceNode, 
                    to: targetNode, 
                    status: s.status,
                    sourceStatus: sourceNode.status 
                });
            }
        });
    });

    return { nodes, edges };
  }, [steps]);

  // Center graph logic
  const centerGraph = () => {
      if (layout.nodes.length && containerRef.current) {
          const { width, height } = containerRef.current.getBoundingClientRect();
          const isMobile = width < 768; 
          const minX = Math.min(...layout.nodes.map(n => n.x));
          const maxX = Math.max(...layout.nodes.map(n => n.x));
          const graphWidth = maxX - minX;
          
          setView({ 
              x: width / 2 - minX - (graphWidth/2) + (isMobile ? 0 : 50),
              y: height / 2, 
              scale: isMobile ? 0.55 : 0.9 
          });
      }
  };

  // Initial Center
  useEffect(() => {
     if (steps.length < 3) centerGraph();
  }, [layout.nodes.length === 0]); 

  // Responsive Resize Listener
  useEffect(() => {
      window.addEventListener('resize', centerGraph);
      return () => window.removeEventListener('resize', centerGraph);
  }, [layout.nodes]);

  useEffect(() => {
    if (currentStepId && layout.nodes.length) {
        const activeNode = layout.nodes.find(n => n.id === currentStepId);
        if (activeNode && containerRef.current) {
            const { width, height } = containerRef.current.getBoundingClientRect();
            setView(v => ({
                ...v,
                x: (width / 2) - (activeNode.x * v.scale),
                y: (height / 2) - (activeNode.y * v.scale),
            }));
        }
    }
  }, [currentStepId]);

  const handleWheel = (e: React.WheelEvent) => setView(v => ({ ...v, scale: Math.max(0.2, Math.min(2, v.scale - e.deltaY * 0.001)) }));
  
  const handleMouseDown = (e: React.MouseEvent) => { setIsDragging(true); setLastPos({ x: e.clientX, y: e.clientY }); };
  const handleMouseMove = (e: React.MouseEvent) => {
      if(isDragging) {
          setView(v => ({ ...v, x: v.x + e.clientX - lastPos.x, y: v.y + e.clientY - lastPos.y }));
          setLastPos({ x: e.clientX, y: e.clientY });
      }
  };
  const handleMouseUp = () => setIsDragging(false);
  const handleTouchStart = (e: React.TouchEvent) => {
      if (e.touches.length === 1) {
          setIsDragging(true);
          setLastPos({ x: e.touches[0].clientX, y: e.touches[0].clientY });
      }
  };
  const handleTouchMove = (e: React.TouchEvent) => {
      if (isDragging && e.touches.length === 1) {
          const touch = e.touches[0];
          setView(v => ({ ...v, x: v.x + touch.clientX - lastPos.x, y: v.y + touch.clientY - lastPos.y }));
          setLastPos({ x: touch.clientX, y: touch.clientY });
      }
  };
  const handleTouchEnd = () => setIsDragging(false);

  return (
    <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing overflow-hidden relative touch-none bg-transparent"
         onWheel={handleWheel} 
         onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
         onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
    >
        <style>{styles}</style>
        
        <div style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`, transition: isDragging ? 'none' : 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }} className="w-full h-full transform-gpu origin-top-left">
            
            <svg className="absolute overflow-visible pointer-events-none" style={{ top: 0, left: 0 }}>
                {layout.edges.map((edge) => {
                    const startX = edge.from.x + NODE_WIDTH/2 - 10;
                    const endX = edge.to.x - NODE_WIDTH/2 + 10;
                    const startY = edge.from.y;
                    const endY = edge.to.y;
                    
                    const cp1 = startX + (endX - startX) * 0.55;
                    const cp2 = endX - (endX - startX) * 0.55;
                    const d = `M ${startX} ${startY} C ${cp1} ${startY}, ${cp2} ${endY}, ${endX} ${endY}`;
                    
                    const isRunning = edge.status === StepStatus.RUNNING;
                    const isCompleted = edge.status === StepStatus.COMPLETED;
                    const isFailed = edge.status === StepStatus.FAILED;
                    
                    const color = isFailed ? "#EF4444" : isCompleted ? "#34D399" : "#8B5CF6";
                    
                    return (
                        <g key={edge.id}>
                            <path d={d} fill="none" stroke={color} strokeWidth="1" opacity="0.1" />
                            {(isRunning || isCompleted) && (
                                <path d={d} fill="none" className={isRunning ? "stream-line" : "edge-path"} stroke={color} strokeWidth={isRunning ? 2 : 1} opacity={isRunning ? 1 : 0.4} />
                            )}
                            {isRunning && (
                                <circle r="2" fill="#fff">
                                    <animateMotion dur="0.8s" repeatCount="indefinite" path={d} keyPoints="0;1" keyTimes="0;1" calcMode="linear" />
                                </circle>
                            )}
                        </g>
                    );
                })}
            </svg>

            {layout.nodes.map((node) => {
                const isActive = node.id === currentStepId;
                const isRunning = node.status === StepStatus.RUNNING;
                const isCompleted = node.status === StepStatus.COMPLETED;
                const isFailed = node.status === StepStatus.FAILED;
                const isPending = node.status === StepStatus.PENDING;
                const isWaiting = node.status === StepStatus.WAITING_FOR_APPROVAL;
                const isIntegration = node.actionType === 'INTEGRATION';
                
                const overlay = executionOverlay[node.id];
                const agent = overlay?.assignedAgentId ? agents[overlay.assignedAgentId] : null;

                // Determine active model to display (from overlay if running, or from history if completed)
                const activeModel = overlay?.activeModel || node.executedModel;

                // Color Scheme Logic
                let mainColor = 'border-neurix-800';
                let textColor = 'text-neurix-400';
                let shadow = '';
                
                if (isRunning) {
                   mainColor = 'border-neurix-accent';
                   textColor = 'text-neurix-100';
                   shadow = 'shadow-glow';
                } else if (isWaiting) {
                   mainColor = 'border-orange-500';
                   textColor = 'text-orange-400';
                   shadow = 'shadow-[0_0_15px_rgba(249,115,22,0.3)]';
                } else if (isFailed) {
                   mainColor = 'border-red-500';
                   textColor = 'text-red-400';
                } else if (isCompleted) {
                   mainColor = 'border-emerald-500/50';
                   textColor = 'text-emerald-400';
                } else if (isIntegration) {
                   mainColor = 'border-orange-500/40';
                   textColor = 'text-orange-300';
                }

                return (
                    <div key={node.id}
                         onClick={(e) => { e.stopPropagation(); onStepClick(node); }}
                         className={`absolute -translate-x-1/2 -translate-y-1/2 node-wrapper
                             ${isActive ? 'z-30 scale-105' : 'z-10 scale-100 hover:scale-[1.02]'}
                             ${isPending ? 'opacity-50 grayscale-[0.5]' : 'opacity-100'}
                         `}
                         style={{ left: node.x, top: node.y, width: NODE_WIDTH, height: NODE_HEIGHT }}
                    >
                        {/* HUD Node Container */}
                        <div className={`
                             w-full h-full relative bg-neurix-900/80 backdrop-blur-md transition-all duration-300
                             flex flex-col justify-between p-4 group
                             ${shadow}
                        `}>
                            {/* Tech Borders (Corners) */}
                            <div className={`absolute top-0 left-0 w-3 h-3 border-t border-l ${mainColor} transition-colors`} />
                            <div className={`absolute top-0 right-0 w-3 h-3 border-t border-r ${mainColor} transition-colors`} />
                            <div className={`absolute bottom-0 left-0 w-3 h-3 border-b border-l ${mainColor} transition-colors`} />
                            <div className={`absolute bottom-0 right-0 w-3 h-3 border-b border-r ${mainColor} transition-colors`} />
                            
                            {/* Inner Border (Subtle) */}
                            <div className="absolute inset-1 border border-white/5 pointer-events-none" />

                            {/* Header */}
                            <div className="flex justify-between items-start z-10">
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-mono text-neurix-500 uppercase tracking-widest">
                                        {node.id.split('-').pop()?.slice(0,4)}
                                    </span>
                                    <span className={`text-[10px] font-bold uppercase tracking-wider ${textColor} mt-0.5`}>
                                        {node.actionType} {node.toolId ? `:: ${node.toolId.toUpperCase()}` : ''}
                                    </span>
                                </div>
                                {agent && (
                                    <div className={`flex items-center gap-1.5 px-2 py-0.5 bg-white/5 border border-white/5 rounded text-[8px] font-bold tracking-wide uppercase ${agent.color}`}>
                                        {agent.name}
                                    </div>
                                )}
                            </div>

                            {/* Label */}
                            <div className={`text-xs font-medium leading-snug z-10 line-clamp-2 ${isCompleted ? 'text-neurix-400' : 'text-neurix-100'}`}>
                                {node.label}
                            </div>

                            {/* Model Badge (Auto-Switching Indicator) */}
                            {activeModel && (
                                <div className="absolute bottom-2 right-4 z-10">
                                    <div className="flex items-center gap-1 opacity-70">
                                        <div className="w-1 h-1 rounded-full bg-neurix-500"></div>
                                        <span className="text-[8px] font-mono uppercase tracking-tight text-neurix-400">
                                            {activeModel.replace('gemini-', '').replace('-preview', '').replace('-latest', '').replace('image', 'IMG')}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Active Indicator Bar */}
                            {(isRunning || isWaiting) && (
                                <div className={`absolute bottom-0 left-1 right-1 h-0.5 ${isWaiting ? 'bg-orange-500 animate-pulse' : 'bg-neurix-accent animate-pulse-slow'}`} />
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    </div>
  );
};

export default WorkflowGraph;
