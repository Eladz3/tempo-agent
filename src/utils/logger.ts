import chalk from 'chalk';

export function logStep(stepId: number, description: string): void {
  console.log(chalk.cyan(`\n[STEP ${stepId}] ${description}`));
}

export function logSuccess(message: string): void {
  console.log(chalk.green(`✓ ${message}`));
}

export function logFailure(message: string): void {
  console.log(chalk.red(`✗ ${message}`));
}

export function logRetry(attempt: number, max: number, errors: string): void {
  console.log(chalk.yellow(`↻ Retry ${attempt}/${max}`));
  console.log(chalk.yellow(`  Errors: ${errors.slice(0, 200)}...`));
}

export function logInfo(message: string): void {
  console.log(chalk.blue(`ℹ ${message}`));
}

export function logSummary(passed: number, failed: number, total: number): void {
  console.log(chalk.bold('\n─────────────────────────────'));
  console.log(chalk.bold('Pipeline Summary'));
  console.log(chalk.bold('─────────────────────────────'));
  console.log(`Total steps : ${total}`);
  console.log(chalk.green(`Passed      : ${passed}`));
  if (failed > 0) {
    console.log(chalk.red(`Failed      : ${failed}`));
  }
  console.log(chalk.bold('─────────────────────────────\n'));
}
