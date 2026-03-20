# Tempo [![npm version](https://img.shields.io/npm/v/tempo-agent.svg?style=flat-square)](https://www.npmjs.org/package/tempo-agent)

AI-driven code generation CLI. Give Tempo a goal, and it writes, validates, and retries code changes step by step using Claude.

## Install

```bash
npm install -g tempo-agent
```

## Requirements

Set your Anthropic API key as an environment variable.

**macOS / Linux**
```bash
export ANTHROPIC_API_KEY=your-key-here
```

**Windows (PowerShell)**
```powershell
# Current session only
$env:ANTHROPIC_API_KEY = "your-key-here"

# Permanently (no need to set it again after restart)
[System.Environment]::SetEnvironmentVariable("ANTHROPIC_API_KEY", "your-key-here", "User")
```

Get your API key at [console.anthropic.com](https://console.anthropic.com) → API Keys.

## Usage

### 1. Initialize a project

Run this inside any existing project:

```bash
tempo init
```

Creates a `.tempo/` directory with config and folders for Scores, Sessions, and Ideation files.

### 2. Write an Ideation file

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

### 3. Compile it into a Score

```bash
tempo compile my-feature.md
```

Generates `.tempo/scores/my-feature.json` — a structured execution plan.

### 4. Edit the Score

Open `.tempo/scores/my-feature.json` and fill in `files_allowed` for each Step — the list of files Claude is permitted to create or modify:

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
- Send each Step to Claude with the current file contents
- Write Claude's response back to disk
- Run lint, build, and tests
- Retry up to 3 times on failure, feeding errors back to Claude
- Save a full Session log to `.tempo/sessions/`

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
| `diff-N.patch` | Git diff after each Step |

Add to your `.gitignore`:

```
.tempo/sessions/
.tempo/runs/
```

## How it works

1. Reads the files listed in `files_allowed` for the current Step
2. Sends them to Claude with the Step instruction
3. Claude returns full file replacements
4. Tempo writes them to disk
5. Runs validation — if it fails, sends the errors back to Claude and retries
6. Moves to the next Step once validation passes
