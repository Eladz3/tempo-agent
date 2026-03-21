#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { SpecSchema } from '../spec/schema';
import { runPipeline } from '../controller/runPipeline';
import { compileIdeation } from '../ideation/compile';
import { tuneIdeation } from '../ideation/tune';
import { selectFromList } from '../utils/selectFromList';

const cwd = process.cwd();

function printHelp(): void {
  console.log(chalk.bold('\nTempo — AI-driven code generation CLI\n'));
  console.log('Usage:');
  console.log('  tempo init                  Initialize .tempo/ in current directory');
  console.log('  tempo compile [file]        Compile a markdown ideation file to a score (interactive if omitted)');
  console.log('  tempo tune                  Convert rough blurbs ([r] or [rough] prefixed) into clean design specs');
  console.log('  tempo run [score-name]      Run a score from .tempo/scores/<name>.json (interactive if omitted)');
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

  const secretsPath = path.join(tempoDir, '.env');
  if (!fs.existsSync(secretsPath)) {
    fs.writeFileSync(
      secretsPath,
      `# Tempo secrets — do not commit this file
# Add your API key below:
GEMINI_API_KEY=
`,
      'utf-8'
    );
  }

  // Ensure .tempo/.env is in the project's .gitignore
  const gitignorePath = path.join(cwd, '.gitignore');
  const gitignoreEntry = '.tempo/.env';
  if (fs.existsSync(gitignorePath)) {
    const existing = fs.readFileSync(gitignorePath, 'utf-8');
    if (!existing.includes(gitignoreEntry)) {
      fs.appendFileSync(gitignorePath, `\n${gitignoreEntry}\n`, 'utf-8');
    }
  } else {
    fs.writeFileSync(gitignorePath, `${gitignoreEntry}\n`, 'utf-8');
  }

  const globalContextPath = path.join(tempoDir, 'global-context.md');
  if (!fs.existsSync(globalContextPath)) {
    fs.writeFileSync(
      globalContextPath,
      `# Global Context

This file is injected into every AI prompt. Use it to define project-wide
design principles, code style rules, and safety constraints.

---

## Code Style

<!-- Define your preferred language, formatting, and patterns. Examples: -->
<!-- - Language: TypeScript (strict mode) -->
<!-- - Use async/await, never raw Promise chains -->
<!-- - Keep functions small and single-purpose -->
<!-- - Prefer named exports over default exports -->


## Architecture & Design Principles

<!-- Describe how this project is structured and how it should stay that way. Examples: -->
<!-- - Follow the repository pattern for all data access -->
<!-- - Business logic lives in /src/services, never in route handlers -->
<!-- - Avoid circular dependencies between modules -->


## Safety & Constraints

<!-- Rules the AI must always follow when modifying code. Examples: -->
<!-- - Never modify files outside of files_allowed -->
<!-- - Do not introduce new external dependencies without a comment explaining why -->
<!-- - Never remove error handling or logging -->


## Naming Conventions

<!-- Consistent naming rules across the codebase. Examples: -->
<!-- - Files: kebab-case -->
<!-- - Classes: PascalCase -->
<!-- - Functions and variables: camelCase -->
<!-- - Constants: SCREAMING_SNAKE_CASE -->


## Testing

<!-- Expectations around test coverage and style. Examples: -->
<!-- - Every new function must have at least one unit test -->
<!-- - Use Vitest, not Jest -->
<!-- - Mock external services, never the database -->


## Additional Notes

<!-- Anything else the AI should always keep in mind for this project. -->

`,
      'utf-8'
    );
  }

  console.log(chalk.green('✓ Initialized .tempo/ directory'));
  console.log(chalk.blue('  .tempo/.env               — API keys (gitignored)'));
  console.log(chalk.blue('  .tempo/config.json        — validation commands'));
  console.log(chalk.blue('  .tempo/global-context.md  — project rules injected into every prompt'));
  console.log(chalk.blue('  .tempo/ideation/    — place your .md ideation files here'));
  console.log(chalk.blue('  .tempo/scores/      — compiled score JSONs'));
  console.log(chalk.blue('  .tempo/sessions/    — execution history per run'));
  console.log('');
  console.log(chalk.yellow('Next: add your GEMINI_API_KEY to .tempo/.env'));
}

async function cmdCompile(args: string[]): Promise<void> {
  let fileName = args[0];

  if (!fileName) {
    const ideationDir = path.join(cwd, '.tempo', 'ideation');
    const files = fs.existsSync(ideationDir)
      ? fs.readdirSync(ideationDir).filter((f) => f.endsWith('.md'))
      : [];

    if (files.length === 0) {
      console.error(chalk.red('No ideation files found in .tempo/ideation/'));
      process.exit(1);
    }

    const chosen = await selectFromList(files, 'Select an ideation file to compile:');
    if (!chosen) {
      process.exit(0);
    }
    fileName = chosen;
  }

  const filePath = path.isAbsolute(fileName)
    ? fileName
    : path.join(cwd, '.tempo', 'ideation', fileName);

  try {
    const outPath = await compileIdeation(filePath, cwd);
    console.log(chalk.green(`✓ Score compiled → ${outPath}`));
  } catch (err) {
    console.error(chalk.red(`Error: ${(err as Error).message}`));
    process.exit(1);
  }
}

async function cmdRun(args: string[]): Promise<void> {
  let scoreName = args[0];

  if (!scoreName) {
    const scoresDir = path.join(cwd, '.tempo', 'scores');
    const files = fs.existsSync(scoresDir)
      ? fs.readdirSync(scoresDir).filter((f) => f.endsWith('.json'))
      : [];

    if (files.length === 0) {
      console.error(chalk.red('No score files found in .tempo/scores/'));
      process.exit(1);
    }

    const chosen = await selectFromList(
      files.map((f) => f.replace(/\.json$/, '')),
      'Select a score to run:'
    );
    if (!chosen) {
      process.exit(0);
    }
    scoreName = chosen;
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
      await cmdCompile(args);
      break;
    case 'tune':
      await tuneIdeation(cwd);
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
