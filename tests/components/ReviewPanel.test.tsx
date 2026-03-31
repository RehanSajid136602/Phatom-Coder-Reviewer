// tests/components/ReviewPanel.test.tsx
import { describe, it, expect, jest } from '@jest/globals';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ReviewPanel from '@/components/ReviewPanel';
import { examples } from '@/lib/examples';

describe('ReviewPanel', () => {
  const defaultProps = {
    streamedText: '',
    isStreaming: false,
    onLineHighlight: jest.fn(),
    onExampleClick: jest.fn(),
    examples,
  };

  describe('Empty State', () => {
    it('should show awaiting input message when empty', () => {
      render(<ReviewPanel {...defaultProps} />);
      expect(screen.getByText('AWAITING INPUT')).toBeInTheDocument();
    });

    it('should show example buttons', () => {
      render(<ReviewPanel {...defaultProps} />);
      expect(screen.getByText('try: bubble sort')).toBeInTheDocument();
      expect(screen.getByText('try: sql injection')).toBeInTheDocument();
      expect(screen.getByText('try: react hook')).toBeInTheDocument();
    });

    it('should call onExampleClick when example is clicked', () => {
      const onExampleClick = jest.fn();
      render(<ReviewPanel {...defaultProps} onExampleClick={onExampleClick} />);
      
      fireEvent.click(screen.getByText('try: bubble sort'));
      
      expect(onExampleClick).toHaveBeenCalledWith(examples[0]);
    });

    it('should show REVIEW OUTPUT header', () => {
      render(<ReviewPanel {...defaultProps} />);
      expect(screen.getByText('REVIEW OUTPUT')).toBeInTheDocument();
    });
  });

  describe('Summary Section', () => {
    it('should render SUMMARY section', () => {
      const text = `■ SUMMARY
This code has security issues.`;
      render(<ReviewPanel {...defaultProps} streamedText={text} />);
      expect(screen.getByText('SUMMARY')).toBeInTheDocument();
      expect(screen.getByText('This code has security issues.')).toBeInTheDocument();
    });
  });

  describe('Issues Section', () => {
    it('should render ISSUES section', () => {
      const text = `■ ISSUES
[CRITICAL]L12 — SQL Injection
Vulnerable to attacks.`;
      render(<ReviewPanel {...defaultProps} streamedText={text} />);
      expect(screen.getByText('ISSUES')).toBeInTheDocument();
    });

    it('should render severity badge', () => {
      const text = `■ ISSUES
[CRITICAL]L12 — SQL Injection
Vulnerable to attacks.`;
      render(<ReviewPanel {...defaultProps} streamedText={text} />);
      expect(screen.getByText('CRITICAL')).toBeInTheDocument();
    });

    it('should render line reference chip', () => {
      const text = `■ ISSUES
[CRITICAL]L12 — SQL Injection
Vulnerable to attacks.`;
      render(<ReviewPanel {...defaultProps} streamedText={text} />);
      expect(screen.getByText('L12')).toBeInTheDocument();
    });

    it('should render issue title', () => {
      const text = `■ ISSUES
[CRITICAL]L12 — SQL Injection
Vulnerable to attacks.`;
      render(<ReviewPanel {...defaultProps} streamedText={text} />);
      expect(screen.getByText('SQL Injection')).toBeInTheDocument();
    });

    it('should render issue explanation', () => {
      const text = `■ ISSUES
[CRITICAL]L12 — SQL Injection
Vulnerable to attacks.`;
      render(<ReviewPanel {...defaultProps} streamedText={text} />);
      expect(screen.getByText('Vulnerable to attacks.')).toBeInTheDocument();
    });

    it('should render multiple issues', () => {
      const text = `■ ISSUES
[CRITICAL]L12 — SQL Injection
Vulnerable.

[WARNING]L28 — Unused variable
Remove it.`;
      render(<ReviewPanel {...defaultProps} streamedText={text} />);
      expect(screen.getAllByText('SQL Injection').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Unused variable').length).toBeGreaterThan(0);
    });

    it('should show "No critical issues" message', () => {
      const text = `■ ISSUES
No critical issues detected.`;
      render(<ReviewPanel {...defaultProps} streamedText={text} />);
      expect(screen.getByText('No critical issues detected.')).toBeInTheDocument();
    });
  });

  describe('Suggestions Section', () => {
    it('should render SUGGESTIONS section', () => {
      const text = `■ SUGGESTIONS
\`\`\`python
# Fix: Use parameterized query
cursor.execute("SELECT * FROM users WHERE id = ?", (id,))
\`\`\``;
      render(<ReviewPanel {...defaultProps} streamedText={text} />);
      expect(screen.getByText('SUGGESTIONS')).toBeInTheDocument();
    });

    it('should render code block', () => {
      const text = `■ SUGGESTIONS
\`\`\`python
def secure():
    pass
\`\`\``;
      render(<ReviewPanel {...defaultProps} streamedText={text} />);
      expect(screen.getByText('def secure():')).toBeInTheDocument();
    });

    it('should render code block language label', () => {
      const text = `■ SUGGESTIONS
\`\`\`python
code here
\`\`\``;
      render(<ReviewPanel {...defaultProps} streamedText={text} />);
      expect(screen.getByText('PYTHON')).toBeInTheDocument();
    });

    it('should render copy button for code blocks', () => {
      const text = `■ SUGGESTIONS
\`\`\`python
code
\`\`\``;
      render(<ReviewPanel {...defaultProps} streamedText={text} />);
      expect(screen.getByText('COPY')).toBeInTheDocument();
    });
  });

  describe('Verdict Section', () => {
    it('should render VERDICT section', () => {
      const text = `■ VERDICT
Score: 7/10
Good code.`;
      render(<ReviewPanel {...defaultProps} streamedText={text} />);
      expect(screen.getByText('VERDICT')).toBeInTheDocument();
    });

    it('should render score', () => {
      const text = `■ VERDICT
Score: 7/10
Good code.`;
      render(<ReviewPanel {...defaultProps} streamedText={text} />);
      // Score animates, so we check for the container
      expect(screen.getByText('VERDICT')).toBeInTheDocument();
    });

    it('should render final verdict text', () => {
      const text = `■ VERDICT
Score: 7/10
Good code overall.`;
      render(<ReviewPanel {...defaultProps} streamedText={text} />);
      expect(screen.getByText('Good code overall.')).toBeInTheDocument();
    });
  });

  describe('Streaming State', () => {
    it('should show streaming cursor', () => {
      render(<ReviewPanel {...defaultProps} streamedText="■ SUMMARY" isStreaming={true} />);
      const cursor = document.querySelector('.animate-blink');
      expect(cursor).toBeInTheDocument();
    });
  });

  describe('Line Reference Interaction', () => {
    it('should call onLineHighlight when line ref is clicked', () => {
      const onLineHighlight = jest.fn();
      const text = `■ ISSUES
[CRITICAL]L12 — SQL Injection
Vulnerable.`;
      render(<ReviewPanel {...defaultProps} streamedText={text} onLineHighlight={onLineHighlight} />);
      
      fireEvent.click(screen.getByText('L12'));
      
      expect(onLineHighlight).toHaveBeenCalledWith('12');
    });
  });

  describe('Copy Functionality', () => {
    it('should change COPY to COPIED after clicking', async () => {
      const text = `■ SUGGESTIONS
\`\`\`python
code
\`\`\``;
      render(<ReviewPanel {...defaultProps} streamedText={text} />);
      
      const copyButton = screen.getByText('COPY');
      fireEvent.click(copyButton);
      
      await waitFor(() => {
        expect(screen.getByText('COPIED')).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty streamed text', () => {
      render(<ReviewPanel {...defaultProps} streamedText="" />);
      expect(screen.getByText('AWAITING INPUT')).toBeInTheDocument();
    });

    it('should handle partial section (incomplete stream)', () => {
      const text = `■ SUM`;
      render(<ReviewPanel {...defaultProps} streamedText={text} />);
      // Should not crash
    });

    it('should handle malformed issue format', () => {
      const text = `■ ISSUES
This is not a valid issue format`;
      render(<ReviewPanel {...defaultProps} streamedText={text} />);
      // Should render without crashing
    });

    it('should handle very long text', () => {
      const text = `■ SUMMARY
${'a'.repeat(10000)}`;
      render(<ReviewPanel {...defaultProps} streamedText={text} />);
      expect(screen.getByText('SUMMARY')).toBeInTheDocument();
    });

    it('should handle special characters', () => {
      const text = `■ SUMMARY
Special: <>&"'\\n\\t`;
      render(<ReviewPanel {...defaultProps} streamedText={text} />);
      expect(screen.getByText('SUMMARY')).toBeInTheDocument();
    });

    it('should handle unicode characters', () => {
      const text = `■ SUMMARY
Hello 世界 🌍 émojis`;
      render(<ReviewPanel {...defaultProps} streamedText={text} />);
      expect(screen.getByText('SUMMARY')).toBeInTheDocument();
    });

    it('should handle multiple code blocks', () => {
      const text = `■ SUGGESTIONS
\`\`\`python
code1
\`\`\`

\`\`\`javascript
code2
\`\`\``;
      render(<ReviewPanel {...defaultProps} streamedText={text} />);
      expect(screen.getAllByText('COPY').length).toBe(2);
    });

    it('should handle code block without language', () => {
      const text = `■ SUGGESTIONS
\`\`\`
code without language
\`\`\``;
      render(<ReviewPanel {...defaultProps} streamedText={text} />);
      expect(screen.getByText('code without language')).toBeInTheDocument();
    });
  });

  describe('Agent Progress', () => {
    it('should render agent progress when agentState provided', () => {
      const mockAgentState = {
        agents: [
          { id: 1, name: 'security', displayName: 'Security', status: 'running', issueCount: 0, startTime: Date.now(), endTime: null, duration: null, error: null },
          { id: 2, name: 'quality', displayName: 'Quality', status: 'pending', issueCount: 0, startTime: null, endTime: null, duration: null, error: null },
          { id: 3, name: 'language', displayName: 'Language', status: 'pending', issueCount: 0, startTime: null, endTime: null, duration: null, error: null },
        ],
        merger: { id: 'merger', name: 'merger', displayName: 'Merger', status: 'pending', issueCount: 0, startTime: null, endTime: null, duration: null, error: null },
        totalRawIssues: 0,
        isStreaming: true,
        isComplete: false,
        score: null,
        streamedText: '',
      };
      render(<ReviewPanel {...defaultProps} agentState={mockAgentState as any} />);
      expect(screen.getByText('AGENT PIPELINE')).toBeInTheDocument();
    });
  });
});
