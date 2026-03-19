#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { SpecSchema } from '../spec/schema';
import { runPipeline } from '../controller/runPipeline';
import { compileIdeation } from '../ideation/compile';

const cwd = process.cwd();

function printHelp(): void {
  console.log(chalk.bold('\nTempo — AI-driven code generation CLI\n'));
  console.log('Usage:');
  console.log('  tempo init                  Initialize .tempo/ in current directory');
  console.log('  tempo compile <file>        Compile a markdown ideation file to a score');
  console.log('  tempo run <score-name>      Run a score from .tempo/scores/<name>.json');
  console.log('');
}

function cmdInit(): void {
  const tempoDir = path.join(cwd, '.tempo');
  const dirs = ['ideation', 'scores', 'sessions', 'runs'];

  fs.mkdirSync(tempoDir, { recursive: true });
  for (const d of dirs) {
    fs.mkdirSync(path.join(tempoDir, d), { recursive: true });
  }

  const configPath = path.join(tempoDir, 'config.json');
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(
      configPath,
      JSON.stringify(
        {
          testCommand: 'npm test',
          buildCommand: 'npm run build',
          lintCommand: 'npm run lint',
        },
        null,
        2
      ),
      'utf-8'
    );
  }

  const rulesPath = path.join(tempoDir, 'rules.md');
  if (!fs.existsSync(rulesPath)) {
    fs.writeFileSync(
      rulesPath,
      `# Tempo Rules

## Code Style
- Use TypeScript
- Use async/await
- Keep functions small and focused

## Safety
- Only modify files listed in files_allowed
- Never delete files not explicitly listed

## .gitignore suggestions
Add these to your .gitignore:
.tempo/sessions/
.tempo/runs/
`,
      'utf-8'
    );
  }

  console.log(chalk.green('✓ Initialized .tempo/ directory'));
  console.log(chalk.blue('  .tempo/config.json  — validation commands'));
  console.log(chalk.blue('  .tempo/rules.md     — agent behavior rules'));
  console.log(chalk.blue('  .tempo/ideation/    — place your .md ideation files here'));
  console.log(chalk.blue('  .tempo/scores/      — compiled score JSONs'));
  console.log(chalk.blue('  .tempo/sessions/    — execution history per run'));
  console.log('');
  console.log(chalk.yellow('Tip: add .tempo/sessions/ and .tempo/runs/ to your .gitignore'));
}

function cmdCompile(args: string[]): void {
  const fileName = args[0];
  if (!fileName) {
    console.error(chalk.red('Usage: tempo compile <file>'));
    process.exit(1);
  }

  const filePath = path.isAbsolute(fileName)
    ? fileName
    : path.join(cwd, '.tempo', 'ideation', fileName);

  try {
    const outPath = compileIdeation(filePath, cwd);
    console.log(chalk.green(`✓ Score compiled → ${outPath}`));
  } catch (err) {
    console.error(chalk.red(`Error: ${(err as Error).message}`));
    process.exit(1);
  }
}

async function cmdRun(args: string[]): Promise<void> {
  const scoreName = args[0];
  if (!scoreName) {
    console.error(chalk.red('Usage: tempo run <score-name>'));
    process.exit(1);
  }

  const scorePath = path.join(cwd, '.tempo', 'scores', `${scoreName}.json`);
  if (!fs.existsSync(scorePath)) {
    console.error(chalk.red(`Score not found: ${scorePath}`));
    process.exit(1);
  }

  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(scorePath, 'utf-8'));
  } catch {
    console.error(chalk.red('Failed to parse score JSON'));
    process.exit(1);
  }

  const parsed = SpecSchema.safeParse(raw);
  if (!parsed.success) {
    console.error(chalk.red('Invalid score:'));
    console.error(parsed.error.format());
    process.exit(1);
  }

  await runPipeline(parsed.data, cwd);
}

async function main(): Promise<void> {
  const [, , command, ...args] = process.argv;

  if (!command || command === 'help' || command === '--help') {
    printHelp();
    return;
  }

  switch (command) {
    case 'init':
      cmdInit();
      break;
    case 'compile':
      cmdCompile(args);
      break;
    case 'run':
      await cmdRun(args);
      break;
    default:
      console.error(chalk.red(`Unknown command: ${command}`));
      printHelp();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(chalk.red('Fatal error:'), err.message);
  process.exit(1);
});
