# Better Prompts for AI Coding Assistants

Transform simple, broken English inputs into optimized prompts for Claude Code, Cursor, Copilot, and other AI coding assistants.

![VS Code Version](https://img.shields.io/badge/VS%20Code-1.85+-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## The Problem

Writing effective prompts for AI coding assistants can be challenging, especially if:
- English isn't your first language
- You're not sure how to phrase technical requests
- You want to include the right context without copy-pasting code manually

## The Solution

Better Prompts takes your simple description and:
1. **Enhances** your text into a clear, technical prompt
2. **Adds context** from your current file, selection, or other files
3. **Copies** the optimized prompt to your clipboard

Just paste it into your favorite AI coding assistant!

## Features

- **Simple Input** - Type in plain English, broken grammar is OK
- **AI Enhancement** - Uses local AI (Ollama) or cloud APIs to improve your prompts
- **Smart Context** - Add files and code selections with one click
- **Rule-based Fallback** - Works offline with built-in templates
- **Multi-LLM Support** - Works with any AI coding assistant

## Quick Start

1. Install the extension
2. Open the Better Prompts sidebar (click the icon in the activity bar)
3. Type your request (e.g., "button not work when click")
4. Click "+ File" or "+ Selection" to add context
5. Click "Generate Optimized Prompt"
6. Paste into your AI assistant

## Installation

### From VS Code Marketplace
Search for "Better Prompts" in the Extensions view (`Ctrl+Shift+X`)

### From VSIX File
```bash
code --install-extension better-prompts-0.1.0.vsix
```

### From Source
```bash
git clone https://github.com/kennethllamasares/better-prompts.git
cd better-prompts
npm install
npm run compile
```
Then press `F5` to run in development mode.

## Configuration

Open Settings (`Ctrl+,`) and search for "Better Prompts".

### Enhancement Mode

| Setting | Description |
|---------|-------------|
| `auto` (default) | Auto-detect available AI and use it |
| `ruleOnly` | Use rule-based enhancement only (offline) |
| `manual` | Manually configure which API to use |

### AI Providers

#### Ollama (Recommended - Free & Local)

1. Install Ollama from [ollama.com](https://ollama.com)
2. Pull a model: `ollama pull llama3.2`
3. Start Ollama (it runs in background)
4. Better Prompts will auto-detect it!

**Settings:**
- `betterPrompts.ollamaEndpoint`: API endpoint (default: `http://localhost:11434`)
- `betterPrompts.ollamaModel`: Model to use (default: `llama3.2`)

#### Anthropic (Claude API)

1. Get an API key from [console.anthropic.com](https://console.anthropic.com)
2. Set `betterPrompts.enhancementMode` to `manual`
3. Set `betterPrompts.manualProvider` to `anthropic`
4. Set `betterPrompts.apiKey` to your API key

#### OpenAI (GPT API)

1. Get an API key from [platform.openai.com](https://platform.openai.com)
2. Set `betterPrompts.enhancementMode` to `manual`
3. Set `betterPrompts.manualProvider` to `openai`
4. Set `betterPrompts.apiKey` to your API key

## Usage Examples

### Example 1: Fix a Bug

**Your input:**
```
button not work when click
```

**Generated prompt:**
```
Fix the button click handler that is not responding to user interactions.
Debug why the onClick event is not firing and ensure proper event binding.

--- Context ---
## File: App.tsx
Language: typescriptreact
[code content here]
```

### Example 2: Add a Feature

**Your input:**
```
add login with google
```

**Generated prompt:**
```
Implement Google OAuth authentication for user login. Set up the OAuth flow,
handle the callback, and store user session data securely.

--- Context ---
## Selected Code: auth.ts:15-42
[selected code here]
```

## Context Options

| Button | Description |
|--------|-------------|
| `+ File` | Add the current open file |
| `+ Selection` | Add currently selected code |
| `+ Browse...` | Browse and add any file(s) |

Added context appears as chips that can be removed by clicking the X.

## Rule-Based Mode

When no AI is available (or in `ruleOnly` mode), the extension uses:
- **Intent detection** - Automatically detects if you want to fix, add, explain, etc.
- **Word expansion** - Expands abbreviations (btn → button, func → function)
- **Technical terms** - Adds relevant technical terminology
- **Templates** - Applies professional prompt templates

Intent buttons appear in rule-based mode to help guide the prompt generation.

## Commands

| Command | Description |
|---------|-------------|
| `Better Prompts: Open Prompt Builder` | Open the sidebar |
| `Better Prompts: Quick Prompt from Selection` | Quick prompt with selected code |
| `Better Prompts: Fix This Code` | Generate a fix prompt |
| `Better Prompts: Explain This Code` | Generate an explanation prompt |
| `Better Prompts: Improve This Code` | Generate an improvement prompt |
| `Better Prompts: Write Tests for This` | Generate a testing prompt |

## Keyboard Shortcuts

| Shortcut | Command |
|----------|---------|
| `Ctrl+Shift+P Ctrl+Shift+B` | Quick Prompt from Selection |

## Context Menu

Right-click on selected code to access Better Prompts actions in the context menu.

## Troubleshooting

### Ollama not detected
1. Make sure Ollama is running: `ollama serve`
2. Check the endpoint setting matches your setup
3. Click the refresh button (🔄) in the status bar

### AI enhancement not working
1. Check your API key is correct
2. Verify you have internet connection (for cloud APIs)
3. Try switching to `ruleOnly` mode to test

### Extension not loading
1. Check VS Code version is 1.85 or higher
2. Try reloading the window (`Ctrl+Shift+P` → "Reload Window")

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- Built with the VS Code Extension API
- AI enhancement powered by Ollama, Anthropic, and OpenAI
