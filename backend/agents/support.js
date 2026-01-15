import 'dotenv/config';
import { Agent, run } from '@openai/agents';
import { aisdk } from '@openai/agents-extensions';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { z } from 'zod';
import { encode } from '@toon-format/toon';
import { supportSystemPrompt } from '../prompts/support.js';

// Reuse factor shape from factor.js by structural compatibility
export const SupportTurnSchema = z.object({
  role: z.literal('support'),
  factorId: z.string(),
  turn: z.number().nonnegative(),
  thesis: z.string().min(1),
  reasoning: z.string().min(1),
  evidence: z.array(z.string()).optional(),
  concessions: z.array(z.string()).optional(),
});

// Use OpenRouter with Grok for supportive reasoning
const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

const model = aisdk(openrouter.chat('x-ai/grok-4.1-fast'));

const supportAgent = new Agent({
  name: 'Support Agent',
  instructions: supportSystemPrompt,
  model,
  outputType: SupportTurnSchema,
});

/**
 * Generate a support turn for a given factor.
 *
 * @param {object} params
 * @param {string} params.reportText - Full report markdown/text.
 * @param {Array} params.factors - Full list of factor objects.
 * @param {object} params.factor - Current factor object being debated.
 * @param {Array} params.debateHistory - Array of previous turns for this factor.
 * @param {number} params.turn - Current turn number (0-based or 1-based, your choice).
 */
export async function generateSupportTurn({
  reportText,
  factors,
  factor,
  debateHistory,
  turn,
}) {
  // Compress data using TOON format to reduce tokens
  const factorToon = encode(factor);
  const historyToon = debateHistory.length > 0 ? encode(debateHistory) : '(none)';

  const input = `
You are generating a SUPPORTING argument for the following factor.

Current factor (TOON format):
${factorToon}

Debate history so far for this factor (TOON format):
${historyToon}
`.trim();

  const result = await run(supportAgent, input);
  const validated = SupportTurnSchema.parse(result.finalOutput);

  // Ensure factorId / role / turn are set even if model omits them
  return {
    role: 'support',
    factorId: validated.factorId || factor.id,
    turn: validated.turn ?? turn,
    thesis: validated.thesis,
    reasoning: validated.reasoning,
    evidence: validated.evidence ?? [],
    concessions: validated.concessions ?? [],
  };
}


