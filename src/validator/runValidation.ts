import execa from 'execa';
import fs from 'fs';
import path from 'path';
import { logInfo } from '../utils/logger';

export interface ValidationResult {
  success: boolean;
  errors: string;
}

interface AgentConfig {
  testCommand?: string;
  buildCommand?: string;
  lintCommand?: string;
}

async function runCommand(command: string, cwd: string): Promise<{ ok: boolean; output: string }> {
  const [cmd, ...args] = command.split(' ');
  try {
    const result = await execa(cmd, args, { cwd, reject: false });
    const output = [result.stdout, result.stderr].filter(Boolean).join('\n');
    return { ok: result.exitCode === 0, output };
  } catch (err) {
    return { ok: false, output: String(err) };
  }
}

function loadConfig(cwd: string): AgentConfig {
  const configPath = path.join(cwd, '.tempo', 'config.json');
  if (!fs.existsSync(configPath)) return {};
  return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

export async function runValidation(cwd: string): Promise<ValidationResult> {
  const config = loadConfig(cwd);
  const errors: string[] = [];

  const commands: Array<{ label: string; cmd: string | undefined }> = [
    { label: 'lint', cmd: config.lintCommand },
    { label: 'build', cmd: config.buildCommand },
    { label: 'test', cmd: config.testCommand },
  ];

  for (const { label, cmd } of commands) {
    if (!cmd) continue;
    logInfo(`Running ${label}: ${cmd}`);
    const { ok, output } = await runCommand(cmd, cwd);
    if (!ok) {
      errors.push(`[${label}] ${output}`);
    }
  }

  return {
    success: errors.length === 0,
    errors: errors.join('\n\n'),
  };
}
