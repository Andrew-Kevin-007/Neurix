import React from 'react';
import { AgentState } from '../types';

interface AgentStatusProps {
  state: AgentState;
}

const AgentStatusDisplay: React.FC<AgentStatusProps> = ({ state }) => {
  const getStatusConfig = () => {
    switch (state) {
      case AgentState.PLANNING:
        return { text: 'Generating Workflow', color: 'text-white', bg: 'bg-neurix-accent' };
      case AgentState.EXECUTING:
        return { text: 'Executing', color: 'text-white', bg: 'bg-neurix-success' };
      case AgentState.REVIEW_PLAN:
        return { text: 'Waiting for Approval', color: 'text-black', bg: 'bg-neurix-warning' };
      case AgentState.FAILED:
        return { text: 'System Failure', color: 'text-white', bg: 'bg-neurix-danger' };
      case AgentState.COMPLETED:
        return { text: 'Mission Accomplished', color: 'text-white', bg: 'bg-neurix-success' };
      case AgentState.MAINTENANCE:
        return { text: 'Maintenance Mode', color: 'text-white', bg: 'bg-fuchsia-600' };
      case AgentState.PAUSED:
          return { text: 'Paused', color: 'text-white', bg: 'bg-neurix-400' };
      default:
        return { text: 'Ready', color: 'text-neurix-300', bg: 'bg-neurix-700' };
    }
  };

  const config = getStatusConfig();

  return (
    <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-full border border-white/5 shadow-sm transition-all duration-300 ${state === AgentState.INIT ? 'bg-neurix-800' : config.bg}`}>
      {(state === AgentState.PLANNING || state === AgentState.EXECUTING) && (
         <div className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
         </div>
      )}
      {(state === AgentState.MAINTENANCE) && (
         <div className="relative flex h-2 w-2">
            <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-white opacity-40"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
         </div>
      )}
      <span className={`font-medium text-[11px] tracking-wide ${config.color}`}>
        {config.text}
      </span>
    </div>
  );
};

export default AgentStatusDisplay;