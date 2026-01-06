import * as vscode from 'vscode';
import { LLMProvider, LLMDetectionResult } from '../types';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Detects available LLM coding assistants in the environment
 */
export class LLMDetector {
  private cachedResult: LLMDetectionResult | null = null;
  private lastCheck: number = 0;
  private readonly CACHE_DURATION = 60000; // 1 minute cache

  /**
   * Check if running inside Cursor editor
   */
  private isCursorEditor(): boolean {
    // Cursor sets specific environment variables and has different app name
    const appName = vscode.env.appName?.toLowerCase() || '';
    return appName.includes('cursor');
  }

  /**
   * Check if Claude Code CLI is installed
   */
  private async isClaudeCodeInstalled(): Promise<boolean> {
    try {
      // Try to run claude --version
      await execAsync('claude --version');
      return true;
    } catch {
      // Also check for 'claude-code' command
      try {
        await execAsync('claude-code --version');
        return true;
      } catch {
        return false;
      }
    }
  }

  /**
   * Check if GitHub Copilot extension is installed
   */
  private isCopilotInstalled(): boolean {
    const copilotExtension = vscode.extensions.getExtension('GitHub.copilot');
    const copilotChat = vscode.extensions.getExtension('GitHub.copilot-chat');
    return !!(copilotExtension || copilotChat);
  }

  /**
   * Check if Continue.dev extension is installed
   */
  private isContinueInstalled(): boolean {
    const continueExtension = vscode.extensions.getExtension('Continue.continue');
    return !!continueExtension;
  }

  /**
   * Check if Cody (Sourcegraph) extension is installed
   */
  private isCodyInstalled(): boolean {
    const codyExtension = vscode.extensions.getExtension('sourcegraph.cody-ai');
    return !!codyExtension;
  }

  /**
   * Detect available LLM and return detection result
   */
  async detect(forceRefresh: boolean = false): Promise<LLMDetectionResult> {
    const now = Date.now();

    // Return cached result if valid
    if (!forceRefresh && this.cachedResult && (now - this.lastCheck) < this.CACHE_DURATION) {
      return this.cachedResult;
    }

    let result: LLMDetectionResult;

    // Priority order: Cursor > Claude Code > Continue > Cody > Copilot > None

    if (this.isCursorEditor()) {
      result = {
        provider: 'cursor',
        available: true,
        canEnhance: true,
        displayName: 'Cursor'
      };
    } else if (await this.isClaudeCodeInstalled()) {
      result = {
        provider: 'claude-code',
        available: true,
        canEnhance: true,
        displayName: 'Claude Code'
      };
    } else if (this.isContinueInstalled()) {
      result = {
        provider: 'continue',
        available: true,
        canEnhance: true,
        displayName: 'Continue.dev'
      };
    } else if (this.isCodyInstalled()) {
      result = {
        provider: 'cody',
        available: true,
        canEnhance: true,
        displayName: 'Sourcegraph Cody'
      };
    } else if (this.isCopilotInstalled()) {
      result = {
        provider: 'copilot',
        available: true,
        canEnhance: false, // Copilot doesn't have an easy API for enhancement
        displayName: 'GitHub Copilot'
      };
    } else {
      result = {
        provider: 'none',
        available: false,
        canEnhance: false,
        displayName: 'None detected'
      };
    }

    this.cachedResult = result;
    this.lastCheck = now;

    return result;
  }

  /**
   * Get all available LLMs (for settings UI)
   */
  async getAllAvailable(): Promise<LLMDetectionResult[]> {
    const results: LLMDetectionResult[] = [];

    if (this.isCursorEditor()) {
      results.push({
        provider: 'cursor',
        available: true,
        canEnhance: true,
        displayName: 'Cursor'
      });
    }

    if (await this.isClaudeCodeInstalled()) {
      results.push({
        provider: 'claude-code',
        available: true,
        canEnhance: true,
        displayName: 'Claude Code'
      });
    }

    if (this.isContinueInstalled()) {
      results.push({
        provider: 'continue',
        available: true,
        canEnhance: true,
        displayName: 'Continue.dev'
      });
    }

    if (this.isCodyInstalled()) {
      results.push({
        provider: 'cody',
        available: true,
        canEnhance: true,
        displayName: 'Sourcegraph Cody'
      });
    }

    if (this.isCopilotInstalled()) {
      results.push({
        provider: 'copilot',
        available: true,
        canEnhance: false,
        displayName: 'GitHub Copilot'
      });
    }

    // Always add manual option
    results.push({
      provider: 'manual',
      available: true,
      canEnhance: true,
      displayName: 'Manual API Configuration'
    });

    return results;
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cachedResult = null;
    this.lastCheck = 0;
  }
}

export const llmDetector = new LLMDetector();
