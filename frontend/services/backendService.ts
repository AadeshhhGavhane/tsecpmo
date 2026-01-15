import { io, Socket } from 'socket.io-client';
import { DialogueStep, Speaker, Factor, DebateTurn, Synthesis } from '../types';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
const MULTIMODAL_URL = import.meta.env.VITE_MULTIMODAL_URL || 'http://localhost:8000';

/**
 * Preprocess PDF file by converting it to markdown via multimodal server.
 * Returns a new File object with markdown content.
 */
export async function preprocessPdf(file: File): Promise<File> {
  console.log('[preprocessPdf] Converting PDF to markdown...');

  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(MULTIMODAL_URL, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`PDF preprocessing failed: ${response.status}`);
  }

  const markdownText = await response.text();
  console.log('[preprocessPdf] Conversion complete, markdown length:', markdownText.length);

  // Convert markdown text to File object
  const blob = new Blob([markdownText], { type: 'text/markdown' });
  return new File([blob], file.name.replace('.pdf', '.md'), { type: 'text/markdown' });
}
export interface FactorInfo {
  factorId: string;
  factorName: string;
}

export interface AnalysisSession {
  jobId: string;
  disconnect: () => void;
}

type FactorsExtractedCallback = (factors: Factor[]) => void;
type FactorStartedCallback = (info: FactorInfo) => void;
type SupportTurnCallback = (turn: DebateTurn, info: FactorInfo & { round: number }) => void;
type OpposeTurnCallback = (turn: DebateTurn, info: FactorInfo & { round: number }) => void;
type FactorCompleteCallback = (factorId: string) => void;
type SynthesisCompleteCallback = (synthesis: Synthesis) => void;
type ErrorCallback = (error: string) => void;
type StatusCallback = (status: string) => void;

interface SessionCallbacks {
  onFactorsExtracted?: FactorsExtractedCallback;
  onFactorStarted?: FactorStartedCallback;
  onSupportTurn?: SupportTurnCallback;
  onOpposeTurn?: OpposeTurnCallback;
  onFactorComplete?: FactorCompleteCallback;
  onSynthesisComplete?: SynthesisCompleteCallback;
  onError?: ErrorCallback;
  onStatus?: StatusCallback;
}

/**
 * Uploads a file to the backend and starts the multi-agent analysis.
 * Returns a session object with event listeners for real-time updates.
 */
// Mock data constants
const MOCK_FACTOR_1: Factor = { id: 'f1', name: 'Mock Factor 1', description: 'This is a test factor description.', evidence: [] };
const MOCK_FACTOR_2: Factor = { id: 'f2', name: 'Mock Factor 2', description: 'Another test factor description.', evidence: [] };
const MOCK_FACTORS = [MOCK_FACTOR_1, MOCK_FACTOR_2];

const MOCK_SYNTHESIS: Synthesis = {
  overallSummary: 'This is a mock synthesis summary.',
  whatWorked: ['Mock point 1', 'Mock point 2'],
  whatFailed: ['Mock failure 1'],
  rootCauses: ['Mock cause 1'],
  recommendations: ['Mock recommendation 1'],
  perFactor: [
    { factorId: 'f1', factorName: 'Mock Factor 1', summarySupport: 'Supp check', summaryOppose: 'Opp check', verdict: 'Verdict check' },
    { factorId: 'f2', factorName: 'Mock Factor 2', summarySupport: 'Supp check', summaryOppose: 'Opp check', verdict: 'Verdict check' }
  ]
};

async function startMockAnalysis(
  rounds: number,
  callbacks: SessionCallbacks
): Promise<AnalysisSession> {
  console.log('Starting MOCK analysis...');
  let isActive = true;

  const emit = (fn: () => void, delay: number) => {
    if (isActive) setTimeout(fn, delay);
  };

  // 1. Factors extracted
  emit(() => callbacks.onFactorsExtracted?.(MOCK_FACTORS), 500);

  // 2. Factor 1
  emit(() => callbacks.onFactorStarted?.({ factorId: MOCK_FACTOR_1.id, factorName: MOCK_FACTOR_1.name }), 1500);

  // Rounds for Factor 1
  for (let r = 1; r <= rounds; r++) {
    const timeBase = 1500 + (r * 3000) - 3000;

    emit(() => callbacks.onSupportTurn?.(
      { role: 'support', factorId: MOCK_FACTOR_1.id, turn: r, thesis: `Support Thesis Round ${r}`, reasoning: `This is a short mock reasoning for support round ${r}.`, evidence: [], concessions: [] },
      { factorId: MOCK_FACTOR_1.id, factorName: MOCK_FACTOR_1.name, round: r }
    ), timeBase + 1000);

    emit(() => callbacks.onOpposeTurn?.(
      { role: 'oppose', factorId: MOCK_FACTOR_1.id, turn: r, thesis: `Oppose Thesis Round ${r}`, reasoning: `This is a short mock reasoning for oppose round ${r}.`, evidence: [], concessions: [] },
      { factorId: MOCK_FACTOR_1.id, factorName: MOCK_FACTOR_1.name, round: r }
    ), timeBase + 2500);
  }

  const f1End = 1500 + (rounds * 3000);
  emit(() => callbacks.onFactorComplete?.(MOCK_FACTOR_1.id), f1End);

  // 3. Factor 2
  const f2Start = f1End + 1000;
  emit(() => callbacks.onFactorStarted?.({ factorId: MOCK_FACTOR_2.id, factorName: MOCK_FACTOR_2.name }), f2Start);

  for (let r = 1; r <= rounds; r++) {
    const timeBase = f2Start + (r * 3000) - 3000;

    emit(() => callbacks.onSupportTurn?.(
      { role: 'support', factorId: MOCK_FACTOR_2.id, turn: r, thesis: `Support Thesis Round ${r}`, reasoning: `This is a short mock reasoning for support round ${r}.`, evidence: [], concessions: [] },
      { factorId: MOCK_FACTOR_2.id, factorName: MOCK_FACTOR_2.name, round: r }
    ), timeBase + 1000);

    emit(() => callbacks.onOpposeTurn?.(
      { role: 'oppose', factorId: MOCK_FACTOR_2.id, turn: r, thesis: `Oppose Thesis Round ${r}`, reasoning: `This is a short mock reasoning for oppose round ${r}.`, evidence: [], concessions: [] },
      { factorId: MOCK_FACTOR_2.id, factorName: MOCK_FACTOR_2.name, round: r }
    ), timeBase + 2500);
  }

  const f2End = f2Start + (rounds * 3000);
  emit(() => callbacks.onFactorComplete?.(MOCK_FACTOR_2.id), f2End);

  // 4. Synthesis
  emit(() => callbacks.onSynthesisComplete?.(MOCK_SYNTHESIS), f2End + 1000);

  return {
    jobId: 'mock-job-id',
    disconnect: () => { isActive = false; console.log('Mock session disconnected'); }
  };
}

export async function startAnalysis(
  file: File,
  rounds: number,
  callbacks: SessionCallbacks
): Promise<AnalysisSession> {
  // Check for test mode
  if (import.meta.env.VITE_APP_MODE === 'test') {
    return startMockAnalysis(rounds, callbacks);
  }

  // Step 1: Upload file and get jobId
  const formData = new FormData();
  formData.append('file', file);
  formData.append('turns', rounds.toString());

  const response = await fetch(`${BACKEND_URL}/api/analyze`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(error.error || 'Failed to start analysis');
  }

  const { jobId } = await response.json();

  // Step 2: Connect to Socket.IO
  const socket: Socket = io(BACKEND_URL, {
    transports: ['websocket', 'polling'],
  });

  socket.on('connect', () => {
    console.log('Socket connected, joining job:', jobId);
    socket.emit('join-job', jobId);
  });

  // Step 3: Set up event listeners
  socket.on('factors-extracted', (data: { factors: Factor[] }) => {
    console.log('Factors extracted:', data.factors);
    callbacks.onFactorsExtracted?.(data.factors);
  });

  socket.on('factor-started', (data: { factorId: string; factorName: string }) => {
    console.log('Factor started:', data);
    callbacks.onFactorStarted?.(data);
  });

  socket.on('support-turn', (data: { factorId: string; factorName: string; turn: number; data: DebateTurn }) => {
    console.log('Support turn:', data);
    callbacks.onSupportTurn?.(data.data, {
      factorId: data.factorId,
      factorName: data.factorName,
      round: data.turn,
    });
  });

  socket.on('oppose-turn', (data: { factorId: string; factorName: string; turn: number; data: DebateTurn }) => {
    console.log('Oppose turn:', data);
    callbacks.onOpposeTurn?.(data.data, {
      factorId: data.factorId,
      factorName: data.factorName,
      round: data.turn,
    });
  });

  socket.on('factor-complete', (data: { factorId: string }) => {
    console.log('Factor complete:', data);
    callbacks.onFactorComplete?.(data.factorId);
  });

  socket.on('synthesis-complete', (data: { synthesis: Synthesis }) => {
    console.log('Synthesis complete:', data);
    callbacks.onSynthesisComplete?.(data.synthesis);
  });

  socket.on('status', (data: { status: string }) => {
    console.log('Status:', data.status);
    callbacks.onStatus?.(data.status);
  });

  socket.on('error', (data: { message: string }) => {
    console.error('Backend error:', data.message);
    callbacks.onError?.(data.message);
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected');
  });

  return {
    jobId,
    disconnect: () => {
      socket.disconnect();
    },
  };
}

/**
 * Helper function to create a DialogueStep for the Judge announcing factors
 */
export function createFactorAnnouncementStep(factors: Factor[]): DialogueStep {
  const factorList = factors.map((f, i) => `${i + 1}. ${f.name}`).join(', ');
  const text = `Order in the court! We shall examine ${factors.length} key factors today: ${factorList}. Let the deliberation begin!`;

  return {
    speaker: Speaker.JUDGE,
    text,
    stepType: 'factor-announcement',
  };
}

/**
 * Helper function to create a DialogueStep for the Judge announcing a factor debate start
 * Changed to just say "Factor {number}" instead of "Factor X of Y"
 */
export function createFactorStartStep(factor: Factor, factorIndex: number): DialogueStep {
  const text = `Now commencing debate on Factor ${factorIndex + 1}: ${factor.name}. ${factor.description}`;

  return {
    speaker: Speaker.JUDGE,
    text,
    stepType: 'factor-announcement',
    factorInfo: {
      factorId: factor.id,
      factorName: factor.name,
    },
  };
}

/**
 * Helper function to create a DialogueStep from a support turn
 * Uses full thesis and reasoning from backend
 */
export function createSupportStep(
  turn: DebateTurn,
  factorName: string,
  round: number,
  totalRounds: number
): DialogueStep {
  // Use full thesis + reasoning for complete response
  const fullText = `${turn.thesis} ${turn.reasoning}`;

  return {
    speaker: Speaker.SUPPORT,
    text: fullText,
    reasoning: turn.reasoning,
    stepType: 'debate-turn',
    factorInfo: {
      factorId: turn.factorId,
      factorName,
      roundNumber: round,
      totalRounds,
    },
  };
}

/**
 * Helper function to create a DialogueStep from an oppose turn
 * Uses full thesis and reasoning from backend
 */
export function createOpposeStep(
  turn: DebateTurn,
  factorName: string,
  round: number,
  totalRounds: number
): DialogueStep {
  // Use full thesis + reasoning for complete response
  const fullText = `${turn.thesis} ${turn.reasoning}`;

  return {
    speaker: Speaker.OPPOSE,
    text: fullText,
    reasoning: turn.reasoning,
    stepType: 'debate-turn',
    factorInfo: {
      factorId: turn.factorId,
      factorName,
      roundNumber: round,
      totalRounds,
    },
  };
}

/**
 * Helper function to create a DialogueStep for the final verdict
 * Uses full synthesis from backend without truncation
 */
export function createVerdictStep(synthesis: Synthesis): DialogueStep {
  // Build a comprehensive verdict message - use ALL data
  const whatWorked = synthesis.whatWorked.join('; ');
  const whatFailed = synthesis.whatFailed.join('; ');
  const recommendations = synthesis.recommendations.join('; ');

  const text = `After careful deliberation, this court has reached a verdict. ${synthesis.overallSummary} Key successes include: ${whatWorked}. However, we identified concerns: ${whatFailed}. This court recommends: ${recommendations}. Court is adjourned!`;

  return {
    speaker: Speaker.JUDGE,
    text,
    stepType: 'verdict',
  };
}

/**
 * Generate a Markdown export of the entire debate
 */
export function generateDebateMarkdown(
  factors: Factor[],
  transcript: DialogueStep[],
  synthesis: Synthesis | null
): string {
  let md = `# Pixel Court Deliberation Report\n\n`;
  md += `**Generated:** ${new Date().toLocaleString()}\n\n`;
  md += `---\n\n`;

  // Factors overview
  md += `## Factors Examined\n\n`;
  factors.forEach((f, i) => {
    md += `${i + 1}. **${f.name}**: ${f.description}\n`;
  });
  md += `\n---\n\n`;

  // Full transcript
  md += `## Deliberation Transcript\n\n`;

  let currentFactorName = '';
  let currentRound = 0;

  transcript.forEach((step) => {
    // Check for factor change
    if (step.factorInfo?.factorName && step.factorInfo.factorName !== currentFactorName) {
      currentFactorName = step.factorInfo.factorName;
      currentRound = 0;
      md += `\n### Factor: ${currentFactorName}\n\n`;
    }

    // Check for round change
    if (step.factorInfo?.roundNumber && step.factorInfo.roundNumber !== currentRound) {
      currentRound = step.factorInfo.roundNumber;
      md += `#### Round ${currentRound}\n\n`;
    }

    // Add the dialogue
    const speakerLabel = step.speaker === Speaker.JUDGE ? '⚖️ **JUDGE**' :
      step.speaker === Speaker.SUPPORT ? '🔵 **SUPPORT**' :
        step.speaker === Speaker.OPPOSE ? '🔴 **OPPOSE**' : '**SYSTEM**';

    md += `${speakerLabel}:\n\n> ${step.text}\n\n`;
  });

  // Final synthesis
  if (synthesis) {
    md += `---\n\n`;
    md += `## Final Verdict\n\n`;
    md += `### Overall Summary\n\n${synthesis.overallSummary}\n\n`;

    md += `### What Worked\n\n`;
    synthesis.whatWorked.forEach(item => md += `- ${item}\n`);
    md += `\n`;

    md += `### What Failed\n\n`;
    synthesis.whatFailed.forEach(item => md += `- ${item}\n`);
    md += `\n`;

    md += `### Root Causes\n\n`;
    synthesis.rootCauses.forEach(item => md += `- ${item}\n`);
    md += `\n`;

    md += `### Recommendations\n\n`;
    synthesis.recommendations.forEach(item => md += `- ${item}\n`);
    md += `\n`;

    // Per-factor verdicts
    md += `### Per-Factor Analysis\n\n`;
    synthesis.perFactor.forEach(pf => {
      md += `#### ${pf.factorName}\n\n`;
      md += `**Support Summary:** ${pf.summarySupport}\n\n`;
      md += `**Opposition Summary:** ${pf.summaryOppose}\n\n`;
      md += `**Verdict:** ${pf.verdict}\n\n`;
    });
  }

  md += `---\n\n*Generated by Pixel Court AI Deliberation System*\n`;

  return md;
}

/**
 * Download content as a markdown file
 */
/**
 * Download content as a PDF file via backend conversion
 */
export async function downloadPdf(content: string, filename: string = 'debate-transcript.pdf') {
  try {
    console.log('[downloadPdf] Starting download, filename:', filename);

    const response = await fetch(`${BACKEND_URL}/api/convert-to-pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ markdown: content }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[downloadPdf] API error:', response.status, errText);
      throw new Error('PDF conversion failed');
    }

    const blob = await response.blob();
    console.log('[downloadPdf] Got blob, size:', blob.size, 'type:', blob.type);

    // Create download link with explicit filename
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename); // Use setAttribute for better compatibility
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    console.log('[downloadPdf] Clicking link with download attr:', link.getAttribute('download'));
    link.click();

    // Clean up after download starts
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 3000);
  } catch (error) {
    // IDM or similar download managers may intercept the request
    // causing fetch to fail even though the PDF was downloaded successfully
    console.log('[downloadPdf] Request may have been intercepted by download manager');
  }
}

/**
 * Fallback Markdown downloader
 */
export function downloadMarkdown(content: string, filename: string = 'debate-transcript.md') {
  const blob = new Blob([content], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.style.display = 'none';
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 2000);
}
