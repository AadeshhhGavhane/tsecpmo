#!/usr/bin/env node

import 'dotenv/config';
import { Agent, run } from '@openai/agents';
import { groq } from '@ai-sdk/groq';
import { aisdk } from '@openai/agents-extensions';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { factorSystemPrompt } from '../prompts/factor.js';

// Zod schema for factor extraction output
const FactorSchema = z.object({
  id: z.string().describe('Unique identifier for the factor (e.g., "factor-1", "factor-2")'),
  name: z.string().min(1).describe('Short, descriptive name of the factor'),
  description: z.string().min(1).describe('Brief description of what this factor represents and why it matters'),
  evidence: z.array(z.string()).optional().describe('Key excerpts or evidence from the report that support this factor'),
});

const FactorsSchema = z.object({
  factors: z.array(FactorSchema).min(1).describe('Array of key factors extracted from the report'),
});

// Initialize Meta Llama 4 model with Groq
const model = aisdk(groq('meta-llama/llama-4-maverick-17b-128e-instruct'));

// Create the Factor Extractor Agent
const factorExtractorAgent = new Agent({
  name: 'Factor Extractor',
  instructions: factorSystemPrompt,
  model,
  outputType: FactorsSchema,
});

/**
 * Extract factors from a markdown document
 * @param {string} filePath - Path to the markdown file
 * @returns {Promise<{factors: Array, usage: Object}>}
 */
async function extractFactors(filePath) {
  // Resolve and validate file path
  const resolvedPath = path.resolve(process.cwd(), filePath);
  
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`File not found: ${resolvedPath}`);
  }

  // Read the document
  const documentContent = fs.readFileSync(resolvedPath, 'utf-8');

  // Run the agent - just pass the document content directly
  // The system prompt already contains all instructions
  const result = await run(factorExtractorAgent, documentContent);

  // Validate and return the structured output
  const validatedOutput = FactorsSchema.parse(result.finalOutput);

  return {
    factors: validatedOutput.factors,
    usage: result.state.usage,
  };
}

/**
 * Main CLI function
 */
async function main() {
  const [, , filePath] = process.argv;

  if (!filePath) {
    console.error('Usage: node factor.js <path_to_md>');
    console.error('Example: node factor.js ../docs/sample.md');
    process.exit(1);
  }

  try {
    console.log(`Extracting factors from: ${filePath}`);
    console.log('Running Factor Extractor Agent...\n');

    const { factors, usage } = await extractFactors(filePath);

    // Output the structured factors
    console.log(JSON.stringify({ factors }, null, 2));

    // Optionally show usage stats
    if (process.env.SHOW_USAGE !== 'false') {
      console.error('\n--- Token Usage ---');
      console.error(`Input tokens: ${usage.inputTokens}`);
      console.error(`Output tokens: ${usage.outputTokens}`);
      console.error(`Total tokens: ${usage.totalTokens}`);
    }
  } catch (error) {
    console.error('Error extracting factors:');
    console.error(error.message || error);
    if (error.stack && process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run if executed directly (not imported)
// Compare normalized paths to handle Windows/Unix differences
const currentFile = fileURLToPath(import.meta.url);
const scriptFile = process.argv[1] ? path.resolve(process.argv[1]) : '';

if (currentFile === scriptFile || currentFile.replace(/\\/g, '/') === scriptFile.replace(/\\/g, '/')) {
  main().catch((err) => {
    console.error('Unhandled error:', err);
    process.exit(1);
  });
}

export { extractFactors, FactorsSchema };


