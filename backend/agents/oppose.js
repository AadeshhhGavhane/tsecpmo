import 'dotenv/config';
import { Agent, run } from '@openai/agents';
import { aisdk } from '@openai/agents-extensions';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { z } from 'zod';
import { opposeSystemPrompt } from '../prompts/oppose.js';

export const OpposeTurnSchema = z.object({
  role: z.literal('oppose'),
  factorId: z.string(),
  turn: z.number().nonnegative(),
  thesis: z.string().min(1),
  reasoning: z.string().min(1),
  evidence: z.array(z.string()).optional(),
  concessions: z.array(z.string()).optional(),
});

// Use OpenRouter with Grok for opposing reasoning
const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

const model = aisdk(openrouter.chat('x-ai/grok-4.1-fast'));

const opposeAgent = new Agent({
  name: 'Oppose Agent',
  instructions: opposeSystemPrompt,
  model,
  outputType: OpposeTurnSchema,
});

/**
 * Generate an opposing turn for a given factor.
 *
 * @param {object} params
 * @param {string} params.reportText - Full report markdown/text.
 * @param {Array} params.factors - Full list of factor objects.
 * @param {object} params.factor - Current factor object being debated.
 * @param {Array} params.debateHistory - Array of previous turns for this factor.
 * @param {number} params.turn - Current turn number (0-based or 1-based, your choice).
 */
export async function generateOpposeTurn({
  reportText,
  factors,
  factor,
  debateHistory,
  turn,
}) {
  const input = `
You are generating an OPPOSING argument for the following factor.

Current factor (JSON):
${JSON.stringify(factor, null, 2)}

All factors (JSON):
${JSON.stringify(factors, null, 2)}

Debate history so far for this factor (JSON, may be empty):
${JSON.stringify(debateHistory, null, 2)}

Full report text:
${reportText}
`.trim();

  const result = await run(opposeAgent, input);
  const validated = OpposeTurnSchema.parse(result.finalOutput);

  return {
    role: 'oppose',
    factorId: validated.factorId || factor.id,
    turn: validated.turn ?? turn,
    thesis: validated.thesis,
    reasoning: validated.reasoning,
    evidence: validated.evidence ?? [],
    concessions: validated.concessions ?? [],
  };
}


