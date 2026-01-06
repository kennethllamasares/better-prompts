import { PromptTemplate, TaskIntent } from '../types';

export const PROMPT_TEMPLATES: PromptTemplate[] = [
  // FIX templates
  {
    id: 'fix-bug',
    name: 'Fix Bug',
    intent: 'fix',
    template: `Fix the bug in this code. The issue is: {issue}

{context}

Please:
1. Identify the root cause of the bug
2. Provide a corrected implementation
3. Explain what was wrong and why the fix works`,
    description: 'Debug and fix issues in code',
    placeholders: ['issue']
  },
  {
    id: 'fix-error',
    name: 'Fix Error',
    intent: 'fix',
    template: `I'm getting this error: {error}

{context}

Please help me:
1. Understand what's causing this error
2. Fix the code to resolve it
3. Prevent similar errors in the future`,
    description: 'Fix specific error messages',
    placeholders: ['error']
  },

  // ADD templates
  {
    id: 'add-feature',
    name: 'Add Feature',
    intent: 'add',
    template: `Add the following feature: {feature}

{context}

Requirements:
- Follow existing code patterns and conventions
- Include proper error handling
- Make it production-ready`,
    description: 'Implement new functionality',
    placeholders: ['feature']
  },
  {
    id: 'add-function',
    name: 'Add Function',
    intent: 'add',
    template: `Create a function that: {description}

{context}

Please:
- Use appropriate parameter types
- Include input validation
- Handle edge cases
- Add JSDoc/docstring comments`,
    description: 'Create a new function',
    placeholders: ['description']
  },

  // CHANGE templates
  {
    id: 'change-refactor',
    name: 'Refactor Code',
    intent: 'change',
    template: `Refactor this code to: {goal}

{context}

Guidelines:
- Maintain the same functionality
- Improve code quality and readability
- Follow best practices for this language`,
    description: 'Improve code structure',
    placeholders: ['goal']
  },
  {
    id: 'change-update',
    name: 'Update Code',
    intent: 'change',
    template: `Update this code: {changes}

{context}

Please ensure:
- Backward compatibility where possible
- All related code is updated consistently
- No functionality is broken`,
    description: 'Modify existing code',
    placeholders: ['changes']
  },

  // EXPLAIN templates
  {
    id: 'explain-code',
    name: 'Explain Code',
    intent: 'explain',
    template: `Explain this code in detail:

{context}

Please cover:
1. What this code does (high-level overview)
2. How it works (step-by-step breakdown)
3. Key concepts or patterns used
4. Any potential issues or improvements`,
    description: 'Get detailed code explanation',
    placeholders: []
  },
  {
    id: 'explain-simple',
    name: 'Explain Simply',
    intent: 'explain',
    template: `Explain this code in simple terms that a beginner can understand:

{context}

Use:
- Simple language, avoid jargon
- Analogies where helpful
- Step-by-step breakdown`,
    description: 'Get beginner-friendly explanation',
    placeholders: []
  },

  // TEST templates
  {
    id: 'test-unit',
    name: 'Write Unit Tests',
    intent: 'test',
    template: `Write unit tests for this code:

{context}

Include tests for:
- Normal/expected inputs
- Edge cases
- Error conditions
- Boundary values

Use the testing framework appropriate for this language/project.`,
    description: 'Generate unit tests',
    placeholders: []
  },
  {
    id: 'test-specific',
    name: 'Test Specific Scenario',
    intent: 'test',
    template: `Write tests for the following scenario: {scenario}

{context}

Make sure to cover:
- The main scenario
- Related edge cases
- Failure modes`,
    description: 'Test specific functionality',
    placeholders: ['scenario']
  },

  // REVIEW templates
  {
    id: 'review-code',
    name: 'Code Review',
    intent: 'review',
    template: `Review this code for:

{context}

Please check for:
1. Bugs or logic errors
2. Security vulnerabilities
3. Performance issues
4. Code style and best practices
5. Suggestions for improvement`,
    description: 'Get comprehensive code review',
    placeholders: []
  },
  {
    id: 'review-security',
    name: 'Security Review',
    intent: 'review',
    template: `Perform a security review of this code:

{context}

Check for:
- Input validation issues
- Injection vulnerabilities (SQL, XSS, etc.)
- Authentication/authorization flaws
- Data exposure risks
- Other OWASP Top 10 vulnerabilities`,
    description: 'Focus on security issues',
    placeholders: []
  },

  // IMPROVE templates
  {
    id: 'improve-performance',
    name: 'Improve Performance',
    intent: 'improve',
    template: `Optimize this code for better performance:

{context}

Focus on:
- Reducing time complexity
- Minimizing memory usage
- Eliminating unnecessary operations
- Using more efficient algorithms/data structures`,
    description: 'Optimize code performance',
    placeholders: []
  },
  {
    id: 'improve-readability',
    name: 'Improve Readability',
    intent: 'improve',
    template: `Improve the readability of this code:

{context}

Please:
- Use clearer variable/function names
- Break down complex logic
- Add helpful comments where needed
- Follow language conventions`,
    description: 'Make code more readable',
    placeholders: []
  },

  // DOCUMENT templates
  {
    id: 'document-code',
    name: 'Add Documentation',
    intent: 'document',
    template: `Add documentation to this code:

{context}

Include:
- Function/method documentation (JSDoc, docstrings, etc.)
- Inline comments for complex logic
- Usage examples where helpful`,
    description: 'Generate code documentation',
    placeholders: []
  },
  {
    id: 'document-readme',
    name: 'Write README',
    intent: 'document',
    template: `Write a README for this code/project:

{context}

Include:
- Project description
- Installation instructions
- Usage examples
- API documentation (if applicable)
- Contributing guidelines`,
    description: 'Create README documentation',
    placeholders: []
  }
];

export const getTemplatesByIntent = (intent: TaskIntent): PromptTemplate[] => {
  return PROMPT_TEMPLATES.filter(t => t.intent === intent);
};

export const getTemplateById = (id: string): PromptTemplate | undefined => {
  return PROMPT_TEMPLATES.find(t => t.id === id);
};

export const INTENT_LABELS: Record<TaskIntent, { label: string; icon: string; description: string }> = {
  fix: { label: 'Fix', icon: '🔧', description: 'Debug and fix issues' },
  add: { label: 'Add', icon: '➕', description: 'Add new features or code' },
  change: { label: 'Change', icon: '✏️', description: 'Modify existing code' },
  explain: { label: 'Explain', icon: '💡', description: 'Understand code' },
  test: { label: 'Test', icon: '🧪', description: 'Write tests' },
  review: { label: 'Review', icon: '👀', description: 'Review code quality' },
  improve: { label: 'Improve', icon: '⚡', description: 'Optimize and enhance' },
  document: { label: 'Document', icon: '📝', description: 'Add documentation' }
};
