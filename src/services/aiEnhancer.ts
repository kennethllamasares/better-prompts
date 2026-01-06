import * as vscode from 'vscode';
import { LLMProvider, EnhancedPrompt } from '../types';
import { llmDetector } from './llmDetector';

/**
 * System prompt for AI enhancement
 */
const ENHANCEMENT_SYSTEM_PROMPT = `You are a prompt enhancement assistant. Your job is to take a user's simple or broken English input and transform it into a clear, well-structured prompt for an AI coding assistant.

Rules:
1. Keep the user's intent - don't change what they're asking for
2. Fix grammar and spelling
3. Add technical terminology where appropriate
4. Make the request clear and specific
5. Keep it concise - don't over-elaborate
6. Output ONLY the enhanced prompt, no explanations or prefixes

Example:
Input: "button not work when click"
Output: "Fix the button click handler that is not responding to user interactions. Debug why the onClick event is not firing and ensure proper event binding."

Example:
Input: "make fast"
Output: "Optimize this code for better performance. Identify bottlenecks and reduce unnecessary computations."`;

/**
 * Check if Ollama is running
 */
async function isOllamaRunning(endpoint: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    const response = await fetch(`${endpoint}/api/tags`, {
      signal: controller.signal
    });

    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get available Ollama models
 */
async function getOllamaModels(endpoint: string): Promise<string[]> {
  try {
    const response = await fetch(`${endpoint}/api/tags`);
    if (!response.ok) return [];

    const data = await response.json() as { models: Array<{ name: string }> };
    return data.models?.map(m => m.name) || [];
  } catch {
    return [];
  }
}

/**
 * AI-powered prompt enhancement service
 */
export class AIEnhancer {
  private ollamaAvailable: boolean | null = null;
  private ollamaModels: string[] = [];

  /**
   * Clear cached status (call when settings change)
   */
  clearCache(): void {
    this.ollamaAvailable = null;
    this.ollamaModels = [];
  }

  /**
   * Check Ollama availability and cache result
   */
  async checkOllama(): Promise<{ available: boolean; models: string[] }> {
    const config = vscode.workspace.getConfiguration('betterPrompts');
    const endpoint = config.get<string>('ollamaEndpoint', 'http://localhost:11434');

    this.ollamaAvailable = await isOllamaRunning(endpoint);

    if (this.ollamaAvailable) {
      this.ollamaModels = await getOllamaModels(endpoint);
    }

    return {
      available: this.ollamaAvailable,
      models: this.ollamaModels
    };
  }

  /**
   * Enhance prompt using available AI
   */
  async enhance(
    userInput: string,
    ruleEnhancedPrompt: string
  ): Promise<EnhancedPrompt> {
    const config = vscode.workspace.getConfiguration('betterPrompts');
    const mode = config.get<string>('enhancementMode', 'auto');

    // If rule-only mode, return rule-enhanced result
    if (mode === 'ruleOnly') {
      return {
        prompt: ruleEnhancedPrompt,
        preview: ruleEnhancedPrompt.substring(0, 200),
        wasAiEnhanced: false
      };
    }

    // Try AI enhancement
    try {
      if (mode === 'auto') {
        // Auto mode: try Ollama first (free), then fall back to detected LLM
        const ollamaStatus = await this.checkOllama();

        if (ollamaStatus.available && ollamaStatus.models.length > 0) {
          return await this.callOllamaAPI(userInput);
        }

        // Fall back to detected LLM
        const detection = await llmDetector.detect();
        if (detection.canEnhance) {
          return await this.enhanceWithProvider(detection.provider, userInput, ruleEnhancedPrompt);
        }
      } else if (mode === 'manual') {
        return await this.enhanceWithManualAPI(userInput, ruleEnhancedPrompt);
      }
    } catch (error) {
      console.error('AI enhancement failed, falling back to rule-based:', error);
    }

    // Fallback to rule-enhanced
    return {
      prompt: ruleEnhancedPrompt,
      preview: ruleEnhancedPrompt.substring(0, 200),
      wasAiEnhanced: false
    };
  }

  /**
   * Enhance using detected provider
   */
  private async enhanceWithProvider(
    provider: LLMProvider,
    userInput: string,
    fallback: string
  ): Promise<EnhancedPrompt> {
    switch (provider) {
      case 'cursor':
        return this.enhanceWithManualAPI(userInput, fallback);
      case 'claude-code':
        return this.enhanceWithManualAPI(userInput, fallback);
      case 'continue':
        return this.enhanceWithManualAPI(userInput, fallback);
      case 'cody':
        return this.enhanceWithManualAPI(userInput, fallback);
      default:
        return {
          prompt: fallback,
          preview: fallback.substring(0, 200),
          wasAiEnhanced: false
        };
    }
  }

  /**
   * Enhance using manually configured API
   */
  private async enhanceWithManualAPI(userInput: string, fallback: string): Promise<EnhancedPrompt> {
    const config = vscode.workspace.getConfiguration('betterPrompts');
    const provider = config.get<string>('manualProvider', 'ollama');

    // For Ollama, no API key needed
    if (provider === 'ollama') {
      return await this.callOllamaAPI(userInput);
    }

    const apiKey = config.get<string>('apiKey', '');

    if (!apiKey) {
      return {
        prompt: fallback,
        preview: fallback.substring(0, 200),
        wasAiEnhanced: false
      };
    }

    try {
      switch (provider) {
        case 'anthropic':
          return await this.callAnthropicAPI(userInput, apiKey);
        case 'openai':
          return await this.callOpenAIAPI(userInput, apiKey);
        default:
          throw new Error(`Unknown provider: ${provider}`);
      }
    } catch (error) {
      console.error(`${provider} API call failed:`, error);
      return {
        prompt: fallback,
        preview: fallback.substring(0, 200),
        wasAiEnhanced: false
      };
    }
  }

  /**
   * Call Anthropic API
   */
  private async callAnthropicAPI(userInput: string, apiKey: string): Promise<EnhancedPrompt> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 500,
        system: ENHANCEMENT_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Enhance this prompt: "${userInput}"`
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json() as {
      content: Array<{ type: string; text: string }>;
    };
    const enhanced = data.content[0]?.text || userInput;

    return {
      prompt: enhanced,
      preview: enhanced.substring(0, 200),
      wasAiEnhanced: true
    };
  }

  /**
   * Call OpenAI API
   */
  private async callOpenAIAPI(userInput: string, apiKey: string): Promise<EnhancedPrompt> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        max_tokens: 500,
        messages: [
          {
            role: 'system',
            content: ENHANCEMENT_SYSTEM_PROMPT
          },
          {
            role: 'user',
            content: `Enhance this prompt: "${userInput}"`
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
    };
    const enhanced = data.choices[0]?.message?.content || userInput;

    return {
      prompt: enhanced,
      preview: enhanced.substring(0, 200),
      wasAiEnhanced: true
    };
  }

  /**
   * Call Ollama API (local, free)
   */
  async callOllamaAPI(userInput: string): Promise<EnhancedPrompt> {
    const config = vscode.workspace.getConfiguration('betterPrompts');
    const endpoint = config.get<string>('ollamaEndpoint', 'http://localhost:11434');
    const model = config.get<string>('ollamaModel', 'llama3.2');

    try {
      const response = await fetch(`${endpoint}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model,
          prompt: `${ENHANCEMENT_SYSTEM_PROMPT}\n\nEnhance this prompt: "${userInput}"`,
          stream: false,
          options: {
            temperature: 0.7,
            num_predict: 500
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const data = await response.json() as { response: string };
      let enhanced = data.response?.trim() || userInput;

      // Clean up common artifacts from LLM responses
      enhanced = enhanced
        .replace(/^(Enhanced prompt:|Here's the enhanced prompt:|Output:)\s*/i, '')
        .replace(/^["']|["']$/g, '')
        .trim();

      return {
        prompt: enhanced,
        preview: enhanced.substring(0, 200),
        wasAiEnhanced: true
      };
    } catch (error) {
      console.error('Ollama API error:', error);
      throw error;
    }
  }

  /**
   * Get current enhancement status for UI
   */
  async getStatus(): Promise<{
    mode: string;
    provider: string;
    available: boolean;
    models?: string[];
  }> {
    const config = vscode.workspace.getConfiguration('betterPrompts');
    const mode = config.get<string>('enhancementMode', 'auto');
    const manualProvider = config.get<string>('manualProvider', 'ollama');

    if (mode === 'ruleOnly') {
      return { mode, provider: 'Rule-based', available: true };
    }

    if (mode === 'manual' && manualProvider === 'ollama') {
      const ollamaStatus = await this.checkOllama();
      return {
        mode,
        provider: 'Ollama',
        available: ollamaStatus.available,
        models: ollamaStatus.models
      };
    }

    if (mode === 'manual') {
      const apiKey = config.get<string>('apiKey', '');
      return {
        mode,
        provider: manualProvider === 'anthropic' ? 'Anthropic' : 'OpenAI',
        available: !!apiKey
      };
    }

    // Auto mode
    const ollamaStatus = await this.checkOllama();
    if (ollamaStatus.available) {
      return {
        mode,
        provider: 'Ollama (auto)',
        available: true,
        models: ollamaStatus.models
      };
    }

    const detection = await llmDetector.detect();
    return {
      mode,
      provider: detection.displayName,
      available: detection.canEnhance
    };
  }
}

export const aiEnhancer = new AIEnhancer();
