import 'dotenv/config';
import { Agent, run } from '@openai/agents';
import { aisdk } from '@openai/agents-extensions';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { z } from 'zod';
import { synthesizeSystemPrompt } from '../prompts/synthesize.js';

// Basic shapes reused from other agents
export const SynthesisPerFactorSchema = z.object({
  factorId: z.string(),
  factorName: z.string(),
  summarySupport: z.string(),
  summaryOppose: z.string(),
  verdict: z.string(),
  recommendations: z.array(z.string()).optional(),
});

export const SynthesisSchema = z.object({
  overallSummary: z.string(),
  whatWorked: z.array(z.string()),
  whatFailed: z.array(z.string()),
  rootCauses: z.array(z.string()),
  recommendations: z.array(z.string()),
  perFactor: z.array(SynthesisPerFactorSchema),
});

// Use OpenRouter with Gemini 3 Flash for synthesis
const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

const model = aisdk(openrouter.chat('x-ai/grok-4.1-fast'));

const synthAgent = new Agent({
  name: 'Synthesis Agent',
  instructions: synthesizeSystemPrompt,
  model,
  outputType: SynthesisSchema,
});

/**
 * Run the synthesis agent over the full debate.
 *
 * @param {object} params
 * @param {string} params.reportText
 * @param {Array} params.factors
 * @param {Array} params.debates - Array of { factor, turns } objects.
 */
export async function synthesizeDebate({ reportText, factors, debates }) {
  const input = `
You are generating a final synthesis of the debates for this report.

Factors (JSON):
${JSON.stringify(factors, null, 2)}

Debates by factor (JSON):
${JSON.stringify(debates, null, 2)}

Full report text:
${reportText}
`.trim();

  const result = await run(synthAgent, input);
  const validated = SynthesisSchema.parse(result.finalOutput);
  return validated;
}


