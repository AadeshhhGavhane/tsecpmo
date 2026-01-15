import React, { useMemo } from 'react';
import { CourtroomBackground } from './PixelAssets';
import SpeechBubble from './SpeechBubble';
import { Speaker, Factor } from '../types';

const MAX_VISIBLE_LINES = 3;
const CHARS_PER_LINE = 80;

interface CourtroomProps {
  currentSpeaker: Speaker;
  displayedText: string;
  isLoading: boolean;
  currentFactor?: Factor | null;
  roundInfo?: { current: number; total: number } | null;
  isAudioPlaying: boolean;
  onSkip?: () => void;
}

const Courtroom: React.FC<CourtroomProps> = ({
  currentSpeaker,
  displayedText,
  isLoading,
  currentFactor,
  roundInfo,
  isAudioPlaying,
  onSkip,
}) => {
  // Only show animated background when audio is actually playing
  const showAnimatedBackground = isAudioPlaying && currentSpeaker !== Speaker.NONE;

  // Calculate visible text (last 3 lines)
  const visibleText = useMemo(() => {
    const totalChars = displayedText.length;
    const maxChars = MAX_VISIBLE_LINES * CHARS_PER_LINE;

    if (totalChars <= maxChars) {
      return displayedText;
    }

    const startIndex = totalChars - maxChars;
    const nextSpace = displayedText.indexOf(' ', startIndex);

    if (nextSpace !== -1 && nextSpace < startIndex + 20) {
      return '...' + displayedText.slice(nextSpace + 1);
    }

    return '...' + displayedText.slice(startIndex);
  }, [displayedText]);

  return (
    <div className="relative w-full h-full bg-neutral-800 overflow-hidden select-none border-b-4 border-slate-900">
      {/* Background Layer */}
      <CourtroomBackground
        currentSpeaker={showAnimatedBackground ? currentSpeaker : Speaker.NONE}
      />

      {/* Grid Overlay for Retro Feel */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-10 pointer-events-none bg-[length:100%_4px,6px_100%]"></div>

      {/* Factor Info Banner - CENTERED */}
      {currentFactor && showAnimatedBackground && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-15 pointer-events-none">
          <div className="bg-slate-900/80 border-4 border-amber-600 px-8 py-4
                          font-pixel text-amber-400 text-center
                          shadow-[6px_6px_0_rgba(0,0,0,0.5)] animate-pulse">
            <div className="text-amber-600 text-xs mb-1 tracking-widest">NOW DEBATING</div>
            <div className="text-amber-400 text-lg md:text-xl">{currentFactor.name}</div>
          </div>
        </div>
      )}

      {/* Speech Bubble */}
      {showAnimatedBackground && visibleText && (
        <SpeechBubble
          speaker={currentSpeaker}
          text={visibleText}
          roundInfo={roundInfo}
          isPlaying={isAudioPlaying}
          onSkip={onSkip}
        />
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="text-center">
            <div className="text-white font-pixel text-2xl animate-pulse mb-4">
              {'>'} ANALYZING EVIDENCE...
            </div>
            <div className="text-slate-400 font-pixel text-sm">
              The court is reviewing the document
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Courtroom;
