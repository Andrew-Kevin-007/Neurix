
import React, { useState } from 'react';
import { Artifact } from '../types';

interface ArtifactsPanelProps {
  artifacts: Artifact[];
}

const ArtifactsPanel: React.FC<ArtifactsPanelProps> = ({ artifacts }) => {
  const [previewArtifact, setPreviewArtifact] = useState<Artifact | null>(null);

  const handleDownload = (artifact: Artifact) => {
      let content = artifact.content;
      let mimeType = 'text/plain';
      let extension = 'txt';

      if (artifact.type === 'IMAGE') {
          const link = document.createElement('a');
          link.href = content;
          link.download = artifact.title || `generated-image-${artifact.id}.png`;
          link.click();
          return;
      }

      if (artifact.type === 'CODE') {
          extension = artifact.language || 'txt';
          if (extension === 'python') extension = 'py';
          if (extension === 'javascript') extension = 'js';
          if (extension === 'typescript') extension = 'ts';
          if (extension === 'html') extension = 'html';
          
          if (extension === 'html') mimeType = 'text/html';
      }

      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${artifact.title.replace(/\s+/g, '_')}.${extension}`;
      link.click();
      URL.revokeObjectURL(url);
  };

  const getIcon = (type: Artifact['type']) => {
      switch(type) {
          case 'CODE': return (
            <svg className="w-4 h-4 text-neurix-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
          );
          case 'IMAGE': return (
            <svg className="w-4 h-4 text-fuchsia-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          );
          case 'DOCUMENT': return (
            <svg className="w-4 h-4 text-neurix-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          );
          default: return (
            <svg className="w-4 h-4 text-neurix-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
          );
      }
  };

  const isPreviewable = (artifact: Artifact) => {
    // Treat unknown language text as potential HTML if it starts with <
    if (artifact.type === 'CODE' && artifact.content.trim().startsWith('<!DOCTYPE html>')) return true;
    return artifact.type === 'CODE' && (artifact.language === 'html' || artifact.language === 'javascript');
  };

  return (
    <>
    <div className="flex flex-col h-full animate-fade-in relative">
        <div className="p-5 border-b border-white/5 bg-white/[0.02] backdrop-blur-md sticky top-0 z-10 flex justify-between items-center">
            <div>
                <span className="text-[9px] font-bold text-neurix-500 uppercase tracking-widest block mb-1">Project Files</span>
                <h2 className="text-sm font-bold text-white">Artifacts</h2>
            </div>
            <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full text-white font-mono">{artifacts.length}</span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {artifacts.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-neurix-500/30 gap-3">
                    <svg className="w-8 h-8 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" /></svg>
                    <span className="text-[10px] uppercase tracking-widest">No Artifacts Generated</span>
                </div>
            ) : (
                artifacts.map(artifact => (
                    <div key={artifact.id} className="group p-3 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all">
                        <div className="flex items-start gap-3">
                            <div className="p-2 rounded bg-black/40 border border-white/5 shrink-0">
                                {getIcon(artifact.type)}
                            </div>
                            <div className="min-w-0 flex-1">
                                <h3 className="text-xs font-bold text-neurix-200 truncate group-hover:text-white transition-colors">{artifact.title}</h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[9px] font-mono text-neurix-500 uppercase">{artifact.type}</span>
                                    {artifact.language && <span className="text-[9px] font-mono text-neurix-500 px-1 rounded bg-white/5">{artifact.language}</span>}
                                    <span className="text-[9px] text-neurix-600">•</span>
                                    <span className="text-[9px] text-neurix-600">{new Date(artifact.timestamp).toLocaleTimeString()}</span>
                                </div>
                            </div>
                            <div className="flex gap-1">
                                {isPreviewable(artifact) && (
                                    <button 
                                        onClick={() => setPreviewArtifact(artifact)}
                                        className="p-2 rounded hover:bg-white/10 text-neurix-accent hover:text-white transition-colors"
                                        title="Live Preview"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                    </button>
                                )}
                                <button 
                                    onClick={() => handleDownload(artifact)}
                                    className="p-2 rounded hover:bg-white/10 text-neurix-500 hover:text-white transition-colors"
                                    title="Download"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                </button>
                            </div>
                        </div>
                        {artifact.type === 'CODE' && (
                            <div className="mt-3 p-2 bg-black/50 rounded border border-white/5 overflow-hidden">
                                <pre className="text-[9px] font-mono text-neurix-400 line-clamp-3 leading-relaxed opacity-80">
                                    {artifact.content}
                                </pre>
                            </div>
                        )}
                        {artifact.type === 'IMAGE' && (
                             <div className="mt-3 rounded border border-white/5 overflow-hidden relative h-24 bg-black/50">
                                 <img src={artifact.content} alt={artifact.title} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                             </div>
                        )}
                    </div>
                ))
            )}
        </div>
    </div>

    {/* PREVIEW MODAL */}
    {previewArtifact && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur flex items-center justify-center p-4 sm:p-8 animate-fade-in">
            <div className="w-full h-full max-w-6xl bg-neurix-900 border border-white/10 rounded-2xl flex flex-col shadow-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-white/10 flex justify-between items-center bg-black/20">
                    <div className="flex items-center gap-3">
                         <div className="p-1.5 rounded bg-neurix-accent/10 border border-neurix-accent/20">
                            <svg className="w-4 h-4 text-neurix-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                         </div>
                         <div>
                            <h3 className="text-sm font-bold text-white">Browser Verification Runtime</h3>
                            <p className="text-[10px] text-neurix-500 font-mono">Running: {previewArtifact.title}</p>
                         </div>
                    </div>
                    <button onClick={() => setPreviewArtifact(null)} className="p-2 rounded hover:bg-white/10 text-neurix-500 hover:text-white transition-colors">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <div className="flex-1 bg-white relative">
                    <iframe 
                        className="w-full h-full border-0"
                        srcDoc={previewArtifact.content}
                        title="Live Preview"
                        sandbox="allow-scripts"
                    />
                </div>
                <div className="px-4 py-2 bg-neurix-900 border-t border-white/10 text-[10px] text-neurix-500 font-mono flex justify-between">
                     <span>Sandboxed Execution Environment</span>
                     <span>V8 Engine Active</span>
                </div>
            </div>
        </div>
    )}
    </>
  );
};

export default ArtifactsPanel;
