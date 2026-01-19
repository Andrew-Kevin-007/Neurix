import React, { useMemo, useState, useRef, useEffect } from 'react';
import { WorkflowStep, StepStatus, ExecutionOverlay, AgentIdentity } from '../types';

interface WorkflowGraphProps {
  steps: WorkflowStep[];
  currentStepId: string | null;
  onStepClick: (step: WorkflowStep) => void;
  executionOverlay?: ExecutionOverlay;
  agents?: Record<string, AgentIdentity>;
}

// Visual Config
const NODE_WIDTH = 240; 
const NODE_HEIGHT = 90;
const RANK_GAP = 300; 
const BRANCH_GAP = 140; 

const styles = `
  /* CORE ANIMATIONS */
  @keyframes draw-line {
    to { stroke-dashoffset: 0; }
  }
  
  .edge-path {
    stroke-dasharray: 1000;
    stroke-dashoffset: 1000;
    animation: draw-line 2s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  }

  @keyframes stream-high-speed {
    to { stroke-dashoffset: -200; }
  }
  
  .stream-line {
    stroke-dasharray: 50 150; /* Short dash, long gap for "packet" look */
    stroke-dashoffset: 0;
    animation: stream-high-speed 1s linear infinite;
  }

  /* Node Entry */
  @keyframes node-pop {
    0% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); filter: blur(10px); }
    70% { opacity: 1; transform: translate(-50%, -50%) scale(1.05); filter: blur(0px); }
    100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  }
  
  .node-enter-active {
    animation: node-pop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  }
  
  /* Scanline Effect */
  @keyframes scan {
    0% { transform: translateY(-100%); opacity: 0; }
    50% { opacity: 0.5; }
    100% { transform: translateY(100%); opacity: 0; }
  }
  .animate-scan {
    animation: scan 2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
  }

  /* Status Pulses */
  @keyframes pulse-red {
    0%, 100% { box-shadow: 0 0 0 0 rgba(255, 69, 58, 0.4); }
    50% { box-shadow: 0 0 20px 0 rgba(255, 69, 58, 0.2); }
  }
  .animate-pulse-red { animation: pulse-red 2s infinite; }

  @keyframes pulse-purple {
    0%, 100% { box-shadow: 0 0 0 0 rgba(168, 85, 247, 0.4); }
    50% { box-shadow: 0 0 20px 0 rgba(168, 85, 247, 0.2); }
  }
  .animate-pulse-purple { animation: pulse-purple 2s infinite; }
`;

const WorkflowGraph: React.FC<WorkflowGraphProps> = ({ steps, currentStepId, onStepClick, executionOverlay = {}, agents = {} }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ x: 0, y: 0, scale: 0.9 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });

  // --- LAYOUT ENGINE ---
  const layout = useMemo(() => {
    if (steps.length === 0) return { nodes: [], edges: [] };

    // 1. Assign Ranks (X-Axis)
    const ranks: Record<string, number> = {};
    const getRank = (id: string, visited = new Set<string>()): number => {
        if (ranks[id] !== undefined) return ranks[id];
        if (visited.has(id)) return 0; // Cycle detected
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

    // 2. Group & Position (Y-Axis)
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
        // Center nodes vertically
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

    // 3. Edges
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

  // Center view on mount
  useEffect(() => {
      if (layout.nodes.length && containerRef.current && steps.length < 3) {
          const { height, width } = containerRef.current.getBoundingClientRect();
          const isMobile = width < 768; // Simple breakdown check
          const minX = Math.min(...layout.nodes.map(n => n.x));
          const maxX = Math.max(...layout.nodes.map(n => n.x));
          const graphWidth = maxX - minX;
          
          setView({ 
              x: width / 2 - minX - (graphWidth/2) + (isMobile ? 0 : 100),
              y: height / 2, 
              scale: isMobile ? 0.55 : 0.9 
          });
      }
  }, [layout.nodes.length === 0]); 

  // Pan to Active Step
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
  
  // Mouse Handlers
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
    <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing bg-neurix-950 overflow-hidden relative touch-none"
         onWheel={handleWheel} 
         onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
         onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
    >
        <style>{styles}</style>
        
        {/* Subtle grid background */}
        <div className="absolute inset-0 opacity-10 pointer-events-none"
             style={{
                 backgroundImage: 'radial-gradient(circle, #333 1px, transparent 1px)',
                 backgroundSize: '40px 40px',
                 transform: `translate(${view.x % 40}px, ${view.y % 40}px) scale(${view.scale})`
             }}
        />

        <div style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`, transition: isDragging ? 'none' : 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)' }} className="w-full h-full transform-gpu origin-top-left">
            
            <svg className="absolute overflow-visible pointer-events-none" style={{ top: 0, left: 0 }}>
                <defs>
                    {/* NEON GLOW FILTERS */}
                    <filter id="glow-active" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="4" result="blur" />
                        <feFlood floodColor="#A855F7" floodOpacity="1" result="color"/>
                        <feComposite in="color" in2="blur" operator="in" result="glow"/>
                        <feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge>
                    </filter>
                    <filter id="glow-success" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="4" result="blur" />
                        <feFlood floodColor="#30D158" floodOpacity="1" result="color"/>
                        <feComposite in="color" in2="blur" operator="in" result="glow"/>
                        <feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge>
                    </filter>
                    <filter id="glow-fail" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="4" result="blur" />
                        <feFlood floodColor="#FF453A" floodOpacity="1" result="color"/>
                        <feComposite in="color" in2="blur" operator="in" result="glow"/>
                        <feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge>
                    </filter>
                </defs>
                
                {layout.edges.map((edge, i) => {
                    const startX = edge.from.x + NODE_WIDTH/2;
                    const endX = edge.to.x - NODE_WIDTH/2;
                    const startY = edge.from.y;
                    const endY = edge.to.y;
                    
                    // Bezier curve
                    const cp1 = startX + (endX - startX) * 0.5;
                    const cp2 = endX - (endX - startX) * 0.5;
                    const d = `M ${startX} ${startY} C ${cp1} ${startY}, ${cp2} ${endY}, ${endX} ${endY}`;
                    
                    // State logic
                    const isRunning = edge.status === StepStatus.RUNNING;
                    const isCompleted = edge.status === StepStatus.COMPLETED;
                    const isFailed = edge.status === StepStatus.FAILED;
                    
                    const strokeColor = isFailed ? "#FF453A" : isCompleted ? "#30D158" : "#A855F7";
                    const filterUrl = isFailed ? "url(#glow-fail)" : isCompleted ? "url(#glow-success)" : "url(#glow-active)";
                    
                    return (
                        <g key={edge.id}>
                            {/* 1. Base Track (Dim, static) */}
                            <path d={d} fill="none" stroke={strokeColor} strokeWidth="1" opacity="0.15" />
                            
                            {/* 2. Active Pulse / Stream Line */}
                            {(isRunning || isCompleted || isFailed) && (
                                <path 
                                      id={`path-${edge.id}`}
                                      d={d} fill="none" 
                                      className={isRunning ? "stream-line" : "edge-path"}
                                      stroke={strokeColor} 
                                      strokeWidth={isRunning ? 2 : 1.5} 
                                      opacity={isFailed ? 0.6 : isRunning ? 1 : 0.4}
                                      filter={isRunning ? filterUrl : ""}
                                />
                            )}
                            
                            {/* 3. COMET PARTICLES (High speed data transfer effect) */}
                            {isRunning && (
                                <g>
                                    {/* Bright White Head */}
                                    <circle r="3" fill="#fff" filter={filterUrl}>
                                        <animateMotion dur="1.2s" repeatCount="indefinite" path={d} keyPoints="0;1" keyTimes="0;1" calcMode="linear" />
                                    </circle>
                                    
                                    {/* Colored Tail (Trailing) */}
                                    <circle r="2" fill={strokeColor} opacity="0.8">
                                        <animateMotion dur="1.2s" repeatCount="indefinite" path={d} begin="-0.08s" keyPoints="0;1" keyTimes="0;1" calcMode="linear" />
                                    </circle>

                                    {/* Fading Tail */}
                                    <circle r="1" fill={strokeColor} opacity="0.4">
                                        <animateMotion dur="1.2s" repeatCount="indefinite" path={d} begin="-0.15s" keyPoints="0;1" keyTimes="0;1" calcMode="linear" />
                                    </circle>
                                </g>
                            )}
                        </g>
                    );
                })}
            </svg>

            {layout.nodes.map((node, index) => {
                const isActive = node.id === currentStepId;
                const isRunning = node.status === StepStatus.RUNNING;
                const isCompleted = node.status === StepStatus.COMPLETED;
                const isFailed = node.status === StepStatus.FAILED;
                const isPending = node.status === StepStatus.PENDING;
                
                const overlay = executionOverlay[node.id];
                const agent = overlay?.assignedAgentId ? agents[overlay.assignedAgentId] : null;

                const modelDisplay = node.executedModel || overlay?.activeModel;

                // Dynamic Styling
                let borderClass = 'border-white/5';
                let bgClass = 'bg-neurix-900/60';
                let glowClass = '';
                
                if (isRunning) {
                    borderClass = 'border-neurix-accent';
                    bgClass = 'bg-neurix-800/90 animate-pulse-purple'; // Pulsing BG
                    glowClass = 'shadow-[0_0_30px_rgba(168,85,247,0.2)]';
                } else if (isCompleted) {
                    borderClass = 'border-neurix-success/30';
                    bgClass = 'bg-neurix-900/40'; 
                } else if (isFailed) {
                    borderClass = 'border-neurix-danger/60';
                    bgClass = 'bg-neurix-danger/10 animate-pulse-red';
                }

                return (
                    <div key={node.id}
                         onClick={(e) => { e.stopPropagation(); onStepClick(node); }}
                         className={`absolute -translate-x-1/2 -translate-y-1/2 w-[240px] h-[90px] group cursor-pointer transition-all duration-500 node-enter-active
                             ${isActive ? 'z-30 scale-105' : 'z-10 scale-100 hover:scale-[1.02]'}
                             ${isPending ? 'opacity-60' : 'opacity-100'}
                             ${isCompleted ? 'grayscale-[0.3]' : ''}
                         `}
                         style={{ 
                             left: node.x, 
                             top: node.y,
                             animationDelay: `${index * 100}ms`
                         }}
                    >
                        {/* Glass Container */}
                        <div className={`
                             w-full h-full rounded-xl border backdrop-blur-md overflow-hidden relative
                             flex flex-col justify-between p-4 transition-all duration-500
                             ${borderClass} ${bgClass} ${glowClass}
                        `}>
                            
                            {/* Active Scanline */}
                            {isRunning && <div className="absolute inset-0 bg-gradient-to-b from-transparent via-neurix-accent/10 to-transparent animate-scan pointer-events-none" />}
                            
                            {/* Header Row */}
                            <div className="flex justify-between items-start z-10">
                                <span className={`text-[9px] font-bold tracking-[0.2em] uppercase mt-1
                                    ${isRunning ? 'text-neurix-accent drop-shadow-[0_0_5px_rgba(168,85,247,0.8)]' : isFailed ? 'text-neurix-danger' : isCompleted ? 'text-neurix-success' : 'text-neurix-500'}
                                `}>
                                    {node.actionType}
                                </span>
                                
                                {agent ? (
                                    <div className={`
                                        flex items-center gap-1.5 px-2 py-0.5 rounded-full border backdrop-blur-md transition-all duration-300
                                        ${isRunning 
                                            ? 'bg-black/60 border-neurix-accent/30 shadow-lg scale-105' 
                                            : 'bg-white/5 border-white/5'
                                        }
                                    `}>
                                        <div className={`w-1.5 h-1.5 rounded-full ${agent.color.replace('text-', 'bg-')} ${isRunning ? 'animate-ping' : ''}`} />
                                        <span className={`text-[8px] font-bold tracking-widest uppercase ${agent.color}`}>
                                            {agent.name}
                                        </span>
                                    </div>
                                ) : (
                                    <span className="text-[8px] font-mono text-white/20">#{node.id.split('-').pop()?.slice(0,4)}</span>
                                )}
                            </div>

                            {/* Label */}
                            <div className={`text-xs font-medium leading-tight z-10 line-clamp-2 mix-blend-screen mt-1 transition-colors
                                ${isFailed ? 'text-red-200' : 'text-white'}
                            `}>
                                {node.label}
                            </div>

                            {/* Footer Row */}
                            <div className="flex justify-between items-end z-10 w-full mt-auto">
                                <div className="flex items-center gap-1.5">
                                    {isFailed && <span className="text-[8px] text-neurix-danger font-bold uppercase tracking-wider">FAILURE</span>}
                                    {isRunning && <span className="text-[8px] text-neurix-accent font-bold uppercase tracking-wider animate-pulse">PROCESSING</span>}
                                    {isCompleted && <span className="text-[8px] text-neurix-success font-bold uppercase tracking-wider">DONE</span>}
                                </div>
                                {modelDisplay && (
                                    <div className="text-[7px] font-mono text-neurix-500 opacity-60 tracking-wider">
                                        {modelDisplay.replace('preview', '').replace('latest', '')}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Status Badges (Floating) */}
                        {isCompleted && (
                             <div className="absolute -top-2 -right-2 w-6 h-6 bg-neurix-900 rounded-full border border-neurix-success/50 flex items-center justify-center shadow-lg z-40 animate-pop-in">
                                 <svg className="w-3.5 h-3.5 text-neurix-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                 </svg>
                             </div>
                        )}
                        {isFailed && (
                             <div className="absolute -top-2 -right-2 w-6 h-6 bg-neurix-900 rounded-full border border-neurix-danger/50 flex items-center justify-center shadow-lg z-40 animate-pop-in">
                                 <svg className="w-3.5 h-3.5 text-neurix-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                                 </svg>
                             </div>
                        )}
                    </div>
                );
            })}
        </div>
    </div>
  );
};

export default WorkflowGraph;