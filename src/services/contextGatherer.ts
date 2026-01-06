import * as vscode from 'vscode';
import * as path from 'path';
import { PromptContext } from '../types';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Gathers context from VS Code environment
 */
export class ContextGatherer {
  /**
   * Get current file information
   */
  getCurrentFileInfo(): Partial<PromptContext> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return {};
    }

    const document = editor.document;
    const fileName = path.basename(document.fileName);
    const filePath = document.fileName;
    const language = document.languageId;

    return {
      fileName,
      filePath,
      language
    };
  }

  /**
   * Get selected code from active editor
   */
  getSelectedCode(): string | undefined {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return undefined;
    }

    const selection = editor.selection;
    if (selection.isEmpty) {
      return undefined;
    }

    return editor.document.getText(selection);
  }

  /**
   * Get project structure (simplified)
   */
  async getProjectStructure(maxDepth: number = 2): Promise<string | undefined> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return undefined;
    }

    const rootPath = workspaceFolder.uri.fsPath;

    try {
      // Get top-level structure
      const structure = await this.buildStructure(rootPath, maxDepth);
      return structure;
    } catch {
      return undefined;
    }
  }

  private async buildStructure(dirPath: string, depth: number, prefix: string = ''): Promise<string> {
    if (depth <= 0) {
      return '';
    }

    const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(dirPath));
    const lines: string[] = [];

    // Filter out common non-essential directories
    const ignoreDirs = ['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', '.vscode', 'coverage', '.cache'];
    const ignoreFiles = ['.DS_Store', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'];

    const filteredEntries = entries.filter(([name]) => {
      return !ignoreDirs.includes(name) && !ignoreFiles.includes(name) && !name.startsWith('.');
    });

    // Sort: directories first, then files
    filteredEntries.sort((a, b) => {
      if (a[1] === vscode.FileType.Directory && b[1] !== vscode.FileType.Directory) return -1;
      if (a[1] !== vscode.FileType.Directory && b[1] === vscode.FileType.Directory) return 1;
      return a[0].localeCompare(b[0]);
    });

    // Limit number of entries shown
    const maxEntries = 15;
    const displayEntries = filteredEntries.slice(0, maxEntries);

    for (const [name, type] of displayEntries) {
      if (type === vscode.FileType.Directory) {
        lines.push(`${prefix}📁 ${name}/`);
        if (depth > 1) {
          const subStructure = await this.buildStructure(
            path.join(dirPath, name),
            depth - 1,
            prefix + '  '
          );
          if (subStructure) {
            lines.push(subStructure);
          }
        }
      } else {
        lines.push(`${prefix}📄 ${name}`);
      }
    }

    if (filteredEntries.length > maxEntries) {
      lines.push(`${prefix}... and ${filteredEntries.length - maxEntries} more items`);
    }

    return lines.join('\n');
  }

  /**
   * Get git status
   */
  async getGitStatus(): Promise<string | undefined> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return undefined;
    }

    try {
      const { stdout } = await execAsync('git status --short', {
        cwd: workspaceFolder.uri.fsPath
      });

      if (!stdout.trim()) {
        return 'No changes';
      }

      return stdout.trim();
    } catch {
      return undefined;
    }
  }

  /**
   * Get related files (imports from current file)
   */
  async getRelatedFiles(): Promise<string[] | undefined> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return undefined;
    }

    const document = editor.document;
    const text = document.getText();
    const relatedFiles: string[] = [];

    // Simple import detection patterns
    const importPatterns = [
      // ES6 imports: import ... from '...'
      /import\s+.*\s+from\s+['"]([^'"]+)['"]/g,
      // CommonJS require: require('...')
      /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
      // Python imports: from ... import or import ...
      /from\s+([^\s]+)\s+import/g,
      /^import\s+([^\s]+)/gm
    ];

    for (const pattern of importPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const importPath = match[1];
        // Only include relative imports
        if (importPath.startsWith('.') || importPath.startsWith('/')) {
          relatedFiles.push(importPath);
        }
      }
    }

    return relatedFiles.length > 0 ? [...new Set(relatedFiles)] : undefined;
  }

  /**
   * Gather full context based on options
   */
  async gatherContext(options: {
    includeFile?: boolean;
    includeSelection?: boolean;
    includeProject?: boolean;
    includeGit?: boolean;
    includeRelated?: boolean;
  }): Promise<PromptContext> {
    const context: PromptContext = {};

    if (options.includeFile !== false) {
      const fileInfo = this.getCurrentFileInfo();
      Object.assign(context, fileInfo);
    }

    if (options.includeSelection !== false) {
      context.selectedCode = this.getSelectedCode();
    }

    if (options.includeProject) {
      context.projectStructure = await this.getProjectStructure();
    }

    if (options.includeGit) {
      context.gitStatus = await this.getGitStatus();
    }

    if (options.includeRelated) {
      context.relatedFiles = await this.getRelatedFiles();
    }

    return context;
  }
}

export const contextGatherer = new ContextGatherer();
