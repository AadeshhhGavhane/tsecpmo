import React, { useState, useCallback, useRef, useEffect } from 'react';
import Courtroom from './components/Courtroom';
import {
  startAnalysis,
  createFactorAnnouncementStep,
  createFactorStartStep,
  createSupportStep,
  createOpposeStep,
  createVerdictStep,
  generateDebateMarkdown,
  downloadPdf,
  preprocessPdf,
  AnalysisSession,
} from './services/backendService';
import { generateSpeechForTurn, AudioGenerationResult, revokeAudioUrl } from './services/audioService';
import { AppState, DialogueStep, Speaker, WordTimestamp, Factor, DebateTurn, Synthesis } from './types';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [selectedRounds, setSelectedRounds] = useState<number>(2);
  const [transcript, setTranscript] = useState<DialogueStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(-1);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Current display text for speech bubble
  const [displayedText, setDisplayedText] = useState<string>('');
  const [currentSpeaker, setCurrentSpeaker] = useState<Speaker>(Speaker.NONE);
  const [isAudioPlaying, setIsAudioPlaying] = useState<boolean>(false);

  // Factor tracking
  const [allFactors, setAllFactors] = useState<Factor[]>([]);
  const [currentFactorIndex, setCurrentFactorIndex] = useState<number>(-1);
  const [completedFactorIds, setCompletedFactorIds] = useState<Set<string>>(new Set());
  const [roundInfo, setRoundInfo] = useState<{ current: number; total: number } | null>(null);

  // Synthesis storage for download
  const [finalSynthesis, setFinalSynthesis] = useState<Synthesis | null>(null);

  // Audio data cache and refs
  const audioDataRef = useRef<Map<number, AudioGenerationResult>>(new Map());
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const currentTimestampsRef = useRef<WordTimestamp[] | null>(null);

  // Turn queue for real-time processing
  const turnQueueRef = useRef<DialogueStep[]>([]);
  const transcriptRef = useRef<DialogueStep[]>([]);
  const isProcessingRef = useRef<boolean>(false);
  const isFetchingTTSRef = useRef<boolean>(false);
  const sessionRef = useRef<AnalysisSession | null>(null);
  const factorIndexRef = useRef<number>(0);
  const allFactorsRef = useRef<Factor[]>([]);
  const finishCurrentStepRef = useRef<() => void>(() => { });

  // Keep refs in sync
  useEffect(() => {
    allFactorsRef.current = allFactors;
  }, [allFactors]);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  // Cleanup audio
  const cleanupAudio = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.onplay = null;
      audioElementRef.current.onended = null;
      audioElementRef.current.onerror = null;
      audioElementRef.current.ontimeupdate = null;
      audioElementRef.current = null;
    }
    currentTimestampsRef.current = null;
  }, []);

  // Generate TTS for a step
  const generateTTS = async (step: DialogueStep, index: number): Promise<AudioGenerationResult | null> => {
    if (audioDataRef.current.has(index)) {
      return audioDataRef.current.get(index)!;
    }

    if (isFetchingTTSRef.current) {
      // Wait for current fetch to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      if (audioDataRef.current.has(index)) {
        return audioDataRef.current.get(index)!;
      }
    }

    try {
      isFetchingTTSRef.current = true;
      console.log(`Generating TTS for turn ${index}`);
      const result = await generateSpeechForTurn(step.text, step.speaker);
      audioDataRef.current.set(index, result);
      isFetchingTTSRef.current = false;
      return result;
    } catch (error) {
      console.error(`Failed to generate TTS for turn ${index}:`, error);
      isFetchingTTSRef.current = false;
      return null;
    }
  };

  // Prefetch upcoming TTS in background
  const prefetchTTS = useCallback(async (startIndex: number) => {
    const allSteps = [...transcriptRef.current, ...turnQueueRef.current];
    for (let i = startIndex; i < Math.min(allSteps.length, startIndex + 2); i++) {
      if (!audioDataRef.current.has(i) && allSteps[i]) {
        await generateTTS(allSteps[i], i);
      }
    }
  }, []);

  // Play audio for current step with text sync
  const playStepAudio = useCallback(async (stepIndex: number, step: DialogueStep) => {
    console.log(`[App] playStepAudio called for step ${stepIndex}`);
    cleanupAudio();

    setCurrentSpeaker(step.speaker);
    setDisplayedText('');
    setIsAudioPlaying(true);

    // Update factor info... (omitted for brevity in replacement if unchanged, but I must replace the whole block if I want to be safe)
    // Actually, I can just replace the start of the function and the fallback part.
    // Let's replace the top part until the fallback.

    // Update factor info
    if (step.factorInfo) {
      const factorIdx = allFactorsRef.current.findIndex(f => f.id === step.factorInfo!.factorId);
      if (factorIdx !== -1) {
        setCurrentFactorIndex(factorIdx);
      }
      if (step.factorInfo.roundNumber && step.factorInfo.totalRounds) {
        setRoundInfo({ current: step.factorInfo.roundNumber, total: step.factorInfo.totalRounds });
      } else {
        setRoundInfo(null);
      }
    } else {
      setRoundInfo(null);
    }

    // Handle special step types that don't need audio
    if (step.stepType === 'factor-complete' && step.factorInfo) {
      console.log(`[App] Processing factor completion for ${step.factorInfo.factorId}`);
      setCompletedFactorIds(prev => new Set([...prev, step.factorInfo!.factorId]));
      // Clean up audio
      cleanupAudio();
      setDisplayedText(''); // Clear text or show "Factor concluded"

      // Wait briefly then move on
      setTimeout(() => {
        finishCurrentStepRef.current();
      }, 500);
      return;
    }

    // Get or generate TTS
    let audioData = audioDataRef.current.get(stepIndex);
    if (!audioData) {
      console.log(`[App] No cached audio for step ${stepIndex}, generating...`);
      audioData = await generateTTS(step, stepIndex);
    }

    if (!audioData || !audioData.timestamps || audioData.timestamps.length === 0) {
      console.warn(`[App] TTS failed or no timestamps for step ${stepIndex}. Using fallback.`);
      // Fallback: show all text without audio
      setDisplayedText(step.text);
      setTimeout(() => {
        finishCurrentStepRef.current();
      }, 3000);
      return;
    }

    console.log(`[App] Audio ready for step ${stepIndex}, playing...`);

    // Start prefetching next turns
    prefetchTTS(stepIndex + 1);

    // Create and play audio
    const audio = new Audio(audioData.audioUrl);
    audioElementRef.current = audio;
    currentTimestampsRef.current = audioData.timestamps;

    const syncText = () => {
      if (!audioElementRef.current || !currentTimestampsRef.current) return;

      const currentTime = audioElementRef.current.currentTime;
      const timestamps = currentTimestampsRef.current;

      // Build text up to current time
      let text = '';
      for (let i = 0; i < timestamps.length; i++) {
        if (currentTime >= timestamps[i].start_time) {
          const word = timestamps[i].word;
          const isPunctuation = /^[.,!?;:'")\\]]$/.test(word);
          if (i > 0 && !isPunctuation) {
            text += ' ';
          }
          text += word;
        } else {
          break;
        }
      }

      setDisplayedText(text);

      if (!audioElementRef.current.paused && !audioElementRef.current.ended) {
        animationFrameRef.current = requestAnimationFrame(syncText);
      }
    };

    audio.onplay = () => {
      syncText();
    };

    audio.onended = () => {
      // Show full text
      const timestamps = currentTimestampsRef.current;
      if (timestamps) {
        let fullText = '';
        for (let i = 0; i < timestamps.length; i++) {
          const word = timestamps[i].word;
          const isPunctuation = /^[.,!?;:'")\\]]$/.test(word);
          if (i > 0 && !isPunctuation) {
            fullText += ' ';
          }
          fullText += word;
        }
        setDisplayedText(fullText);
      }

      cleanupAudio();

      // Wait briefly then move to next
      setTimeout(() => {
        finishCurrentStepRef.current();
      }, 600);
    };

    audio.onerror = () => {
      console.error('Audio playback error');
      setDisplayedText(step.text);
      cleanupAudio();
      setTimeout(() => {
        finishCurrentStepRef.current();
      }, 2000);
    };

    // Play
    try {
      await audio.play();
    } catch (err) {
      console.error('Failed to play audio:', err);
      setDisplayedText(step.text);
      cleanupAudio();
      setTimeout(() => {
        finishCurrentStepRef.current();
      }, 2000);
    }
  }, [cleanupAudio, prefetchTTS]);

  // Finish current step and move to next
  const finishCurrentStep = useCallback(() => {
    setIsAudioPlaying(false);
    setCurrentSpeaker(Speaker.NONE);
    isProcessingRef.current = false;

    // Process next turn if available
    if (turnQueueRef.current.length > 0) {
      setTimeout(() => processNextTurn(), 200);
    } else {
      // Check if we're done
      setTimeout(() => {
        if (turnQueueRef.current.length > 0) {
          processNextTurn();
        } else if (finalSynthesis) {
          console.log('[App] Finished! Showing synthesis.');
          setAppState(AppState.FINISHED);
          setCurrentFactorIndex(-1);
        }
      }, 1000);
    }
  }, [finalSynthesis]); // Keep explicit dependency here

  // Keep ref in sync
  useEffect(() => {
    finishCurrentStepRef.current = finishCurrentStep;
  }, [finishCurrentStep]);

  // Handle skip button - show full text, stop audio, advance after 2 seconds
  const handleSkip = useCallback(() => {
    console.log('Skip clicked - showing full text and advancing after 2s');

    // Get current step and show full text
    const currentStep = transcriptRef.current[currentStepIndex];
    if (currentStep) {
      setDisplayedText(currentStep.text);
    }

    // Stop audio but keep speaker visible
    cleanupAudio();

    // Wait 2 seconds then advance to next turn
    setTimeout(() => {
      finishCurrentStepRef.current();
    }, 2000);
  }, [currentStepIndex, cleanupAudio]);

  // Process the next turn in the queue
  const processNextTurn = useCallback(() => {
    if (isProcessingRef.current) return;
    if (turnQueueRef.current.length === 0) return;

    isProcessingRef.current = true;

    const nextStep = turnQueueRef.current.shift()!;

    // Add to transcript
    const newTranscript = [...transcriptRef.current, nextStep];
    setTranscript(newTranscript);
    transcriptRef.current = newTranscript;

    const newIndex = newTranscript.length - 1;
    setCurrentStepIndex(newIndex);
    setAppState(AppState.PLAYING);

    // Play this step
    playStepAudio(newIndex, nextStep);
  }, [playStepAudio]);

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    let file = e.target.files?.[0];
    if (!file) return;

    // Check if PDF and preprocess via multimodal server
    if (file.name.toLowerCase().endsWith('.pdf')) {
      console.log('PDF detected, preprocessing via multimodal server...');
      setAppState(AppState.ANALYZING);
      setErrorMsg(null);
      try {
        file = await preprocessPdf(file);
        console.log('PDF converted to markdown:', file.name);
      } catch (err) {
        console.error('PDF preprocessing failed:', err);
        setAppState(AppState.ERROR);
        setErrorMsg('Failed to process PDF. Please ensure the multimodal server is running.');
        return;
      }
    }

    // Reset all state
    cleanupAudio();
    setAppState(AppState.ANALYZING);
    setErrorMsg(null);
    setTranscript([]);
    transcriptRef.current = [];
    setCurrentStepIndex(-1);
    setDisplayedText('');
    setCurrentSpeaker(Speaker.NONE);
    setIsAudioPlaying(false);
    setAllFactors([]);
    allFactorsRef.current = [];
    setCurrentFactorIndex(-1);
    setCompletedFactorIds(new Set());
    setFinalSynthesis(null);
    setRoundInfo(null);
    factorIndexRef.current = 0;
    turnQueueRef.current = [];
    isProcessingRef.current = false;
    isFetchingTTSRef.current = false;

    // Clear old audio data
    audioDataRef.current.forEach((data) => revokeAudioUrl(data.audioUrl));
    audioDataRef.current.clear();

    // Disconnect previous session
    if (sessionRef.current) {
      sessionRef.current.disconnect();
    }

    try {
      const session = await startAnalysis(file, selectedRounds, {
        onFactorsExtracted: (factors: Factor[]) => {
          console.log('Factors extracted:', factors.length);
          setAllFactors(factors);
          allFactorsRef.current = factors;

          const announcementStep = createFactorAnnouncementStep(factors);
          turnQueueRef.current.push(announcementStep);

          if (!isProcessingRef.current) {
            processNextTurn();
          }
        },

        onFactorStarted: (info) => {
          console.log('Factor started:', info.factorName);
          const factor = allFactorsRef.current.find(f => f.id === info.factorId) || {
            id: info.factorId,
            name: info.factorName,
            description: '',
          };

          const factorStartStep = createFactorStartStep(factor, factorIndexRef.current);
          turnQueueRef.current.push(factorStartStep);

          if (!isProcessingRef.current) {
            processNextTurn();
          }
        },

        onSupportTurn: (turn: DebateTurn, info) => {
          console.log('Support turn received');
          const supportStep = createSupportStep(turn, info.factorName, info.round, selectedRounds);
          turnQueueRef.current.push(supportStep);

          if (!isProcessingRef.current) {
            processNextTurn();
          }
        },

        onOpposeTurn: (turn: DebateTurn, info) => {
          console.log('Oppose turn received');
          const opposeStep = createOpposeStep(turn, info.factorName, info.round, selectedRounds);
          turnQueueRef.current.push(opposeStep);

          if (!isProcessingRef.current) {
            processNextTurn();
          }
        },

        onFactorComplete: (factorId: string) => {
          console.log('Factor complete (queued):', factorId);
          // Queue a completion step instead of updating state immediately
          turnQueueRef.current.push({
            speaker: Speaker.SYSTEM,
            text: '', // No text display needed, or maybe "Factor analysis complete."
            stepType: 'factor-complete',
            factorInfo: {
              factorId,
              factorName: '', // Not strictly needed for completion logic
            }
          });

          factorIndexRef.current++;

          if (!isProcessingRef.current) {
            processNextTurn();
          }
        },

        onSynthesisComplete: (synthesis: Synthesis) => {
          console.log('Synthesis complete');
          setFinalSynthesis(synthesis);
          const verdictStep = createVerdictStep(synthesis);
          turnQueueRef.current.push(verdictStep);

          if (!isProcessingRef.current) {
            processNextTurn();
          }
        },

        onError: (error: string) => {
          console.error('Backend error:', error);
          setAppState(AppState.ERROR);
          setErrorMsg(error);
        },

        onStatus: (status: string) => {
          console.log('Status:', status);
        },
      });

      sessionRef.current = session;
    } catch (err) {
      console.error('Failed to start analysis:', err);
      setAppState(AppState.ERROR);
      setErrorMsg("Failed to connect to the court server. Please ensure the backend is running.");
    }
  };

  // Handle download
  const handleDownload = () => {
    if (allFactors.length > 0 && transcript.length > 0) {
      const markdown = generateDebateMarkdown(allFactors, transcript, finalSynthesis);
      downloadPdf(markdown, `pixel-court-debate-${Date.now()}.pdf`);
    }
  };

  // Current factor
  const currentFactor = currentFactorIndex >= 0 && currentFactorIndex < allFactors.length
    ? allFactors[currentFactorIndex]
    : null;

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden font-pixel">
      {/* Navbar */}
      <header className="h-14 bg-[#2d1b0e] text-[#fdf6e3] flex items-center justify-between px-6 shadow-md z-50 border-b-4 border-[#5c3a21]">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-[#d97706]"></div>
          <h1 className="text-xl tracking-widest text-[#fdf6e3] font-bold">AETHER</h1>
        </div>

        {appState === AppState.ANALYZING && (
          <div className="flex items-center gap-2 text-[#fcd34d] text-sm">
            <div className="w-2 h-2 bg-[#fcd34d] rounded-full animate-pulse"></div>
            ANALYZING...
          </div>
        )}

        <div className="flex items-center gap-4">
          <label className="cursor-pointer bg-[#5c3a21] hover:bg-[#784b2b] px-3 py-1.5 rounded text-xs font-sans font-medium transition-colors text-[#fdf6e3] border-2 border-[#2d1b0e]">
            <span>UPLOAD CASE FILE</span>
            <input type="file" accept=".md,.txt,.pdf" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex relative bg-[#fdf6e3]">
        {/* Factor Sidebar */}
        {allFactors.length > 0 && appState !== AppState.IDLE && appState !== AppState.FINISHED && (
          <div className="w-64 bg-[#f4e4bc] border-r-4 border-[#5c3a21] p-4 overflow-y-auto z-40">
            <div className="text-[#8c501c] text-sm mb-4 tracking-wider font-bold">FACTORS</div>
            <div className="space-y-2">
              {allFactors.map((factor, idx) => {
                const isActive = currentFactorIndex === idx;
                const isCompleted = completedFactorIds.has(factor.id);

                return (
                  <div
                    key={factor.id}
                    className={`p-3 border-2 transition-all text-xs
                      ${isActive
                        ? 'bg-[#d97706]/20 border-[#d97706] text-[#78350f]'
                        : isCompleted
                          ? 'bg-green-100 border-green-600 text-green-800'
                          : 'bg-[#e6d5a7] border-[#bcaaa4] text-[#5c3a21]'
                      }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">
                        {isCompleted ? '✓' : isActive ? '▶' : `${idx + 1}`}
                      </span>
                      <span className="font-sans font-medium truncate">{factor.name}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Courtroom */}
        <div className="flex-1 relative bg-[#e6d5a7]">
          <Courtroom
            currentSpeaker={currentSpeaker}
            displayedText={displayedText}
            isLoading={appState === AppState.ANALYZING}
            currentFactor={currentFactor}
            roundInfo={roundInfo}
            isAudioPlaying={isAudioPlaying}
            onSkip={handleSkip}
          />

          {/* Idle Overlay */}
          {appState === AppState.IDLE && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#2d1b0e]/80 z-20 backdrop-blur-sm">
              <div className="text-center p-8 max-w-md bg-[#fdf6e3] border-4 border-[#5c3a21] rounded-xl shadow-[8px_8px_0px_0px_rgba(45,27,14,0.5)]">
                <div className="text-5xl text-[#d97706] mb-4 select-none drop-shadow-md font-bold">
                  AETHER
                </div>
                <p className="text-[#5c3a21] text-lg mb-6">
                  Upload evidence and select debate rounds.
                </p>

                <div className="mb-6">
                  <label className="block text-[#8c501c] text-sm mb-3">
                    DEBATE ROUNDS PER FACTOR
                  </label>
                  <div className="flex justify-center gap-2">
                    {[1, 2, 3, 4].map(num => (
                      <button
                        key={num}
                        onClick={() => setSelectedRounds(num)}
                        className={`w-14 h-14 text-2xl border-4 transition-all shadow-lg
                          ${selectedRounds === num
                            ? 'bg-[#d97706] border-[#92400e] text-white shadow-[#92400e]/30'
                            : 'bg-[#e6d5a7] border-[#bcaaa4] text-[#5c3a21] hover:border-[#8c501c] hover:bg-[#d4c396]'
                          }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                  <p className="text-[#8c501c] text-xs mt-2 font-sans">More rounds = deeper analysis</p>
                </div>

                <label className="inline-block cursor-pointer bg-[#d97706] hover:bg-[#b45309] 
                                text-white text-xl px-8 py-4 rounded 
                                border-b-4 border-[#78350f] active:border-b-0 
                                active:translate-y-1 transition-all shadow-md">
                  Select Evidence File
                  <input type="file" accept=".md,.txt,.pdf" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>
            </div>
          )}

          {/* Finished Overlay */}
          {appState === AppState.FINISHED && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#2d1b0e]/80 z-20 backdrop-blur-sm">
              <div className="text-center p-8 max-w-md bg-[#fdf6e3] border-4 border-[#d97706] rounded-xl shadow-[8px_8px_0px_0px_rgba(45,27,14,0.5)]">
                <div className="text-4xl text-[#d97706] mb-4 select-none drop-shadow-md">
                  COURT ADJOURNED
                </div>
                <p className="text-[#5c3a21] text-lg mb-6">
                  The deliberation has concluded.
                </p>

                <div className="flex flex-col gap-3">
                  <button
                    onClick={handleDownload}
                    className="w-full cursor-pointer bg-green-600 hover:bg-green-700 
                              text-white text-lg px-6 py-3 rounded 
                              border-b-4 border-green-800 active:border-b-0 
                              active:translate-y-1 transition-all flex items-center justify-center gap-2"
                  >
                    📥 Download Transcript
                  </button>

                  <button
                    onClick={() => {
                      setAppState(AppState.IDLE);
                      setTranscript([]);
                      setCurrentStepIndex(-1);
                      setAllFactors([]);
                      setCurrentFactorIndex(-1);
                      setCompletedFactorIds(new Set());
                      setFinalSynthesis(null);
                    }}
                    className="w-full cursor-pointer bg-[#d97706] hover:bg-[#b45309] 
                              text-white text-lg px-6 py-3 rounded 
                              border-b-4 border-[#78350f] active:border-b-0 
                              active:translate-y-1 transition-all"
                  >
                    New Case
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Error Overlay */}
          {appState === AppState.ERROR && (
            <div className="absolute inset-0 flex items-center justify-center bg-red-900/80 z-20 backdrop-blur-md">
              <div className="text-center text-white p-6 border-4 border-red-500 bg-red-950 rounded-lg shadow-xl max-w-lg">
                <h2 className="text-3xl mb-4 text-red-500">System Error</h2>
                <p className="font-sans mb-6">{errorMsg}</p>
                <button onClick={() => setAppState(AppState.IDLE)} className="text-xl underline hover:text-red-300">
                  Return to Start
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
