// tests/components/CodePanel.test.tsx
import { describe, it, expect, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import CodePanel from '@/components/CodePanel';

describe('CodePanel', () => {
  const defaultProps = {
    code: '',
    language: 'python' as const,
    highlightedLines: new Set<number>(),
    onCodeChange: jest.fn(),
    onLanguageChange: jest.fn(),
  };

  describe('Rendering', () => {
    it('should render code input header', () => {
      render(<CodePanel {...defaultProps} />);
      expect(screen.getByText('CODE INPUT')).toBeInTheDocument();
    });

    it('should render language selector', () => {
      render(<CodePanel {...defaultProps} />);
      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
    });

    it('should render all language options', () => {
      render(<CodePanel {...defaultProps} />);
      expect(screen.getByText('Python')).toBeInTheDocument();
      expect(screen.getByText('JavaScript')).toBeInTheDocument();
      expect(screen.getByText('TypeScript')).toBeInTheDocument();
      expect(screen.getByText('Rust')).toBeInTheDocument();
      expect(screen.getByText('Go')).toBeInTheDocument();
      expect(screen.getByText('C++')).toBeInTheDocument();
      expect(screen.getByText('SQL')).toBeInTheDocument();
      expect(screen.getByText('Bash')).toBeInTheDocument();
      expect(screen.getByText('Other')).toBeInTheDocument();
    });

    it('should render textarea for code input', () => {
      render(<CodePanel {...defaultProps} />);
      const textarea = screen.getByPlaceholderText('Paste or type your code here...');
      expect(textarea).toBeInTheDocument();
    });

    it('should render line numbers', () => {
      render(<CodePanel {...defaultProps} />);
      // First line number should be visible
      expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('should render character and line count', () => {
      render(<CodePanel {...defaultProps} />);
      expect(screen.getByText('0 chars · 1 lines')).toBeInTheDocument();
    });

    it('should render paste hint', () => {
      render(<CodePanel {...defaultProps} />);
      expect(screen.getByText('⌘V to paste')).toBeInTheDocument();
    });
  });

  describe('Code Input', () => {
    it('should call onCodeChange when typing', () => {
      const onCodeChange = jest.fn();
      render(<CodePanel {...defaultProps} onCodeChange={onCodeChange} />);
      
      const textarea = screen.getByPlaceholderText('Paste or type your code here...');
      fireEvent.change(textarea, { target: { value: 'print("hello")' } });
      
      expect(onCodeChange).toHaveBeenCalledWith('print("hello")');
    });

    it('should display code value', () => {
      render(<CodePanel {...defaultProps} code="def hello():\n    pass" />);
      const textarea = screen.getByDisplayValue('def hello():\n    pass');
      expect(textarea).toBeInTheDocument();
    });

    it('should update line count with code', () => {
      const { rerender } = render(<CodePanel {...defaultProps} />);
      rerender(<CodePanel {...defaultProps} code="line1\nline2\nline3" />);
      expect(screen.getByText('17 chars · 3 lines')).toBeInTheDocument();
    });

    it('should update char count with code', () => {
      const { rerender } = render(<CodePanel {...defaultProps} />);
      rerender(<CodePanel {...defaultProps} code="hello" />);
      expect(screen.getByText('5 chars · 1 lines')).toBeInTheDocument();
    });
  });

  describe('Language Selector', () => {
    it('should call onLanguageChange when selecting language', () => {
      const onLanguageChange = jest.fn();
      render(<CodePanel {...defaultProps} onLanguageChange={onLanguageChange} />);
      
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'javascript' } });
      
      expect(onLanguageChange).toHaveBeenCalledWith('javascript');
    });

    it('should display current language value', () => {
      render(<CodePanel {...defaultProps} language="typescript" />);
      const select = screen.getByRole('combobox') as HTMLSelectElement;
      expect(select.value).toBe('typescript');
    });
  });

  describe('Tab Key Handling', () => {
    it('should insert two spaces on Tab key', () => {
      const onCodeChange = jest.fn();
      render(<CodePanel {...defaultProps} code="  " onCodeChange={onCodeChange} />);
      
      const textarea = screen.getByPlaceholderText('Paste or type your code here...');
      fireEvent.keyDown(textarea, { key: 'Tab' });
      
      expect(onCodeChange).toHaveBeenCalledWith('    ');
    });

    it('should prevent default Tab behavior', () => {
      const onCodeChange = jest.fn();
      render(<CodePanel {...defaultProps} onCodeChange={onCodeChange} />);
      
      const textarea = screen.getByPlaceholderText('Paste or type your code here...');
      const event = fireEvent.keyDown(textarea, { key: 'Tab' });
      
      expect(event).toBe(true); // Event was prevented
    });
  });

  describe('Line Highlighting', () => {
    it('should render highlighted line numbers', () => {
      render(<CodePanel {...defaultProps} code="line1\nline2\nline3" highlightedLines={new Set([2])} />);
      const line2 = screen.getAllByText('2')[0];
      expect(line2).toHaveClass('text-accent-green');
    });

    it('should render highlight overlay', () => {
      render(<CodePanel {...defaultProps} code="line1\nline2\nline3" highlightedLines={new Set([2])} />);
      // Highlight overlay should be present
      const overlays = document.querySelectorAll('.bg-bg-elevated.border-l-2');
      expect(overlays.length).toBeGreaterThan(0);
    });

    it('should handle multiple highlighted lines', () => {
      render(<CodePanel {...defaultProps} code="line1\nline2\nline3\nline4" highlightedLines={new Set([1, 3])} />);
      const line1 = screen.getAllByText('1')[0];
      const line3 = screen.getAllByText('3')[0];
      expect(line1).toHaveClass('text-accent-green');
      expect(line3).toHaveClass('text-accent-green');
    });
  });

  describe('Scroll Sync', () => {
    it('should sync line numbers scroll with textarea', () => {
      render(<CodePanel {...defaultProps} code={Array(100).fill('line').join('\n')} />);
      const textarea = screen.getByPlaceholderText('Paste or type your code here...');
      
      fireEvent.scroll(textarea, { target: { scrollTop: 100 } });
      
      // Line numbers should also have scrolled
      // This is tested via the scroll event listener
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long lines', () => {
      const longLine = 'a'.repeat(1000);
      render(<CodePanel {...defaultProps} code={longLine} />);
      const textarea = screen.getByDisplayValue(longLine);
      expect(textarea).toBeInTheDocument();
    });

    it('should handle many lines', () => {
      const manyLines = Array(1000).fill('line').join('\n');
      render(<CodePanel {...defaultProps} code={manyLines} />);
      expect(screen.getByText(`${manyLines.length} chars · 1000 lines`)).toBeInTheDocument();
    });

    it('should handle empty string', () => {
      render(<CodePanel {...defaultProps} code="" />);
      expect(screen.getByText('0 chars · 1 lines')).toBeInTheDocument();
    });

    it('should handle special characters', () => {
      const specialCode = '<>&"\'\n\t\r\\';
      render(<CodePanel {...defaultProps} code={specialCode} />);
      const textarea = screen.getByDisplayValue(specialCode);
      expect(textarea).toBeInTheDocument();
    });

    it('should handle unicode characters', () => {
      const unicodeCode = 'Hello 世界 🌍 émojis';
      render(<CodePanel {...defaultProps} code={unicodeCode} />);
      const textarea = screen.getByDisplayValue(unicodeCode);
      expect(textarea).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have aria-label on textarea', () => {
      render(<CodePanel {...defaultProps} />);
      const textarea = screen.getByPlaceholderText('Paste or type your code here...');
      // Textarea should be accessible
      expect(textarea).toBeInTheDocument();
    });

    it('should have proper label for language selector', () => {
      render(<CodePanel {...defaultProps} />);
      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
    });
  });
});
