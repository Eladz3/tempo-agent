import fs from 'fs';
import path from 'path';
import { Step, Spec } from '../spec/schema';
import { callAI } from './aiClient';
import { logInfo } from '../utils/logger';

const BASE_SYSTEM_PROMPT = `You are an expert software engineer. You will receive:
1. A task description
2. The contents of files you are allowed to modify
3. Project constraints

Respond ONLY with complete file replacements in this exact format for each file:

===FILE: path/to/file.ts===
<full file content here>
===END===

Rules:
- Output FULL file content, never partial edits
- Only output files listed in "files_allowed"
- Do not add explanations outside the file blocks
- Preserve existing code that is not being changed`;

function buildSystemPrompt(cwd: string): string {
  const globalContextPath = path.join(cwd, '.tempo', 'global-context.md');
  if (fs.existsSync(globalContextPath)) {
    const globalContext = fs.readFileSync(globalContextPath, 'utf-8').trim();
    return `${BASE_SYSTEM_PROMPT}\n\n---\n\n${globalContext}`;
  }
  return BASE_SYSTEM_PROMPT;
}

export interface StepResult {
  stepId: number;
  instruction: string;
  filesAllowed: string[];
  aiResponse: string;
  filesWritten: string[];
}

function readAllowedFiles(filesAllowed: string[], cwd: string): Record<string, string> {
  const contents: Record<string, string> = {};
  for (const filePath of filesAllowed) {
    const abs = path.resolve(cwd, filePath);
    if (fs.existsSync(abs)) {
      contents[filePath] = fs.readFileSync(abs, 'utf-8');
    } else {
      contents[filePath] = '(file does not exist yet — create it)';
    }
  }
  return contents;
}

function parseAIResponse(response: string): Record<string, string> {
  const files: Record<string, string> = {};
  const regex = /===FILE: (.+?)===\n([\s\S]*?)===END===/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(response)) !== null) {
    const filePath = match[1].trim();
    const content = match[2];
    files[filePath] = content;
  }
  return files;
}

function writeFiles(files: Record<string, string>, cwd: string, allowed: string[]): string[] {
  const written: string[] = [];
  for (const [filePath, content] of Object.entries(files)) {
    if (!allowed.includes(filePath)) {
      logInfo(`Skipping non-allowed file: ${filePath}`);
      continue;
    }
    const abs = path.resolve(cwd, filePath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, 'utf-8');
    written.push(filePath);
  }
  return written;
}

export async function runStep(
  step: Step,
  spec: Spec,
  cwd: string,
  extraContext?: string
): Promise<StepResult> {
  const fileContents = readAllowedFiles(step.files_allowed, cwd);

  const fileSection = Object.entries(fileContents)
    .map(([f, c]) => `### ${f}\n\`\`\`\n${c}\n\`\`\``)
    .join('\n\n');

  const instruction = `
Goal: ${spec.goal}

Constraints:
${spec.constraints.map((c) => `- ${c}`).join('\n')}

Step ${step.id}: ${step.description}

Files you may modify:
${step.files_allowed.join(', ')}

Current file contents:
${fileSection}
${extraContext ? `\nAdditional context:\n${extraContext}` : ''}
`.trim();

  logInfo(`Sending step ${step.id} to AI...`);
  const aiResponse = await callAI(buildSystemPrompt(cwd), instruction);

  const parsedFiles = parseAIResponse(aiResponse);
  const filesWritten = writeFiles(parsedFiles, cwd, step.files_allowed);

  return {
    stepId: step.id,
    instruction,
    filesAllowed: step.files_allowed,
    aiResponse,
    filesWritten,
  };
}
