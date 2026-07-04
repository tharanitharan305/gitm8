# gitm8 🤖

**AI-powered Git CLI wrapper** — stage, commit, and push with smart defaults and AI-generated commit messages that actually describe what you changed.

```bash
npm install -g gitm8
```

## Why gitm8?

You write code, not commit messages. `gitm8` reads your staged diff, sends it to an AI (OpenAI, local LLM, or any OpenAI-compatible provider), and presents a polished commit message for review — all from your terminal.

All git operations go through `gitm8`, not raw `git`. It's a thin, opinionated wrapper — not a full reimplementation.

## Commands

### `gitm8 add [files...]`

Stage files for commit. Defaults to `.` (all changes) if no files given.

```bash
gitm8 add                    # stage everything
gitm8 add src/index.js       # stage a single file
```

Shows a colored summary of staged files after running.

### `gitm8 commit`

Generate an AI commit message from staged changes and commit interactively.

```bash
gitm8 commit                 # full interactive flow
gitm8 commit -y              # accept first AI message, no review
gitm8 commit --dry-run       # show message without committing
```

The interactive prompt gives you options to:
- `[Enter]` **Accept and commit**
- `[e]` **Edit** the message manually before committing
- `[r]` **Regenerate** the message
- `[t]` **Change tone** and regenerate
- `[q]` **Quit** without committing

### `gitm8 precheck`

**Smart pre-push gate.** Detects your project framework → runs the build → offers to push on success.

```bash
gitm8 precheck
```

What it does:
1. 🔍 **Detects** your framework (Node.js, Rust, Go, Python, .NET, Dart, Deno)
2. 🏗️ **Runs** the appropriate build command (`npm run build`, `cargo build`, etc.)
3. 📛 **Shows** your current branch name
4. ✅ On **success** — asks: *"Push to `<branch>`?"* and pushes with one `[Y]`
5. ❌ On **failure** — blocks the push and shows the build errors

```
📦 Precheck — Branch: feature/new-ui
  Framework:  Node.js
  Build:      running `npm run build`...

> my-app@1.0.0 build
> vite build

✓ built in 2.3s

✔ Build passed!

? Push to feature/new-ui?  (Y/n)
```

### `gitm8 secrets-scan`

**Detect secrets before they reach GitHub.** Scans every staged file for API keys, tokens, credentials, private keys, and other sensitive data — all locally, no AI needed, no data leaves your machine.

```bash
gitm8 secrets-scan
```

What it detects:
- 🔴 **Critical** — AWS keys, GitHub tokens, Slack/Discord tokens, private keys, bearer tokens
- 🟡 **High** — Stripe keys, Google API keys, MongoDB/Postgres connection strings, npm tokens, Azure secrets, service accounts
- 🔵 **Medium** — Password/config values, JWT tokens, .env files staged, sensitive file extensions (.pem, .key, .cert)
- ⚪ **Low** — Base64 blobs near auth context, JDBC strings

If critical or high secrets are found, you can:
- **Unstage** the offending files automatically
- **Continue** anyway (not recommended)
- **Cancel** and fix first

```
🔐 Secrets Scan
  Scanning staged files for secrets, keys, and credentials...

⚠  3 potential secrets found

▌ CRITICAL  1 result:
    config/credentials.json
      L5:12  GitHub Token — GitHub personal access token
             `ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

▌   HIGH    2 results:
    .env
      L1:1  .env Variable — Environment variable `DB_PASSWORD` with a non-placeholder value
             `DB_PASSWORD=supersecret123`

──────────────────────────────────────────────────
⚠  1 critical secret detected!

? Critical secrets found! What would you like to do?
  › Unstage files with secrets    (remove from staging)
    Continue anyway               (not recommended)
    Cancel and return             (review changes first)
```

### `gitm8 push`

Push the current branch to origin. Automatically sets upstream if needed.

```bash
gitm8 push
```

### `gitm8 status`

Show working tree status with colored, reformatted output.

```bash
gitm8 status
```

### `gitm8 config`

Manage settings from the CLI or the web UI.

```bash
gitm8 config list                        # show all settings
gitm8 config get apiKey                  # show a value (masked for apiKey)
gitm8 config set model gpt-4o-mini       # set a value
gitm8 config set tone casual             # set tone preset
gitm8 config --ui                        # open settings UI in browser
```

**Config keys:**
| Key | Type | Default | Description |
|---|---|---|---|
| `apiBaseUrl` | string | `https://api.openai.com/v1` | Any OpenAI-compatible endpoint |
| `apiKey` | string | — | Your API key (never printed in plaintext) |
| `model` | string | `gpt-4o-mini` | Model name your provider supports |
| `tone` | string | `concise` | Tone preset: neutral, concise, detailed, formal, casual, funny, custom |
| `customTone` | string | — | Free-form tone description (used when tone=custom) |
| `commitStyle` | string | `conventional` | `conventional` (feat:/fix:/chore:) or `freeform` |
| `maxDiffChars` | number | `6000` | Max diff characters sent to AI (1000–50000) |

## Configuration

### Quick start

```bash
# Configure via CLI
gitm8 config set apiBaseUrl https://api.openai.com/v1
gitm8 config set apiKey sk-your-key-here
gitm8 config set model gpt-4o-mini

# Or use the web UI
gitm8 config --ui
```

### Using with any AI provider

`gitm8` speaks the OpenAI `/chat/completions` API format, so it works with:

- **OpenAI** — `https://api.openai.com/v1`
- **Local LLMs** (LM Studio, Ollama, etc.) — your local server URL
- **Azure OpenAI** — your custom endpoint
- **Any OpenAI-compatible proxy**

### Tone presets

| Preset | Effect |
|---|---|
| `neutral` | Describe changes without stylistic flourish |
| `concise` | Single line, ≤72 characters (default) |
| `detailed` | Summary line + bullet-point body explaining the why |
| `formal` | Professional, formal language |
| `casual` | Relaxed, conversational tone |
| `funny` | Light humor while staying informative |
| `custom` | Your own free-form tone instruction |

## Installation

### Global install (recommended)

```bash
npm install -g gitm8
```

### Local development

```bash
git clone <repo-url>
cd gitm8
npm install
npm link              # makes `gitm8` available globally
```

## Requirements

- **Node.js** >= 18
- **Git** (any modern version)
- An API key for your chosen AI provider

## Tips

- Run `gitm8 config --ui` for a visual settings panel
- Use `gitm8 commit --dry-run` first to preview the AI's message
- Combine with `gitm8 add` and `gitm8 push` for a full `add → commit → push` workflow
- Set `maxDiffChars` lower if your diffs are huge (saves tokens)

## License

MIT
