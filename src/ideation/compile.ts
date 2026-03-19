import fs from 'fs';
import path from 'path';
import { Spec } from '../spec/schema';

interface ParsedIdeation {
  goal: string;
  context: string;
  ideas: string[];
  finalPlan: string;
}

function parseMarkdown(content: string): ParsedIdeation {
  const sections: ParsedIdeation = {
    goal: '',
    context: '',
    ideas: [],
    finalPlan: '',
  };

  const sectionMap: Record<string, keyof ParsedIdeation> = {
    goal: 'goal',
    context: 'context',
    ideas: 'ideas',
    'final plan': 'finalPlan',
  };

  const lines = content.split('\n');
  let currentSection: keyof ParsedIdeation | null = null;
  const buffer: string[] = [];

  function flush(): void {
    if (!currentSection) return;
    const text = buffer.join('\n').trim();
    if (currentSection === 'ideas') {
      sections.ideas = text
        .split('\n')
        .map((l) => l.replace(/^[-*]\s*/, '').trim())
        .filter(Boolean);
    } else {
      (sections as unknown as Record<string, string>)[currentSection] = text;
    }
    buffer.length = 0;
  }

  for (const line of lines) {
    const headingMatch = line.match(/^#{1,3}\s+(.+)/);
    if (headingMatch) {
      flush();
      const heading = headingMatch[1].toLowerCase().trim();
      currentSection = sectionMap[heading] ?? null;
    } else {
      buffer.push(line);
    }
  }
  flush();

  return sections;
}

function buildSpec(parsed: ParsedIdeation, name: string): Spec {
  const planLines = parsed.finalPlan.split('\n').filter(Boolean);

  const steps = planLines
    .map((line, i) => ({
      id: i + 1,
      description: line.replace(/^\d+[.)]\s*/, '').trim(),
      files_allowed: [],
    }))
    .filter((s) => s.description.length > 0);

  return {
    goal: parsed.goal || name,
    constraints: parsed.context
      .split('\n')
      .map((l) => l.replace(/^[-*]\s*/, '').trim())
      .filter(Boolean),
    steps: steps.length > 0
      ? steps
      : [{ id: 1, description: parsed.finalPlan || 'Implement the plan', files_allowed: [] }],
    tests: [],
    definition_of_done: parsed.ideas,
  };
}

export function compileIdeation(filePath: string, cwd: string): string {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const name = path.basename(filePath, path.extname(filePath));
  const parsed = parseMarkdown(content);
  const spec = buildSpec(parsed, name);

  const specsDir = path.join(cwd, '.tempo', 'scores');
  fs.mkdirSync(specsDir, { recursive: true });

  const outPath = path.join(specsDir, `${name}.json`);
  fs.writeFileSync(outPath, JSON.stringify(spec, null, 2), 'utf-8');

  return outPath;
}
