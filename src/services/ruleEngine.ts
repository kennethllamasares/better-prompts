import { TaskIntent, PromptRequest, EnhancedPrompt, RuleMapping } from '../types';
import { PROMPT_TEMPLATES, getTemplatesByIntent } from '../templates/promptTemplates';

/**
 * Rule-based prompt enhancement engine
 * Works offline without any AI integration
 */

// Keyword mappings for intent detection
const INTENT_KEYWORDS: Record<TaskIntent, string[]> = {
  fix: ['fix', 'bug', 'error', 'broken', 'not work', 'doesnt work', "doesn't work", 'fail', 'crash', 'issue', 'problem', 'wrong', 'debug', 'repair', 'solve'],
  add: ['add', 'create', 'new', 'implement', 'make', 'build', 'write', 'generate', 'insert'],
  change: ['change', 'update', 'modify', 'edit', 'refactor', 'rename', 'move', 'replace', 'convert', 'transform'],
  explain: ['explain', 'what', 'how', 'why', 'understand', 'mean', 'does this', 'tell me', 'describe', 'clarify'],
  test: ['test', 'testing', 'unit test', 'spec', 'coverage', 'mock', 'assert'],
  review: ['review', 'check', 'audit', 'inspect', 'analyze', 'evaluate', 'assess'],
  improve: ['improve', 'optimize', 'faster', 'better', 'performance', 'speed', 'efficient', 'enhance', 'upgrade', 'clean'],
  document: ['document', 'docs', 'readme', 'comment', 'jsdoc', 'docstring', 'documentation']
};

// Simple word expansions for common short inputs
const WORD_EXPANSIONS: Record<string, string> = {
  // Actions
  'fix': 'fix and debug',
  'broken': 'not working correctly',
  'slow': 'has performance issues and runs slowly',
  'fast': 'optimized for better performance',
  'work': 'function correctly',
  'not work': 'is not functioning as expected',
  'doesnt work': 'is not functioning as expected',
  "doesn't work": 'is not functioning as expected',

  // Quality
  'bad': 'poorly structured or inefficient',
  'good': 'well-structured and efficient',
  'ugly': 'poorly formatted and hard to read',
  'clean': 'well-organized and readable',
  'messy': 'disorganized and hard to maintain',

  // Actions (simple)
  'make': 'implement',
  'do': 'implement',
  'want': 'need to',
  'need': 'require',

  // Technical
  'btn': 'button',
  'func': 'function',
  'var': 'variable',
  'arr': 'array',
  'obj': 'object',
  'str': 'string',
  'num': 'number',
  'bool': 'boolean',
  'db': 'database',
  'api': 'API endpoint',
  'auth': 'authentication',
  'err': 'error',
  'msg': 'message',
  'req': 'request',
  'res': 'response',
  'param': 'parameter',
  'arg': 'argument',
  'props': 'properties',
  'config': 'configuration'
};

// Technical term suggestions based on context
const TECHNICAL_ENHANCEMENTS: RuleMapping[] = [
  {
    keywords: ['button', 'click', 'press'],
    expansion: 'button click handler',
    technicalTerms: ['onClick event', 'event handler', 'user interaction']
  },
  {
    keywords: ['form', 'submit', 'input'],
    expansion: 'form submission',
    technicalTerms: ['form validation', 'input handling', 'form state']
  },
  {
    keywords: ['login', 'signin', 'sign in'],
    expansion: 'user authentication',
    technicalTerms: ['authentication flow', 'credentials', 'session management']
  },
  {
    keywords: ['save', 'store', 'persist'],
    expansion: 'data persistence',
    technicalTerms: ['storage', 'database operation', 'state management']
  },
  {
    keywords: ['load', 'fetch', 'get data'],
    expansion: 'data fetching',
    technicalTerms: ['API call', 'async operation', 'data loading']
  },
  {
    keywords: ['show', 'display', 'render', 'visible'],
    expansion: 'UI rendering',
    technicalTerms: ['component rendering', 'visibility', 'display logic']
  },
  {
    keywords: ['hide', 'invisible', 'remove'],
    expansion: 'UI visibility',
    technicalTerms: ['conditional rendering', 'display state', 'DOM manipulation']
  },
  {
    keywords: ['list', 'array', 'items', 'loop'],
    expansion: 'list/array handling',
    technicalTerms: ['iteration', 'array methods', 'list rendering']
  },
  {
    keywords: ['error', 'catch', 'fail', 'exception'],
    expansion: 'error handling',
    technicalTerms: ['try-catch', 'error boundary', 'exception handling']
  },
  {
    keywords: ['async', 'await', 'promise', 'wait'],
    expansion: 'asynchronous operation',
    technicalTerms: ['Promise', 'async/await', 'asynchronous flow']
  },
  {
    keywords: ['style', 'css', 'color', 'layout'],
    expansion: 'styling',
    technicalTerms: ['CSS', 'styling', 'layout']
  },
  {
    keywords: ['route', 'page', 'navigate', 'url'],
    expansion: 'routing/navigation',
    technicalTerms: ['routing', 'navigation', 'URL handling']
  },
  {
    keywords: ['state', 'update', 'change value'],
    expansion: 'state management',
    technicalTerms: ['state update', 'reactivity', 'state management']
  },
  {
    keywords: ['type', 'typescript', 'interface'],
    expansion: 'type definition',
    technicalTerms: ['TypeScript', 'type safety', 'interface definition']
  }
];

// Sentence structure improvements
const STRUCTURE_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // "X not work" -> "X is not working"
  { pattern: /(\w+)\s+not\s+work/gi, replacement: '$1 is not working correctly' },
  // "make X" -> "implement X"
  { pattern: /^make\s+(.+)/i, replacement: 'Implement $1' },
  // "want X" -> "I need X"
  { pattern: /^want\s+(.+)/i, replacement: 'I need $1' },
  // "how X" -> "How does X work"
  { pattern: /^how\s+(\w+)$/i, replacement: 'How does $1 work' },
  // Add period at end if missing
  { pattern: /([a-zA-Z])$/i, replacement: '$1.' }
];

export class RuleEngine {
  /**
   * Detect intent from user input
   */
  detectIntent(input: string): TaskIntent {
    const lowerInput = input.toLowerCase();

    let bestMatch: TaskIntent = 'fix'; // default
    let highestScore = 0;

    for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
      let score = 0;
      for (const keyword of keywords) {
        if (lowerInput.includes(keyword)) {
          // Give higher score to longer keyword matches
          score += keyword.length;
        }
      }
      if (score > highestScore) {
        highestScore = score;
        bestMatch = intent as TaskIntent;
      }
    }

    return bestMatch;
  }

  /**
   * Expand abbreviated words
   */
  expandWords(input: string): string {
    let result = input;

    // Sort by length (longest first) to avoid partial replacements
    const sortedExpansions = Object.entries(WORD_EXPANSIONS)
      .sort((a, b) => b[0].length - a[0].length);

    for (const [word, expansion] of sortedExpansions) {
      // Word boundary matching (case insensitive)
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      result = result.replace(regex, expansion);
    }

    return result;
  }

  /**
   * Add technical terminology based on context
   */
  addTechnicalTerms(input: string): { enhanced: string; termsAdded: string[] } {
    const lowerInput = input.toLowerCase();
    const termsAdded: string[] = [];
    let enhanced = input;

    for (const mapping of TECHNICAL_ENHANCEMENTS) {
      const hasKeyword = mapping.keywords.some(kw => lowerInput.includes(kw));
      if (hasKeyword) {
        termsAdded.push(...mapping.technicalTerms);
      }
    }

    // Remove duplicates
    const uniqueTerms = [...new Set(termsAdded)];

    return { enhanced, termsAdded: uniqueTerms };
  }

  /**
   * Improve sentence structure
   */
  improveStructure(input: string): string {
    let result = input;

    for (const { pattern, replacement } of STRUCTURE_PATTERNS) {
      result = result.replace(pattern, replacement);
    }

    // Capitalize first letter
    result = result.charAt(0).toUpperCase() + result.slice(1);

    return result;
  }

  /**
   * Format context for inclusion in prompt
   */
  formatContext(request: PromptRequest): string {
    const parts: string[] = [];

    if (request.includeContext.file && request.context.fileName) {
      parts.push(`**File:** ${request.context.fileName}`);
      if (request.context.language) {
        parts.push(`**Language:** ${request.context.language}`);
      }
    }

    if (request.includeContext.selection && request.context.selectedCode) {
      parts.push(`\n**Code:**\n\`\`\`${request.context.language || ''}\n${request.context.selectedCode}\n\`\`\``);
    }

    if (request.includeContext.project && request.context.projectStructure) {
      parts.push(`\n**Project Structure:**\n${request.context.projectStructure}`);
    }

    if (request.includeContext.git && request.context.gitStatus) {
      parts.push(`\n**Git Status:**\n${request.context.gitStatus}`);
    }

    return parts.join('\n');
  }

  /**
   * Main enhancement function
   */
  enhance(request: PromptRequest): EnhancedPrompt {
    const { userInput, intent, context, includeContext } = request;

    // Step 1: Expand abbreviations
    let enhanced = this.expandWords(userInput);

    // Step 2: Improve sentence structure
    enhanced = this.improveStructure(enhanced);

    // Step 3: Add technical terms
    const { termsAdded } = this.addTechnicalTerms(userInput);

    // Step 4: Find best matching template
    const templates = getTemplatesByIntent(intent);
    const template = templates[0]; // Use first template for intent

    // Step 5: Build the final prompt
    const contextStr = this.formatContext(request);

    let finalPrompt: string;

    if (template) {
      // Use template and fill in the user's input
      finalPrompt = template.template
        .replace('{issue}', enhanced)
        .replace('{error}', enhanced)
        .replace('{feature}', enhanced)
        .replace('{description}', enhanced)
        .replace('{goal}', enhanced)
        .replace('{changes}', enhanced)
        .replace('{scenario}', enhanced)
        .replace('{context}', contextStr || '');
    } else {
      // Fallback: construct a basic prompt
      finalPrompt = `${enhanced}\n\n${contextStr}`;
    }

    // Add technical terms hint if any were detected
    if (termsAdded.length > 0) {
      finalPrompt += `\n\n*Related concepts: ${termsAdded.join(', ')}*`;
    }

    // Create preview (truncated version)
    const preview = finalPrompt.length > 200
      ? finalPrompt.substring(0, 200) + '...'
      : finalPrompt;

    return {
      prompt: finalPrompt,
      preview,
      wasAiEnhanced: false
    };
  }

  /**
   * Quick enhance for simple inputs (used by context menu actions)
   */
  quickEnhance(simpleInput: string, intent: TaskIntent, context: PromptRequest['context']): EnhancedPrompt {
    return this.enhance({
      intent,
      userInput: simpleInput,
      context,
      includeContext: {
        file: true,
        selection: true,
        project: false,
        git: false
      }
    });
  }
}

export const ruleEngine = new RuleEngine();
