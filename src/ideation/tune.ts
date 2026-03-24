import fs from "fs";
import path from "path";
import chalk from "chalk";
import execa from "execa";
import { callAI } from "../executor/aiClient";

const ROUGH_PREFIX_REGEX = /^\[(rough|r)\]\s*/i;

const SYSTEM_PROMPT = `You are a senior software architect. Your task is to transform a rough feature blurb into a clean, organized design specification.

The spec should include the following sections where applicable:
- **Overview** — concise summary of what the feature does
- **Functional Description** — detailed behavior, user interactions, and edge cases
- **Design Elements** — UI/UX considerations, visual structure, or CLI output format
- **Recommended File Access** — list of files likely to be created or modified (paths relative to project root)
- **Component / Module Reuse** — existing modules, utilities, or patterns that should be leveraged
- **Implementation Notes** — any important constraints, assumptions, or sequencing considerations

Write the spec in clean Markdown. Use headers, bullet points, and code blocks where appropriate. Be thorough but concise. Do not include a "Rough Blurb" or "Original Notes" section — that will be appended separately.`;

function findRoughFiles(ideationDir: string): string[] {
  if (!fs.existsSync(ideationDir)) return [];

  return fs
    .readdirSync(ideationDir)
    .filter((name) => ROUGH_PREFIX_REGEX.test(name) && name.endsWith(".md"))
    .map((name) => path.join(ideationDir, name));
}

function stripRoughPrefix(filename: string): string {
  return filename.replace(ROUGH_PREFIX_REGEX, "").trim();
}

function resolveCleanPath(ideationDir: string, cleanName: string): string {
  const candidate = path.join(ideationDir, cleanName);
  if (!fs.existsSync(candidate)) return candidate;

  const ext = path.extname(cleanName);
  const base = path.basename(cleanName, ext);
  let counter = 1;
  while (true) {
    const named = path.join(ideationDir, `${base}-${counter}${ext}`);
    if (!fs.existsSync(named)) return named;
    counter++;
  }
}

export async function tuneIdeation(cwd: string): Promise<void> {
  const ideationDir = path.join(cwd, ".tempo", "ideation");
  const roughFiles = findRoughFiles(ideationDir);

  if (roughFiles.length === 0) {
    console.log(
      chalk.yellow(
        "No rough files found (looking for [r] or [rough] prefixed .md files in .tempo/ideation/)",
      ),
    );
    return;
  }

  console.log(
    chalk.bold(`\nFound ${roughFiles.length} rough file(s) to tune:\n`),
  );
  for (const f of roughFiles) {
    console.log(chalk.blue(`  ${path.basename(f)}`));
  }
  console.log("");

  for (const filePath of roughFiles) {
    const originalName = path.basename(filePath);
    const cleanName = stripRoughPrefix(originalName);
    const cleanPath = resolveCleanPath(ideationDir, cleanName);

    console.log(chalk.bold(`Tuning: ${originalName} → ${path.basename(cleanPath)}`));

    const blurb = fs.readFileSync(filePath, "utf-8").trim();

    let spec: string;
    try {
      spec = await callAI(
        SYSTEM_PROMPT,
        `Here is the rough feature blurb:\n\n${blurb}`,
      );
    } catch (err) {
      console.error(chalk.red(`  ✗ AI call failed: ${(err as Error).message}`));
      continue;
    }

    const output = `${spec.trim()}

---

<!-- rough-blurb: ignored during compile -->
<!--
${blurb.replace(/-->/g, "--\u003e")}
-->
`;

    fs.writeFileSync(cleanPath, output, "utf-8");
    fs.unlinkSync(filePath);
    const codeCmd = process.platform === "win32" ? "code.cmd" : "code";
    execa(codeCmd, [cleanPath]).unref();

    console.log(chalk.green(`  ✓ Written: ${path.basename(cleanPath)}`));
  }

  console.log("");
}
