import * as vscode from 'vscode';
import { TaskIntent, PromptRequest } from '../types';
import { ruleEngine } from '../services/ruleEngine';
import { aiEnhancer } from '../services/aiEnhancer';
import { contextGatherer } from '../services/contextGatherer';
import { INTENT_LABELS } from '../templates/promptTemplates';

export class SidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'betterPrompts.sidebar';
  private _view?: vscode.WebviewView;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    webviewView.webview.html = this._getHtmlContent(webviewView.webview);

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'generate':
          await this._handleGenerate(message);
          break;
        case 'copy':
          await this._handleCopy(message.text);
          break;
        case 'checkStatus':
          await this._handleCheckStatus();
          break;
        case 'addCurrentFile':
          await this._handleAddCurrentFile();
          break;
        case 'addSelection':
          await this._handleAddSelection();
          break;
        case 'browseFile':
          await this._handleBrowseFile();
          break;
        case 'openSettings':
          await this._handleOpenSettings();
          break;
        case 'setupOllama':
          await this._handleSetupOllama();
          break;
      }
    });

    // Initial status check
    this._handleCheckStatus();
  }

  private async _handleGenerate(message: {
    intent: TaskIntent;
    userInput: string;
    contextItems: Array<{ type: string; name: string; content: string; path: string; language?: string }>;
  }) {
    try {
      // Show loading state
      this._view?.webview.postMessage({ command: 'loading', loading: true });

      // Build context string from context items
      let contextStr = '';
      const hasFile = message.contextItems.some(item => item.type === 'file');
      const hasSelection = message.contextItems.some(item => item.type === 'selection');

      for (const item of message.contextItems) {
        if (item.type === 'file') {
          contextStr += `\n## File: ${item.name.replace('📄 ', '')}\n`;
          if (item.language) {
            contextStr += `Language: ${item.language}\n`;
          }
          contextStr += '```' + (item.language || '') + '\n';
          contextStr += item.content;
          contextStr += '\n```\n';
        } else if (item.type === 'selection') {
          contextStr += `\n## Selected Code: ${item.name.replace('✂️ ', '')}\n`;
          contextStr += '```' + (item.language || '') + '\n';
          contextStr += item.content;
          contextStr += '\n```\n';
        }
      }

      // Create a minimal context object for rule engine
      const context = {
        fileName: message.contextItems.find(i => i.type === 'file')?.name.replace('📄 ', '') || undefined,
        language: message.contextItems.find(i => i.type === 'file')?.language || undefined,
        selectedCode: message.contextItems.find(i => i.type === 'selection')?.content || undefined
      };

      // Create prompt request for rule engine
      const request: PromptRequest = {
        intent: message.intent,
        userInput: message.userInput,
        context,
        includeContext: {
          file: hasFile,
          selection: hasSelection,
          project: false,
          git: false
        }
      };

      // Get rule-based enhancement for the description
      const ruleResult = ruleEngine.enhance(request);

      // Try AI enhancement (only enhances the user's description)
      const aiResult = await aiEnhancer.enhance(message.userInput, message.userInput);

      // Build final prompt
      let finalPrompt: string;
      if (aiResult.wasAiEnhanced) {
        // Use AI-enhanced description + our context
        finalPrompt = aiResult.prompt;
        if (contextStr) {
          finalPrompt += '\n\n--- Context ---' + contextStr;
        }
      } else {
        // Use rule-based result + our custom context
        // Start with enhanced description from rule engine
        finalPrompt = ruleResult.prompt.split('\n\n---')[0]; // Get just the enhanced text
        if (contextStr) {
          finalPrompt += '\n\n--- Context ---' + contextStr;
        }
      }

      // Send result back to webview
      this._view?.webview.postMessage({
        command: 'result',
        prompt: finalPrompt,
        wasAiEnhanced: aiResult.wasAiEnhanced
      });
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to generate prompt: ${error}`);
    } finally {
      this._view?.webview.postMessage({ command: 'loading', loading: false });
    }
  }

  private async _handleCopy(text: string) {
    await vscode.env.clipboard.writeText(text);
    vscode.window.showInformationMessage('Prompt copied to clipboard!');
  }

  private async _handleCheckStatus() {
    const status = await aiEnhancer.getStatus();
    this._view?.webview.postMessage({
      command: 'statusUpdate',
      ...status
    });
  }

  private async _handleAddCurrentFile() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      this._view?.webview.postMessage({
        command: 'contextError',
        error: 'No active file open'
      });
      return;
    }

    const document = editor.document;
    const fileName = document.fileName.split(/[/\\]/).pop() || 'unknown';
    const content = document.getText();
    const language = document.languageId;

    this._view?.webview.postMessage({
      command: 'contextAdded',
      type: 'file',
      name: `📄 ${fileName}`,
      content: content,
      path: document.fileName,
      language: language
    });
  }

  private async _handleAddSelection() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      this._view?.webview.postMessage({
        command: 'contextError',
        error: 'No active file open'
      });
      return;
    }

    const selection = editor.selection;
    if (selection.isEmpty) {
      this._view?.webview.postMessage({
        command: 'contextError',
        error: 'No text selected'
      });
      vscode.window.showWarningMessage('Please select some code first');
      return;
    }

    const selectedText = editor.document.getText(selection);
    const fileName = editor.document.fileName.split(/[/\\]/).pop() || 'unknown';
    const startLine = selection.start.line + 1;
    const endLine = selection.end.line + 1;

    this._view?.webview.postMessage({
      command: 'contextAdded',
      type: 'selection',
      name: `✂️ ${fileName}:${startLine}-${endLine}`,
      content: selectedText,
      path: `${editor.document.fileName}:${startLine}-${endLine}`,
      language: editor.document.languageId
    });
  }

  private async _handleBrowseFile() {
    const files = await vscode.window.showOpenDialog({
      canSelectMany: true,
      openLabel: 'Add to Context',
      filters: {
        'All Files': ['*'],
        'Code Files': ['ts', 'js', 'tsx', 'jsx', 'py', 'java', 'cpp', 'c', 'go', 'rs', 'cs', 'rb', 'php']
      }
    });

    if (!files || files.length === 0) {
      return;
    }

    for (const file of files) {
      try {
        const document = await vscode.workspace.openTextDocument(file);
        const fileName = file.path.split(/[/\\]/).pop() || 'unknown';
        const content = document.getText();

        this._view?.webview.postMessage({
          command: 'contextAdded',
          type: 'file',
          name: `📄 ${fileName}`,
          content: content,
          path: file.fsPath,
          language: document.languageId
        });
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to read file: ${file.path}`);
      }
    }
  }

  private async _handleOpenSettings() {
    await vscode.commands.executeCommand('workbench.action.openSettings', 'betterPrompts');
  }

  private async _handleSetupOllama() {
    const options = [
      'Open Ollama Website',
      'Configure Ollama Settings',
      'Test Ollama Connection'
    ];

    const choice = await vscode.window.showQuickPick(options, {
      placeHolder: 'Ollama Setup Options'
    });

    switch (choice) {
      case 'Open Ollama Website':
        vscode.env.openExternal(vscode.Uri.parse('https://ollama.com'));
        break;
      case 'Configure Ollama Settings':
        await vscode.commands.executeCommand('workbench.action.openSettings', 'betterPrompts.ollama');
        break;
      case 'Test Ollama Connection':
        await this._testOllamaConnection();
        break;
    }
  }

  private async _testOllamaConnection() {
    const status = await aiEnhancer.checkOllama();

    if (status.available) {
      const models = status.models.length > 0
        ? `\n\nAvailable models: ${status.models.join(', ')}`
        : '\n\nNo models found. Run: ollama pull llama3.2';

      vscode.window.showInformationMessage(`Ollama is running!${models}`);
    } else {
      const action = await vscode.window.showErrorMessage(
        'Ollama is not running. Please start Ollama first.',
        'Open Ollama Website',
        'View Setup Guide'
      );

      if (action === 'Open Ollama Website') {
        vscode.env.openExternal(vscode.Uri.parse('https://ollama.com'));
      } else if (action === 'View Setup Guide') {
        vscode.env.openExternal(vscode.Uri.parse('https://ollama.com/download'));
      }
    }
  }

  private _getHtmlContent(webview: vscode.Webview): string {
    const intentButtons = Object.entries(INTENT_LABELS)
      .map(([key, value]) => `
        <button class="intent-btn" data-intent="${key}" title="${value.description}">
          <span class="icon">${value.icon}</span>
          <span class="label">${value.label}</span>
        </button>
      `).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Better Prompts</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background);
      padding: 12px;
    }

    .section {
      margin-bottom: 16px;
    }

    .section-header {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .intent-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 6px;
    }

    .intent-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 8px 4px;
      border: 1px solid var(--vscode-button-border, transparent);
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .intent-btn:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }

    .intent-btn.selected {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border-color: var(--vscode-focusBorder);
    }

    .intent-btn .icon {
      font-size: 16px;
      margin-bottom: 2px;
    }

    .intent-btn .label {
      font-size: 10px;
    }

    textarea {
      width: 100%;
      min-height: 80px;
      padding: 8px;
      border: 1px solid var(--vscode-input-border);
      background: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border-radius: 4px;
      resize: vertical;
      font-family: inherit;
      font-size: inherit;
    }

    textarea:focus {
      outline: none;
      border-color: var(--vscode-focusBorder);
    }

    textarea::placeholder {
      color: var(--vscode-input-placeholderForeground);
    }

    .hint {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      margin-top: 4px;
    }

    .context-count {
      font-weight: normal;
      font-size: 10px;
      color: var(--vscode-descriptionForeground);
    }

    .context-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      min-height: 28px;
      padding: 6px;
      background: var(--vscode-editor-background);
      border-radius: 4px;
      margin-bottom: 8px;
    }

    .context-empty {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      font-style: italic;
    }

    .context-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 8px;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      border-radius: 12px;
      font-size: 11px;
      max-width: 150px;
    }

    .context-chip .chip-text {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .context-chip .chip-remove {
      cursor: pointer;
      opacity: 0.7;
      font-size: 10px;
    }

    .context-chip .chip-remove:hover {
      opacity: 1;
    }

    .context-chip.selection {
      background: var(--vscode-charts-blue);
      color: white;
    }

    .context-chip.file {
      background: var(--vscode-charts-green);
      color: white;
    }

    .context-buttons {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }

    .add-context-btn {
      padding: 4px 10px;
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: 1px dashed var(--vscode-button-border, var(--vscode-descriptionForeground));
      border-radius: 4px;
      cursor: pointer;
      font-size: 11px;
      transition: all 0.15s ease;
    }

    .add-context-btn:hover {
      background: var(--vscode-button-secondaryHoverBackground);
      border-style: solid;
    }

    .add-context-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .generate-btn {
      width: 100%;
      padding: 10px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: background 0.15s ease;
    }

    .generate-btn:hover {
      background: var(--vscode-button-hoverBackground);
    }

    .generate-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .result-box {
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
      padding: 12px;
      max-height: 300px;
      overflow-y: auto;
    }

    .result-text {
      white-space: pre-wrap;
      word-break: break-word;
      font-size: 12px;
      line-height: 1.5;
    }

    .result-actions {
      display: flex;
      gap: 8px;
      margin-top: 8px;
    }

    .copy-btn {
      flex: 1;
      padding: 8px;
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }

    .copy-btn:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }

    .status-bar {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      padding: 8px 0;
      border-top: 1px solid var(--vscode-panel-border);
      margin-top: 12px;
    }

    .status-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
    }

    .status-left {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .status-indicator {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--vscode-charts-green);
    }

    .status-indicator.inactive {
      background: var(--vscode-charts-yellow);
    }

    .status-indicator.error {
      background: var(--vscode-charts-red);
    }

    .badge {
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 10px;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
    }

    .badge.ai {
      background: var(--vscode-charts-green);
      color: white;
    }

    .loading {
      display: none;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .loading.active {
      display: flex;
    }

    .spinner {
      width: 20px;
      height: 20px;
      border: 2px solid var(--vscode-progressBar-background);
      border-top-color: var(--vscode-button-background);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .context-info {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      background: var(--vscode-editor-background);
      padding: 6px 8px;
      border-radius: 4px;
      margin-bottom: 8px;
    }

    .hidden {
      display: none !important;
    }

    .settings-btn {
      background: none;
      border: none;
      color: var(--vscode-descriptionForeground);
      cursor: pointer;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 11px;
    }

    .settings-btn:hover {
      background: var(--vscode-button-secondaryHoverBackground);
      color: var(--vscode-foreground);
    }

    .status-buttons {
      display: flex;
      gap: 2px;
    }

    .settings-btn.spinning {
      animation: spin 0.8s linear infinite;
    }

    .setup-banner {
      background: var(--vscode-editorInfo-background, rgba(0, 122, 204, 0.1));
      border: 1px solid var(--vscode-editorInfo-border, #007acc);
      border-radius: 4px;
      padding: 10px;
      margin-bottom: 12px;
      font-size: 12px;
    }

    .setup-banner-title {
      font-weight: 600;
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .setup-banner-text {
      color: var(--vscode-descriptionForeground);
      margin-bottom: 8px;
      line-height: 1.4;
    }

    .setup-banner-btn {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      padding: 6px 12px;
      cursor: pointer;
      font-size: 11px;
    }

    .setup-banner-btn:hover {
      background: var(--vscode-button-hoverBackground);
    }

    .models-list {
      font-size: 10px;
      color: var(--vscode-descriptionForeground);
      margin-top: 4px;
    }
  </style>
</head>
<body>
  <!-- Ollama Setup Banner (shown when not available) -->
  <div class="setup-banner hidden" id="setupBanner">
    <div class="setup-banner-title">
      🦙 Enable AI Enhancement (Free)
    </div>
    <div class="setup-banner-text">
      Install Ollama for free, local AI enhancement. No API keys needed!
    </div>
    <button class="setup-banner-btn" id="setupOllamaBtn">
      Setup Ollama
    </button>
  </div>

  <!-- Intent Selection (shown only in rule-based mode) -->
  <div class="section hidden" id="intentSection">
    <div class="section-header">
      🎯 What do you want to do?
    </div>
    <div class="intent-grid">
      ${intentButtons}
    </div>
  </div>

  <!-- User Input -->
  <div class="section">
    <div class="section-header">
      📝 Describe (simple is OK)
    </div>
    <textarea
      id="userInput"
      placeholder="Example: button not work when click&#10;&#10;Just describe your issue in simple words..."
    ></textarea>
    <div class="hint">Don't worry about grammar - we'll improve it!</div>
  </div>

  <!-- Context Options -->
  <div class="section">
    <div class="section-header">
      📎 Context
      <span class="context-count" id="contextCount">(0 items)</span>
    </div>
    <div class="context-chips" id="contextChips">
      <span class="context-empty" id="contextEmpty">No context added</span>
    </div>
    <div class="context-buttons">
      <button class="add-context-btn" id="addCurrentFile" title="Add current file">
        + File
      </button>
      <button class="add-context-btn" id="addSelection" title="Add selected code">
        + Selection
      </button>
      <button class="add-context-btn" id="addOtherFile" title="Browse and add file">
        + Browse...
      </button>
    </div>
  </div>

  <!-- Generate Button -->
  <div class="section">
    <button class="generate-btn" id="generateBtn">
      <span>✨</span>
      <span>Generate Optimized Prompt</span>
    </button>
  </div>

  <!-- Loading -->
  <div class="loading" id="loading">
    <div class="spinner"></div>
  </div>

  <!-- Result -->
  <div class="section hidden" id="resultSection">
    <div class="section-header">
      📋 Your Optimized Prompt
      <span class="badge" id="enhancementBadge">Rule-based</span>
    </div>
    <div class="result-box">
      <div class="result-text" id="resultText"></div>
    </div>
    <div class="result-actions">
      <button class="copy-btn" id="copyBtn">
        📋 Copy to Clipboard
      </button>
    </div>
  </div>

  <!-- Status Bar -->
  <div class="status-bar">
    <div class="status-row">
      <div class="status-left">
        <div class="status-indicator" id="statusIndicator"></div>
        <span id="statusText">Checking AI status...</span>
      </div>
      <div class="status-buttons">
        <button class="settings-btn" id="refreshBtn" title="Refresh Status">🔄</button>
        <button class="settings-btn" id="settingsBtn" title="Open Settings">⚙️</button>
      </div>
    </div>
    <div class="models-list hidden" id="modelsList"></div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    // State
    let selectedIntent = 'fix';
    let generatedPrompt = '';
    let contextItems = []; // Array of {type, name, content, path}

    // Elements
    const intentBtns = document.querySelectorAll('.intent-btn');
    const userInput = document.getElementById('userInput');
    const generateBtn = document.getElementById('generateBtn');
    const resultSection = document.getElementById('resultSection');
    const resultText = document.getElementById('resultText');
    const copyBtn = document.getElementById('copyBtn');
    const loading = document.getElementById('loading');
    const statusIndicator = document.getElementById('statusIndicator');
    const statusText = document.getElementById('statusText');
    const enhancementBadge = document.getElementById('enhancementBadge');
    const settingsBtn = document.getElementById('settingsBtn');
    const setupBanner = document.getElementById('setupBanner');
    const setupOllamaBtn = document.getElementById('setupOllamaBtn');
    const modelsList = document.getElementById('modelsList');
    const contextChips = document.getElementById('contextChips');
    const contextCount = document.getElementById('contextCount');
    const contextEmpty = document.getElementById('contextEmpty');
    const addCurrentFileBtn = document.getElementById('addCurrentFile');
    const addSelectionBtn = document.getElementById('addSelection');
    const addOtherFileBtn = document.getElementById('addOtherFile');
    const intentSection = document.getElementById('intentSection');

    // Intent selection
    intentBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        intentBtns.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedIntent = btn.dataset.intent;
      });
    });

    // Select first intent by default
    intentBtns[0]?.classList.add('selected');

    // Context management
    function updateContextUI() {
      // Clear existing chips (except empty message)
      const existingChips = contextChips.querySelectorAll('.context-chip');
      existingChips.forEach(chip => chip.remove());

      if (contextItems.length === 0) {
        contextEmpty.style.display = 'block';
        contextCount.textContent = '(0 items)';
      } else {
        contextEmpty.style.display = 'none';
        contextCount.textContent = '(' + contextItems.length + ' item' + (contextItems.length > 1 ? 's' : '') + ')';

        contextItems.forEach((item, index) => {
          const chip = document.createElement('span');
          chip.className = 'context-chip ' + item.type;
          chip.innerHTML = '<span class="chip-text">' + item.name + '</span><span class="chip-remove" data-index="' + index + '">✕</span>';
          contextChips.appendChild(chip);
        });

        // Add remove handlers
        contextChips.querySelectorAll('.chip-remove').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.index);
            contextItems.splice(index, 1);
            updateContextUI();
          });
        });
      }
    }

    function addContextItem(type, name, content, path) {
      // Check for duplicates
      const exists = contextItems.some(item =>
        item.type === type && item.path === path && item.name === name
      );
      if (!exists) {
        contextItems.push({ type, name, content, path });
        updateContextUI();
      }
    }

    // Add current file button
    addCurrentFileBtn.addEventListener('click', () => {
      vscode.postMessage({ command: 'addCurrentFile' });
    });

    // Add selection button
    addSelectionBtn.addEventListener('click', () => {
      vscode.postMessage({ command: 'addSelection' });
    });

    // Add other file button
    addOtherFileBtn.addEventListener('click', () => {
      vscode.postMessage({ command: 'browseFile' });
    });

    // Generate button
    generateBtn.addEventListener('click', () => {
      const input = userInput.value.trim();
      if (!input) {
        return;
      }

      vscode.postMessage({
        command: 'generate',
        intent: selectedIntent,
        userInput: input,
        contextItems: contextItems
      });
    });

    // Copy button
    copyBtn.addEventListener('click', () => {
      if (generatedPrompt) {
        vscode.postMessage({
          command: 'copy',
          text: generatedPrompt
        });
      }
    });

    // Settings button
    settingsBtn.addEventListener('click', () => {
      vscode.postMessage({ command: 'openSettings' });
    });

    // Refresh button
    const refreshBtn = document.getElementById('refreshBtn');
    refreshBtn.addEventListener('click', () => {
      refreshBtn.classList.add('spinning');
      vscode.postMessage({ command: 'checkStatus' });
      // Remove spinning after a short delay
      setTimeout(() => refreshBtn.classList.remove('spinning'), 800);
    });

    // Setup Ollama button
    setupOllamaBtn.addEventListener('click', () => {
      vscode.postMessage({ command: 'setupOllama' });
    });

    // Handle messages from extension
    window.addEventListener('message', event => {
      const message = event.data;

      switch (message.command) {
        case 'loading':
          loading.classList.toggle('active', message.loading);
          generateBtn.disabled = message.loading;
          break;

        case 'result':
          generatedPrompt = message.prompt;
          resultText.textContent = message.prompt;
          resultSection.classList.remove('hidden');
          enhancementBadge.textContent = message.wasAiEnhanced ? 'AI-enhanced' : 'Rule-based';
          enhancementBadge.classList.toggle('ai', message.wasAiEnhanced);
          break;

        case 'statusUpdate':
          updateStatus(message);
          break;

        case 'contextAdded':
          if (message.type && message.name) {
            addContextItem(message.type, message.name, message.content, message.path);
          }
          break;

        case 'contextError':
          // Could show a toast or notification
          console.log('Context error:', message.error);
          break;
      }
    });

    function updateStatus(status) {
      const { provider, available, models, mode } = status;

      // Update indicator
      statusIndicator.classList.remove('inactive', 'error');
      if (!available && mode !== 'ruleOnly') {
        statusIndicator.classList.add('inactive');
      }

      // Determine if we're in rule-based mode (either by setting or no AI available)
      const isRuleBased = mode === 'ruleOnly' || !available;

      // Show/hide intent section based on mode
      if (isRuleBased) {
        intentSection.classList.remove('hidden');
      } else {
        intentSection.classList.add('hidden');
      }

      // Update text
      if (mode === 'ruleOnly') {
        statusText.textContent = 'Mode: Rule-based only';
        setupBanner.classList.add('hidden');
        modelsList.classList.add('hidden');
      } else if (available) {
        statusText.textContent = 'AI: ' + provider;
        setupBanner.classList.add('hidden');

        // Show models if available
        if (models && models.length > 0) {
          modelsList.textContent = 'Models: ' + models.slice(0, 3).join(', ') +
            (models.length > 3 ? ' +' + (models.length - 3) + ' more' : '');
          modelsList.classList.remove('hidden');
        } else {
          modelsList.classList.add('hidden');
        }
      } else {
        statusText.textContent = 'Mode: Rule-based';
        setupBanner.classList.remove('hidden');
        modelsList.classList.add('hidden');
      }
    }

    // Request initial status
    vscode.postMessage({ command: 'checkStatus' });
  </script>
</body>
</html>`;
  }

  /**
   * Refresh the webview (called from commands)
   */
  public refresh() {
    if (this._view) {
      this._view.webview.postMessage({ command: 'getContext' });
      this._view.webview.postMessage({ command: 'checkStatus' });
    }
  }

  /**
   * Set user input programmatically (for quick prompts)
   */
  public setInput(intent: TaskIntent, input: string) {
    if (this._view) {
      this._view.webview.postMessage({
        command: 'setInput',
        intent,
        input
      });
    }
  }
}
