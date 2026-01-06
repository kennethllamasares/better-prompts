export type TaskIntent = 'fix' | 'add' | 'change' | 'explain' | 'test' | 'review' | 'improve' | 'document';

export interface PromptContext {
  fileName?: string;
  filePath?: string;
  language?: string;
  selectedCode?: string;
  projectStructure?: string;
  gitStatus?: string;
  relatedFiles?: string[];
}

export interface PromptRequest {
  intent: TaskIntent;
  userInput: string;
  context: PromptContext;
  includeContext: {
    file: boolean;
    selection: boolean;
    project: boolean;
    git: boolean;
  };
}

export interface EnhancedPrompt {
  prompt: string;
  preview: string;
  wasAiEnhanced: boolean;
}

export type LLMProvider = 'claude-code' | 'cursor' | 'copilot' | 'continue' | 'cody' | 'manual' | 'none';

export interface LLMDetectionResult {
  provider: LLMProvider;
  available: boolean;
  canEnhance: boolean;
  displayName: string;
}

export interface PromptTemplate {
  id: string;
  name: string;
  intent: TaskIntent;
  template: string;
  description: string;
  placeholders: string[];
}

export interface RuleMapping {
  keywords: string[];
  expansion: string;
  technicalTerms: string[];
}
