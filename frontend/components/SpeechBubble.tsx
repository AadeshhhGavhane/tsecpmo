import React from 'react';
import { Speaker } from '../types';

interface SpeechBubbleProps {
  speaker: Speaker;
  text: string;
  roundInfo?: { current: number; total: number } | null;
  isPlaying: boolean;
  onSkip?: () => void;
}

/**
 * Speech bubble component with skip button.
 */
const SpeechBubble: React.FC<SpeechBubbleProps> = ({
  speaker,
  text,
  roundInfo,
  isPlaying,
  onSkip,
}) => {
  // Styling based on speaker
  let bubbleClasses = "absolute z-20 max-w-[90%] md:max-w-[600px] bg-white border-4 border-black p-6 shadow-[8px_8px_0_rgba(0,0,0,0.5)] left-1/2 -translate-x-1/2 bottom-[8%]";

  if (speaker === Speaker.SUPPORT) {
    bubbleClasses += " border-blue-900";
  } else if (speaker === Speaker.OPPOSE) {
    bubbleClasses += " border-red-900";
  } else if (speaker === Speaker.JUDGE) {
    bubbleClasses += " border-amber-900 bg-[#fff8e1]";
  }

  const label = speaker === Speaker.SUPPORT ? "SUPPORTING COUNSEL" :
    speaker === Speaker.OPPOSE ? "OPPOSING COUNSEL" : "PRESIDING JUDGE";

  const labelColor = speaker === Speaker.SUPPORT ? "text-blue-800" :
    speaker === Speaker.OPPOSE ? "text-red-800" : "text-amber-900";

  return (
    <div className={`${bubbleClasses} font-pixel text-lg md:text-xl leading-relaxed`}>
      {/* Header with skip button */}
      <div className="flex items-center justify-between mb-2">
        <div className={`text-xs font-sans font-bold tracking-widest ${labelColor}`}>
          {label}
        </div>
        <div className="flex items-center gap-2">
          {roundInfo && speaker !== Speaker.JUDGE && (
            <div className="text-xs font-pixel text-slate-500 bg-slate-100 px-2 py-0.5 border border-slate-300">
              ROUND {roundInfo.current}/{roundInfo.total}
            </div>
          )}
          {/* Skip Button - always visible during playback */}
          {onSkip && (
            <button
              onClick={onSkip}
              className="text-xs font-pixel text-slate-600 hover:text-amber-600 
                         bg-slate-200 hover:bg-amber-100 px-3 py-1 
                         border-2 border-slate-400 hover:border-amber-500
                         transition-all duration-200 active:translate-y-0.5"
            >
              SKIP ▶▶
            </button>
          )}
        </div>
      </div>

      {/* Text container */}
      <div className="overflow-hidden" style={{ maxHeight: '5.25em' }}>
        <p className="text-black break-words">
          {text}
          {isPlaying && (
            <span className="inline-block w-2 h-5 ml-1 bg-black align-middle animate-pulse" />
          )}
        </p>
      </div>
    </div>
  );
};

export default SpeechBubble;