# gitm8 — VS Code Extension

AI-powered Git workflow right from your VS Code status bar.

## Features

- **▶ Go** — Run the full `gitm8` pipeline (add → commit → push) with one click
- **⬇ Pull** — Git pull current branch
- **🌿 Branch** — Interactive branch creation: pick a base branch, name your new branch
- **🚀 Publish** — Push + set upstream + optional PR creation via `gh`
- **⚙ Config** — Manage API key, model, tone, and pipeline settings inside VS Code

All buttons are in the status bar at the bottom of VS Code. All commands are also available via `Ctrl+Shift+P`.

## Requirements

- **gitm8 CLI** (`npm install -g gitm8`) — the extension detects it automatically
- VS Code 1.85+

## Extension Settings

This extension contributes the following settings:

| Setting | Default | Description |
|---------|---------|-------------|
| `gitm8.apiBaseUrl` | `https://api.openai.com/v1` | AI provider API endpoint |
| `gitm8.model` | `gpt-4o-mini` | AI model for commit messages |
| `gitm8.tone` | `concise` | Commit message tone |
| `gitm8.commitStyle` | `conventional` | Commit format (conventional/freeform) |
| `gitm8.maxDiffChars` | `6000` | Max diff chars sent to AI |
| `gitm8.pipelinePrecheck` | `false` | Run build precheck in pipeline |
| `gitm8.pipelineAutoPush` | `false` | Auto-push after commit |

**API Key** is stored securely in VS Code's SecretStorage (not in a config file).

## Commands

| Command | Description |
|---------|-------------|
| `gitm8: Run Pipeline (Go)` | Run gitm8 go |
| `gitm8: Pull Current Branch` | Git pull |
| `gitm8: Create Branch` | Interactive branch creation |
| `gitm8: Publish Branch (Push + PR)` | Push and optionally create PR |
| `gitm8: Open Configuration` | Open settings panel |

## Development

```bash
# Install dependencies
cd extensions/vscode
npm install

# Compile
npm run compile

# Run in VS Code Extension Host
code . && press F5

# Package
npm run package
```
