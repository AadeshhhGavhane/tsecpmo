#!/usr/bin/env node

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractFactors } from './factor.js';
import { generateSupportTurn } from './support.js';
import { generateOpposeTurn } from './oppose.js';
import { synthesizeDebate } from './synthesize.js';

async function runOrchestration(reportPath, roundsPerFactor = 2) {
  const resolvedPath = path.resolve(process.cwd(), reportPath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Input file not found: ${resolvedPath}`);
  }

  const reportText = fs.readFileSync(resolvedPath, 'utf-8');

  console.log(`Analyzing report: ${reportPath}`);
  console.log('Step 1: Extracting factors...\n');

  const { factors } = await extractFactors(reportPath);

  console.log('Extracted factors:');
  console.log(JSON.stringify(factors, null, 2));
  console.log('\nStep 2: Running debates per factor...\n');

  const debates = [];

  for (const factor of factors) {
    console.log(`=== Factor: ${factor.name} (${factor.id}) ===`);
    const debateHistory = [];

    for (let round = 1; round <= roundsPerFactor; round++) {
      console.log(`\n-- Round ${round} (Support) --`);
      const supportTurn = await generateSupportTurn({
        reportText,
        factors,
        factor,
        debateHistory,
        turn: round,
      });
      debateHistory.push(supportTurn);
      console.log(supportTurn.thesis);
      console.log(supportTurn.reasoning);

      console.log(`\n-- Round ${round} (Oppose) --`);
      const opposeTurn = await generateOpposeTurn({
        reportText,
        factors,
        factor,
        debateHistory,
        turn: round,
      });
      debateHistory.push(opposeTurn);
      console.log(opposeTurn.thesis);
      console.log(opposeTurn.reasoning);
    }

    debates.push({ factor, turns: debateHistory });
    console.log('\n===============================\n');
  }

  console.log('Step 3: Synthesizing final report...\n');
  const synthesis = await synthesizeDebate({ reportText, factors, debates });

  console.log('=== Final Synthesis (JSON) ===');
  console.log(JSON.stringify(synthesis, null, 2));

  return { factors, debates, synthesis };
}

async function main() {
  const [, , reportPath, roundsArg] = process.argv;

  if (!reportPath) {
    console.error('Usage: node orchestrator.js <path_to_md> [rounds_per_factor]');
    console.error('Example: node orchestrator.js ../docs/sample-organizational.md 2');
    process.exit(1);
  }

  const roundsPerFactor = roundsArg ? parseInt(roundsArg, 10) : 2;

  if (Number.isNaN(roundsPerFactor) || roundsPerFactor <= 0) {
    console.error('rounds_per_factor must be a positive integer');
    process.exit(1);
  }

  try {
    await runOrchestration(reportPath, roundsPerFactor);
  } catch (err) {
    console.error('Error running orchestrator:');
    console.error(err.message || err);
    if (err.stack && process.env.DEBUG) {
      console.error(err.stack);
    }
    process.exit(1);
  }
}

// Run if executed directly (not imported)
const currentFile = fileURLToPath(import.meta.url);
const scriptFile = process.argv[1] ? path.resolve(process.argv[1]) : '';

if (currentFile === scriptFile || currentFile.replace(/\\/g, '/') === scriptFile.replace(/\\/g, '/')) {
  main().catch((err) => {
    console.error('Unhandled error:', err);
    process.exit(1);
  });
}

export { runOrchestration };


