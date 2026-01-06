import * as vscode from 'vscode';
import { SidebarProvider } from './providers/sidebarProvider';
import { ruleEngine } from './services/ruleEngine';
import { aiEnhancer } from './services/aiEnhancer';
import { contextGatherer } from './services/contextGatherer';
import { llmDetector } from './services/llmDetector';
import { TaskIntent, PromptRequest } from './types';

export function activate(context: vscode.ExtensionContext) {
  console.log('Better Prompts extension is now active!');

  // Register the sidebar provider
  const sidebarProvider = new SidebarProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      SidebarProvider.viewType,
      sidebarProvider
    )
  );

  // Command: Open Sidebar
  context.subscriptions.push(
    vscode.commands.registerCommand('betterPrompts.openSidebar', () => {
      vscode.commands.executeCommand('workbench.view.extension.better-prompts');
    })
  );

  // Command: Quick Prompt from Selection
  context.subscriptions.push(
    vscode.commands.registerCommand('betterPrompts.quickPrompt', async () => {
      const input = await vscode.window.showInputBox({
        prompt: 'What do you want to do? (simple description is OK)',
        placeHolder: 'e.g., fix button, add login, make faster...'
      });

      if (!input) {
        return;
      }

      await generateAndCopyPrompt(input);
    })
  );

  // Command: Fix This Code
  context.subscriptions.push(
    vscode.commands.registerCommand('betterPrompts.fixThis', async () => {
      await quickAction('fix', 'Fix this code - identify and resolve any bugs or issues');
    })
  );

  // Command: Explain This Code
  context.subscriptions.push(
    vscode.commands.registerCommand('betterPrompts.explainThis', async () => {
      await quickAction('explain', 'Explain this code in detail');
    })
  );

  // Command: Improve This Code
  context.subscriptions.push(
    vscode.commands.registerCommand('betterPrompts.improveThis', async () => {
      await quickAction('improve', 'Improve this code - optimize and enhance');
    })
  );

  // Command: Write Tests
  context.subscriptions.push(
    vscode.commands.registerCommand('betterPrompts.testThis', async () => {
      await quickAction('test', 'Write comprehensive tests for this code');
    })
  );

  // Register context menu command handler
  context.subscriptions.push(
    vscode.commands.registerCommand('betterPrompts.contextMenuAction', async (intent: TaskIntent) => {
      await quickAction(intent, '');
    })
  );

  /**
   * Quick action handler for context menu items
   */
  async function quickAction(intent: TaskIntent, defaultInput: string) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('No active editor. Please open a file first.');
      return;
    }

    const selection = editor.selection;
    if (selection.isEmpty) {
      vscode.window.showWarningMessage('Please select some code first.');
      return;
    }

    // Optionally ask for additional context
    const additionalInput = await vscode.window.showInputBox({
      prompt: 'Any additional details? (press Enter to skip)',
      placeHolder: 'e.g., specific issue, requirements...'
    });

    const userInput = additionalInput
      ? `${defaultInput}. ${additionalInput}`
      : defaultInput;

    await generateAndCopyPrompt(userInput, intent);
  }

  /**
   * Generate an optimized prompt and copy to clipboard
   */
  async function generateAndCopyPrompt(userInput: string, providedIntent?: TaskIntent) {
    try {
      // Show progress
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Generating optimized prompt...',
          cancellable: false
        },
        async () => {
          // Detect intent if not provided
          const intent = providedIntent || ruleEngine.detectIntent(userInput);

          // Gather context
          const context = await contextGatherer.gatherContext({
            includeFile: true,
            includeSelection: true,
            includeProject: false
          });

          // Create request
          const request: PromptRequest = {
            intent,
            userInput,
            context,
            includeContext: {
              file: true,
              selection: true,
              project: false,
              git: false
            }
          };

          // Get rule-based enhancement
          const ruleResult = ruleEngine.enhance(request);

          // Try AI enhancement
          const finalResult = await aiEnhancer.enhance(userInput, ruleResult.prompt);

          // Copy to clipboard
          await vscode.env.clipboard.writeText(finalResult.prompt);

          // Show success with preview
          const preview = finalResult.prompt.length > 100
            ? finalResult.prompt.substring(0, 100) + '...'
            : finalResult.prompt;

          const enhanceType = finalResult.wasAiEnhanced ? '(AI-enhanced)' : '(rule-based)';

          vscode.window.showInformationMessage(
            `Prompt copied! ${enhanceType}`,
            'Show Full Prompt'
          ).then(selection => {
            if (selection === 'Show Full Prompt') {
              // Show in output channel
              const outputChannel = vscode.window.createOutputChannel('Better Prompts');
              outputChannel.clear();
              outputChannel.appendLine('=== Generated Prompt ===\n');
              outputChannel.appendLine(finalResult.prompt);
              outputChannel.show();
            }
          });
        }
      );
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to generate prompt: ${error}`);
    }
  }

  // Status bar item showing detected LLM
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.command = 'betterPrompts.openSidebar';
  context.subscriptions.push(statusBarItem);

  // Update status bar
  async function updateStatusBar() {
    const detection = await llmDetector.detect();
    statusBarItem.text = `$(sparkle) Better Prompts`;
    statusBarItem.tooltip = `AI: ${detection.displayName}\nClick to open prompt builder`;
    statusBarItem.show();
  }

  updateStatusBar();

  // Listen for configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('betterPrompts')) {
        // Clear all caches so new settings take effect on next refresh
        llmDetector.clearCache();
        aiEnhancer.clearCache();
      }
    })
  );

  // Listen for active editor changes to update context
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(() => {
      sidebarProvider.refresh();
    })
  );

  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorSelection(() => {
      sidebarProvider.refresh();
    })
  );
}

export function deactivate() {
  console.log('Better Prompts extension deactivated');
}
