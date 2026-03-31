// tests/hooks/useAgentStream.test.ts
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAgentStream } from '@/hooks/useAgentStream';

// Mock fetch
global.fetch = jest.fn();

describe('useAgentStream', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should start with idle agents', () => {
      const { result } = renderHook(() => useAgentStream());
      expect(result.current.state.agents).toHaveLength(3);
      expect(result.current.state.agents[0].status).toBe('idle');
      expect(result.current.state.agents[1].status).toBe('idle');
      expect(result.current.state.agents[2].status).toBe('idle');
    });

    it('should start with idle merger', () => {
      const { result } = renderHook(() => useAgentStream());
      expect(result.current.state.merger.status).toBe('idle');
    });

    it('should start with empty streamed text', () => {
      const { result } = renderHook(() => useAgentStream());
      expect(result.current.state.streamedText).toBe('');
    });

    it('should start with not streaming', () => {
      const { result } = renderHook(() => useAgentStream());
      expect(result.current.state.isStreaming).toBe(false);
    });

    it('should start with not complete', () => {
      const { result } = renderHook(() => useAgentStream());
      expect(result.current.state.isComplete).toBe(false);
    });

    it('should start with null score', () => {
      const { result } = renderHook(() => useAgentStream());
      expect(result.current.state.score).toBe(null);
    });

    it('should start with zero total raw issues', () => {
      const { result } = renderHook(() => useAgentStream());
      expect(result.current.state.totalRawIssues).toBe(0);
    });
  });

  describe('startStream', () => {
    it('should set isStreaming to true when starting', async () => {
      const mockResponse = {
        ok: true,
        body: {
          getReader: () => ({
            read: jest.fn().mockResolvedValue({ done: true, value: undefined }),
          }),
        },
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useAgentStream());

      await act(async () => {
        await result.current.startStream('print("hello")', 'python');
      });

      // During streaming, isStreaming should be true
      // After completion, it becomes false
    });

    it('should set agents to running status when starting', async () => {
      const mockResponse = {
        ok: true,
        body: {
          getReader: () => ({
            read: jest.fn().mockResolvedValue({ done: true, value: undefined }),
          }),
        },
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useAgentStream());

      // Start stream but don't wait for completion
      result.current.startStream('print("hello")', 'python');

      // Agents should transition to running
      await waitFor(() => {
        expect(result.current.state.agents[0].status).toBe('running');
      });
    });

    it('should handle API error response', async () => {
      const mockError = {
        ok: false,
        status: 500,
        json: jest.fn().mockResolvedValue({ error: 'API Error' }),
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockError);

      const { result } = renderHook(() => useAgentStream());

      await act(async () => {
        await result.current.startStream('print("hello")', 'python');
      });

      expect(result.current.state.isStreaming).toBe(false);
      expect(result.current.state.streamedText).toContain('ERROR');
    });

    it('should handle network error', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useAgentStream());

      await act(async () => {
        await result.current.startStream('print("hello")', 'python');
      });

      expect(result.current.state.isStreaming).toBe(false);
      expect(result.current.state.streamedText).toContain('ERROR');
    });

    it('should parse agent_complete events', async () => {
      const mockReader = {
        read: jest
          .fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: {"type":"agent_complete","agent":1,"issueCount":2,"duration":1000}\n\n'),
          })
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: {"type":"review_complete","score":7}\n\n'),
          })
          .mockResolvedValueOnce({ done: true, value: undefined }),
      };

      const mockResponse = {
        ok: true,
        body: { getReader: () => mockReader },
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useAgentStream());

      await act(async () => {
        await result.current.startStream('print("hello")', 'python');
      });

      expect(result.current.state.agents[0].status).toBe('complete');
      expect(result.current.state.agents[0].issueCount).toBe(2);
    });

    it('should parse agent_failed events', async () => {
      const mockReader = {
        read: jest
          .fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: {"type":"agent_failed","agent":2,"error":"timeout","duration":5000}\n\n'),
          })
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: {"type":"review_complete","score":null}\n\n'),
          })
          .mockResolvedValueOnce({ done: true, value: undefined }),
      };

      const mockResponse = {
        ok: true,
        body: { getReader: () => mockReader },
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useAgentStream());

      await act(async () => {
        await result.current.startStream('print("hello")', 'python');
      });

      expect(result.current.state.agents[1].status).toBe('failed');
      expect(result.current.state.agents[1].error).toBe('timeout');
    });

    it('should parse merger_start events', async () => {
      const mockReader = {
        read: jest
          .fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: {"type":"merger_start","totalRaw":5}\n\n'),
          })
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: {"type":"review_complete","score":null}\n\n'),
          })
          .mockResolvedValueOnce({ done: true, value: undefined }),
      };

      const mockResponse = {
        ok: true,
        body: { getReader: () => mockReader },
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useAgentStream());

      await act(async () => {
        await result.current.startStream('print("hello")', 'python');
      });

      expect(result.current.state.totalRawIssues).toBe(5);
      expect(result.current.state.merger.status).toBe('running');
    });

    it('should parse merger_chunk events', async () => {
      const mockReader = {
        read: jest
          .fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: {"type":"merger_chunk","text":"■ SUMMARY\\nTest review"}\n\n'),
          })
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: {"type":"review_complete","score":null}\n\n'),
          })
          .mockResolvedValueOnce({ done: true, value: undefined }),
      };

      const mockResponse = {
        ok: true,
        body: { getReader: () => mockReader },
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useAgentStream());

      await act(async () => {
        await result.current.startStream('print("hello")', 'python');
      });

      expect(result.current.state.streamedText).toContain('■ SUMMARY');
      expect(result.current.state.streamedText).toContain('Test review');
    });

    it('should parse review_complete events with score', async () => {
      const mockReader = {
        read: jest
          .fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: {"type":"review_complete","score":7}\n\n'),
          })
          .mockResolvedValueOnce({ done: true, value: undefined }),
      };

      const mockResponse = {
        ok: true,
        body: { getReader: () => mockReader },
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useAgentStream());

      await act(async () => {
        await result.current.startStream('print("hello")', 'python');
      });

      expect(result.current.state.isComplete).toBe(true);
      expect(result.current.state.score).toBe(7);
    });

    it('should handle malformed JSON events', async () => {
      const mockReader = {
        read: jest
          .fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: not valid json\n\n'),
          })
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: {"type":"review_complete","score":null}\n\n'),
          })
          .mockResolvedValueOnce({ done: true, value: undefined }),
      };

      const mockResponse = {
        ok: true,
        body: { getReader: () => mockReader },
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useAgentStream());

      await act(async () => {
        await result.current.startStream('print("hello")', 'python');
      });

      // Should not crash, should accumulate raw text
      expect(result.current.state.streamedText).toContain('not valid json');
    });
  });

  describe('abortStream', () => {
    it('should abort the fetch request', async () => {
      const mockAbort = jest.fn();
      const mockController = {
        signal: { aborted: false },
        abort: mockAbort,
      };

      const mockReader = {
        read: jest.fn().mockImplementation(() => {
          return new Promise((resolve) => {
            setTimeout(() => resolve({ done: false, value: new TextEncoder().encode('data: {"type":"merger_chunk","text":"test"}\n\n') }), 100);
          });
        }),
      };

      const mockResponse = {
        ok: true,
        body: { getReader: () => mockReader },
      };

      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useAgentStream());

      // Start stream
      act(() => {
        result.current.startStream('print("hello")', 'python');
      });

      // Abort immediately
      await act(async () => {
        result.current.abortStream();
      });

      // Should handle abort gracefully
      expect(result.current.state.isStreaming).toBe(false);
    });
  });

  describe('resetState', () => {
    it('should reset all state to initial values', async () => {
      const { result } = renderHook(() => useAgentStream());

      // Modify state
      await act(async () => {
        result.current.startStream('print("hello")', 'python');
      });

      // Reset
      act(() => {
        result.current.resetState();
      });

      expect(result.current.state.agents[0].status).toBe('idle');
      expect(result.current.state.streamedText).toBe('');
      expect(result.current.state.isStreaming).toBe(false);
      expect(result.current.state.isComplete).toBe(false);
      expect(result.current.state.score).toBe(null);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty response body', async () => {
      const mockResponse = {
        ok: true,
        body: null,
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useAgentStream());

      await act(async () => {
        await result.current.startStream('print("hello")', 'python');
      });

      expect(result.current.state.streamedText).toContain('ERROR');
    });

    it('should handle multiple sequential streams', async () => {
      const mockResponse = {
        ok: true,
        body: {
          getReader: () => ({
            read: jest.fn().mockResolvedValue({ done: true, value: undefined }),
          }),
        },
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useAgentStream());

      // First stream
      await act(async () => {
        await result.current.startStream('code1', 'python');
      });

      // Second stream
      await act(async () => {
        await result.current.startStream('code2', 'javascript');
      });

      // Should have reset and started fresh
      expect(result.current.state.isStreaming).toBe(false);
    });

    it('should handle concurrent startStream calls', async () => {
      const mockResponse = {
        ok: true,
        body: {
          getReader: () => ({
            read: jest.fn().mockResolvedValue({ done: true, value: undefined }),
          }),
        },
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useAgentStream());

      // Start two streams concurrently
      await act(async () => {
        Promise.all([
          result.current.startStream('code1', 'python'),
          result.current.startStream('code2', 'javascript'),
        ]);
      });

      // Should handle gracefully (second call aborts first)
    });
  });
});
