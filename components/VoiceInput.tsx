
import React, { useState, useEffect, useRef } from 'react';

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  isProcessing: boolean;
}

// Extend Window interface for WebkitSpeechRecognition
declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

const VoiceInput: React.FC<VoiceInputProps> = ({ onTranscript, isProcessing }) => {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Browser compatibility check
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onstart = () => {
        setIsListening(true);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0])
          .map((result) => result.transcript)
          .join('');
        
        if (event.results[0].isFinal) {
            onTranscript(transcript);
        }
      };
      
      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsListening(false);
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [onTranscript]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
        alert("Voice input is not supported in this browser. Try Chrome.");
        return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  };

  return (
    <button 
        onClick={toggleListening}
        disabled={isProcessing}
        className={`
            w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-300 relative group
            ${isListening 
                ? 'bg-neurix-danger text-white shadow-[0_0_15px_rgba(239,68,68,0.5)]' 
                : 'bg-white/5 hover:bg-white/10 text-neurix-400 hover:text-white'
            }
            ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        title={isListening ? "Listening..." : "Voice Input"}
    >
        {/* Pulse Ring Animation when Listening */}
        {isListening && (
            <span className="absolute inset-0 rounded-xl bg-neurix-danger opacity-75 animate-ping"></span>
        )}

        {isListening ? (
             // Waveform Icon
             <div className="flex gap-0.5 items-center h-4">
                 <div className="w-1 bg-white rounded-full animate-[pulse_0.6s_ease-in-out_infinite] h-2"></div>
                 <div className="w-1 bg-white rounded-full animate-[pulse_0.6s_ease-in-out_0.2s_infinite] h-4"></div>
                 <div className="w-1 bg-white rounded-full animate-[pulse_0.6s_ease-in-out_0.4s_infinite] h-2"></div>
             </div>
        ) : (
            // Mic Icon
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
        )}
    </button>
  );
};

export default VoiceInput;
