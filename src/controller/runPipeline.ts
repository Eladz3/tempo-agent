import path from 'path';
import fs from 'fs';
import execa from 'execa';
import { Spec } from '../spec/schema';
import { runStep } from '../executor/runStep';
import { runValidation } from '../validator/runValidation';
import { logStep, logSuccess, logFailure, logRetry, logInfo, logSummary } from '../utils/logger';

const MAX_RETRIES = 3;

function ensureHistoryDir(cwd: string, runTimestamp: string): string {
  const dir = path.join(cwd, '.tempo', 'sessions', `session-${runTimestamp}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function saveStepHistory(
  historyDir: string,
  stepId: number,
  instruction: string,
  filesAllowed: string[],
  aiResponse: string,
  result: 'success' | 'failure'
): void {
  const content = `# Step ${stepId}

## Instruction Sent to AI

\`\`\`
${instruction}
\`\`\`

## Files Allowed

${filesAllowed.map((f) => `- ${f}`).join('\n')}

## AI Response

\`\`\`
${aiResponse}
\`\`\`

## Result

${result}
`;
  fs.writeFileSync(path.join(historyDir, `step-${stepId}.md`), content, 'utf-8');
}

function saveErrors(historyDir: string, stepId: number, errors: string, retries: number): void {
  const content = `# Errors for Step ${stepId}

Retries attempted: ${retries}

## Raw Output

\`\`\`
${errors}
\`\`\`
`;
  fs.writeFileSync(path.join(historyDir, `errors-step-${stepId}.md`), content, 'utf-8');
}

async function captureAndSaveDiff(historyDir: string, stepId: number, cwd: string): Promise<void> {
  try {
    const result = await execa('git', ['diff'], { cwd, reject: false });
    if (result.stdout) {
      fs.writeFileSync(
        path.join(historyDir, `diff-${stepId}.patch`),
        result.stdout,
        'utf-8'
      );
    }
  } catch {
    // git not available — skip diff
  }
}

export async function runPipeline(spec: Spec, cwd: string): Promise<void> {
  const runTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const historyDir = ensureHistoryDir(cwd, runTimestamp);

  logInfo(`Starting pipeline: ${spec.goal}`);
  logInfo(`Session: .tempo/sessions/session-${runTimestamp}`);

  let passed = 0;
  let failed = 0;

  for (const step of spec.steps) {
    logStep(step.id, step.description);

    let lastErrors = '';
    let succeeded = false;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const extraContext = attempt > 1
        ? `Fix only these errors:\n${lastErrors}`
        : undefined;

      const stepResult = await runStep(step, spec, cwd, extraContext);
      await captureAndSaveDiff(historyDir, step.id, cwd);

      const validation = await runValidation(cwd);

      if (validation.success) {
        logSuccess(`Step ${step.id} passed validation`);
        saveStepHistory(
          historyDir,
          step.id,
          stepResult.instruction,
          stepResult.filesAllowed,
          stepResult.aiResponse,
          'success'
        );
        succeeded = true;
        passed++;
        break;
      }

      lastErrors = validation.errors;
      logRetry(attempt, MAX_RETRIES, validation.errors);

      if (attempt === MAX_RETRIES) {
        saveErrors(historyDir, step.id, validation.errors, attempt);
        saveStepHistory(
          historyDir,
          step.id,
          stepResult.instruction,
          stepResult.filesAllowed,
          stepResult.aiResponse,
          'failure'
        );
      }
    }

    if (!succeeded) {
      logFailure(`Step ${step.id} failed after ${MAX_RETRIES} retries. Stopping pipeline.`);
      failed++;
      logSummary(passed, failed, spec.steps.length);
      process.exit(1);
    }
  }

  logSummary(passed, failed, spec.steps.length);
}
