<div align="center">

# gitm8 🤖

**The AI-Powered Git CLI That Also Visualizes Your Code**

[![npm version](https://img.shields.io/npm/v/gitm8?color=6c8cff&label=npm)](https://www.npmjs.com/package/gitm8)
[![license](https://img.shields.io/badge/license-MIT-4ade80)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/tharanitharan305/gitm8?style=flat&color=ffd666)](https://github.com/tharanitharan305/gitm8)

```bash
npm install -g gitm8
```

[GitHub Repository](https://github.com/tharanitharan305/gitm8) · [Report Bug](https://github.com/tharanitharan305/gitm8/issues) · [Request Feature](https://github.com/tharanitharan305/gitm8/issues)

---

**gitm8** is an open-source AI-powered Git CLI wrapper that does more than just commits — it **scans for secrets**, **checks your build**, **visualizes your code architecture**, and **automates your entire workflow** from one command.

</div>

## ✨ Features at a Glance

| Feature | Command | What it does |
|---------|---------|-------------|
| 🔐 **Secrets Scanner** | `gitm8 secrets-scan` | Detects API keys, tokens, and credentials before they leak to GitHub |
| 📝 **AI Commit Messages** | `gitm8 commit` | Generates smart commit messages from your staged diff |
| 🏗️ **Pre-push Build Gate** | `gitm8 precheck` | Detects your framework, runs the build, blocks push on failure |
| 📊 **Code Visualization** | `gitm8 viz` | Interactive D3.js class/method relationship diagram + call tree |
| ⚙️ **Configurable Pipeline** | `gitm8 config --ui` | Link commit → scan → build → push into one automated flow |
| 🚀 **Smart Push** | `gitm8 push` | Auto-sets upstream, no more `--set-upstream` |
| 🎨 **Colored Status** | `gitm8 status` | Beautiful, color-coded working tree status |

---

## 🚀 One-Click Pipeline

Configure once, then one command does it all:

```bash
gitm8 commit
```

Runs automatically: **🔐 scan for secrets → 📝 AI commit → 🏗️ build → 🚀 push**

Toggle each stage on/off in the web UI:

```bash
gitm8 config --ui
```

| Pipeline Stage | Default | What it protects you from |
|---------------|---------|--------------------------|
| 🔐 Secrets Scan | ✅ ON | Accidentally committing AWS keys, GitHub tokens, database passwords |
| 🏗️  Build Check | ⏺ OFF | Pushing broken code that doesn't compile |
| 🚀 Auto-Push | ⏺ OFF | Forgetting to push after a successful commit |

---

## 📊 Code Visualization (`gitm8 viz`)

The killer feature that sets gitm8 apart — **code relationship diagrams, zero setup**.

```bash
gitm8 viz
```

Scans your entire project (JS, TS/TSX, Python, Java, Dart), builds a class/method relationship graph, and opens an interactive D3.js visualization in your browser with:

- 🖱 **Draggable force-directed graph** — explore architecture visually
- 🔍 **Search bar** — instantly find any class, method, or file
- 🌳 **Call tree panel** — see the full hierarchy from entry point to leaf
- 🎯 **Click to highlight** — instantly trace which methods call which
- 📁 **Cross-file relationships** — dashed lines show connections across files
- 🔌 **100% local** — no AI, no API calls, works fully offline

> **Perfect for:** Onboarding to new codebases, refactoring with confidence, finding dead code, understanding Flutter widget trees, reviewing PR impacts.

---

## 🔐 Secrets Scanner

```bash
gitm8 secrets-scan    # standalone
gitm8 commit           # runs automatically (default: ON)
```

Catches **30+ secret patterns** across 4 severity levels:

| Severity | Examples |
|----------|---------|
| 🔴 **Critical** | AWS keys, GitHub tokens, Slack tokens, Discord tokens, private keys, bearer tokens |
| 🟡 **High** | Stripe live keys, Google API keys, MongoDB/Postgres connection strings, npm tokens, service accounts |
| 🔵 **Medium** | Password values in config, JWT tokens, .env files, sensitive files (.pem, .key) |
| ⚪ **Low** | Base64 near auth context, JDBC strings |

**Zero data leaves your machine** — all pattern matching is local regex, no network calls, no API key needed.

---

## 🏗️ Smart Precheck

```bash
gitm8 precheck
```

Auto-detects your project framework and runs the right build command:

| Framework | Build Command | Detected by |
|-----------|--------------|------------|
| **Node.js** | `npm run build` | `package.json` with build script |
| **Rust** | `cargo build` | `Cargo.toml` |
| **Go** | `go build ./...` | `go.mod` |
| **Python** | _(skipped)_ | `requirements.txt`, `pyproject.toml` |
| **.NET** | `dotnet build` | `.csproj` / `.sln` files |
| **Dart/Flutter** | `dart compile` | `pubspec.yaml` |

On success → offers to push with one keystroke. On failure → blocks push, shows errors.

---

## 📝 AI Commit Messages

```bash
gitm8 commit                # interactive flow
gitm8 commit -y             # accept first message, no review
gitm8 commit --dry-run      # preview without committing
```

- **6 tone presets** — neutral, concise, detailed, formal, casual, funny
- **Custom tone** — "write like a pirate", "very technical"
- **Conventional commits** — `feat:`, `fix:`, `chore:`, or freeform
- **Works with any provider** — OpenAI, local LLMs (LM Studio, Ollama), Azure, any OpenAI-compatible endpoint

---

## ⚙️ Configuration

### Web UI (easiest)

```bash
gitm8 config --ui
```

### CLI

```bash
gitm8 config set apiKey sk-...
gitm8 config set model gpt-4o-mini
gitm8 config set tone casual
gitm8 config set pipelinePrecheck true
gitm8 config set pipelineAutoPush true
```

### All Config Keys

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `apiBaseUrl` | string | `https://api.openai.com/v1` | Any OpenAI-compatible endpoint |
| `apiKey` | string | — | Your API key (masked in output) |
| `model` | string | `gpt-4o-mini` | Model your provider supports |
| `tone` | string | `concise` | neutral, concise, detailed, formal, casual, funny, custom |
| `customTone` | string | — | Free-form tone (used when tone=custom) |
| `commitStyle` | string | `conventional` | `conventional` or `freeform` |
| `maxDiffChars` | number | `6000` | Max diff chars sent to AI (1000–50000) |
| `pipelineSecretsScan` | boolean | `true` | 🔐 Run secrets scan before commit |
| `pipelinePrecheck` | boolean | `false` | 🏗️  Run build after commit |
| `pipelineAutoPush` | boolean | `false` | 🚀 Auto-push after commit+build |

---

## 📦 Installation

### Global (recommended)

```bash
npm install -g gitm8
```

### From source

```bash
git clone https://github.com/tharanitharan305/gitm8.git
cd gitm8
npm install
npm link
```

### From GitHub Packages

```bash
npm install @tharanitharan305/gitm8
```

---

## 🔧 Requirements

- **Node.js** >= 18
- **Git** (any modern version)
- An API key for **any** OpenAI-compatible provider (for commit generation)

> Secrets scan, viz, precheck, and status all work **without any API key**.

---

## 🌟 Why gitm8?

| Problem | gitm8 solution |
|---------|---------------|
| "I pushed an API key to GitHub again" | 🔐 Secrets scan runs before every commit |
| "This commit message is useless" | 🤖 AI generates meaningful messages from your actual diff |
| "Does this code even compile?" | 🏗️ Precheck builds before push |
| "Where is this method called from?" | 📊 Viz shows an interactive caller graph |
| "I forgot to push" | 🚀 Auto-push after successful build |
| "I run 5 commands every time" | ⚙️ One pipeline: scan → commit → build → push |
| "New dev onboards slowly" | 🌳 Call tree shows architecture instantly |

---

## 🗺️ Roadmap

- [x] AI commit messages with tone control
- [x] Secrets scanner (30+ patterns, all local)
- [x] Pre-push build check (multi-framework)
- [x] Code visualization with D3.js + call tree
- [ ] Commit splitting (AI-suggested granular commits)
- [ ] PR description generation from diff
- [ ] Impact analysis ("this change affects N files")
- [ ] VS Code extension

---

## 🤝 Contributing

Contributions are welcome! Open an [issue](https://github.com/tharanitharan305/gitm8/issues) or [pull request](https://github.com/tharanitharan305/gitm8/pulls).

---

<div align="center">

Made with ❤️ by [tharanitharan305](https://github.com/tharanitharan305)

**⭐ Star the repo if you find this useful!**

[GitHub](https://github.com/tharanitharan305/gitm8) · [npm](https://www.npmjs.com/package/gitm8) · [Issues](https://github.com/tharanitharan305/gitm8/issues)

</div>
