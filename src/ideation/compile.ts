import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { callAI } from '../executor/aiClient';
import { Spec, SpecSchema } from '../spec/schema';

const SYSTEM_PROMPT = `You are a senior software architect and project planner. Analyze a markdown ideation document and produce a structured execution score as a valid JSON object.

The JSON must strictly follow this schema:
{
  "goal": "<one concise sentence describing the overall feature objective>",
  "constraints": ["<project constraints, rules, and technical boundaries the implementation must respect>"],
  "steps": [
    {
      "id": 1,
      "description": "<clear, actionable step description>",
      "files_allowed": ["<file paths relative to project root that this step creates or modifies>"]
    }
  ],
  "tests": ["<specific, verifiable test case descriptions>"],
  "definition_of_done": ["<measurable acceptance criteria that must be true when the feature is complete>"]
}

Guidelines:
- Break the work into sequential, granular steps — each step should be a single focused unit of work
- Populate files_allowed with specific file paths (not directories) for each step
- tests must be concrete and verifiable (e.g. "GET /api/users returns 200 with a list of users")
- definition_of_done must be measurable outcomes (e.g. "All API endpoints return correct HTTP status codes")
- constraints should capture all technical rules, style requirements, and boundaries mentioned in the ideation
- Step IDs must be sequential integers starting from 1

Respond ONLY with the raw JSON object. No explanations, no markdown code fences, no extra text.`;

export async function compileIdeation(filePath: string, cwd: string): Promise<string> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf-8').trim();
  const name = path.basename(filePath, path.extname(filePath));

  console.log(chalk.bold(`\nCompiling: ${path.basename(filePath)}`));

  let aiResponse: string;
  try {
    aiResponse = await callAI(SYSTEM_PROMPT, `Here is the ideation document:\n\n${content}`);
  } catch (err) {
    throw new Error(`AI call failed: ${(err as Error).message}`);
  }

  // Strip markdown code fences if present (```json ... ```)
  const jsonText = aiResponse
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();

  let raw: unknown;
  try {
    raw = JSON.parse(jsonText);
  } catch {
    throw new Error(`AI returned invalid JSON. Response:\n${jsonText.slice(0, 500)}`);
  }

  const parsed = SpecSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`AI response does not match score schema:\n${JSON.stringify(parsed.error.format(), null, 2)}`);
  }

  const spec: Spec = parsed.data;

  const scoresDir = path.join(cwd, '.tempo', 'scores');
  fs.mkdirSync(scoresDir, { recursive: true });

  const outPath = path.join(scoresDir, `${name}.json`);
  fs.writeFileSync(outPath, JSON.stringify(spec, null, 2), 'utf-8');

  return outPath;
}
