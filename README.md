# Tempo

AI-driven code generation CLI. Give Tempo a goal, and it writes, validates, and retries code changes step by step using Claude.

## Install

```bash
npm install -g tempo-agent
```

## Requirements

Set your Anthropic API key:

```bash
export ANTHROPIC_API_KEY=your-key-here
```

## Usage

### 1. Initialize a project

Run this inside any existing project:

```bash
tempo init
```

Creates a `.tempo/` directory with config and folders for scores, sessions, and ideation files.

### 2. Write an ideation file

Create a markdown file in `.tempo/ideation/my-feature.md`:

```markdown
# Goal
Build a REST API for a todo list

# Context
- Use Express.js
- Use TypeScript
- Store data in memory

# Ideas
- Add pagination
- Add filtering by status

# Final Plan
1. Create Express server entry point
2. Add todo routes (GET, POST, PUT, DELETE)
3. Add in-memory store module
```

### 3. Compile it into a score

```bash
tempo compile my-feature.md
```

Generates `.tempo/scores/my-feature.json` — a structured execution plan.

### 4. Edit the score

Open `.tempo/scores/my-feature.json` and fill in `files_allowed` for each step — the list of files Claude is permitted to create or modify:

```json
{
  "steps": [
    {
      "id": 1,
      "description": "Create Express server entry point",
      "files_allowed": ["src/index.ts"]
    }
  ]
}
```

### 5. Run it

```bash
tempo run my-feature
```

Tempo will:
- Send each step to Claude with the current file contents
- Write Claude's response back to disk
- Run lint, build, and tests
- Retry up to 3 times on failure, feeding errors back to Claude
- Save a full session log to `.tempo/sessions/`

## Config

`.tempo/config.json` controls which commands are used for validation:

```json
{
  "testCommand": "npm test",
  "buildCommand": "npm run build",
  "lintCommand": "npm run lint"
}
```

Set any value to `null` to skip that step.

## Session History

Every run is saved to `.tempo/sessions/session-{timestamp}/`:

| File | Contents |
|---|---|
| `step-N.md` | Prompt sent, files used, Claude response, result |
| `errors-step-N.md` | Validation errors and retry attempts |
| `diff-N.patch` | Git diff after each step |

Add to your `.gitignore`:

```
.tempo/sessions/
.tempo/runs/
```

## How it works

1. Reads the files listed in `files_allowed` for the current step
2. Sends them to Claude with the step instruction
3. Claude returns full file replacements
4. Tempo writes them to disk
5. Runs validation — if it fails, sends the errors back to Claude and retries
6. Moves to the next step once validation passes
