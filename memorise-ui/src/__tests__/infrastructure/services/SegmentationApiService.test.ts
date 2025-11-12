import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SegmentationApiService } from '../../../infrastructure/services/SegmentationApiService';
import type { SegmentationApiResponse } from '../../../types/SegmentationApi';

describe('SegmentationApiService', () => {
  let service: SegmentationApiService;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    service = new SegmentationApiService();
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('segmentText', () => {
    it('should segment text successfully', async () => {
      const mockResponse: SegmentationApiResponse = {
        results: [
          { label: 0, score: 0, sentence_text: 'This is the first sentence.' },
          { label: 1, score: 0, sentence_text: 'This is the second sentence.' },
          { label: 2, score: 0, sentence_text: 'This is the third.' },
        ],
      };

      const originalText =
        'This is the first sentence. This is the second sentence. This is the third.';

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const segments = await service.segmentText(originalText);

      expect(segments).toHaveLength(3);
      expect(segments[0]).toMatchObject({
        id: 'seg-0',
        text: 'This is the first sentence.',
        order: 0,
      });
      expect(segments[0].start).toBe(0);
      expect(segments[0].end).toBe('This is the first sentence.'.length);

      expect(segments[1]).toMatchObject({
        id: 'seg-1',
        text: 'This is the second sentence.',
        order: 1,
      });
      // Second segment should start after first segment + space
      expect(segments[1].start).toBeGreaterThan(segments[0].end);

      expect(segments[2]).toMatchObject({
        id: 'seg-2',
        text: 'This is the third.',
        order: 2,
      });
    });

    it('should calculate offsets correctly with whitespace between segments', async () => {
      const mockResponse: SegmentationApiResponse = {
        results: [
          { label: 0, score: 0, sentence_text: 'First.' },
          { label: 1, score: 0, sentence_text: 'Second.' },
        ],
      };

      const originalText = 'First.  Second.'; // Two spaces between

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const segments = await service.segmentText(originalText);

      expect(segments).toHaveLength(2);
      expect(segments[0].start).toBe(0);
      expect(segments[0].end).toBe('First.'.length);
      expect(segments[1].start).toBeGreaterThan(segments[0].end);
      expect(segments[1].end).toBe(segments[1].start + 'Second.'.length);
    });

    it('should return empty array for empty text', async () => {
      const segments = await service.segmentText('');
      expect(segments).toHaveLength(0);
    });

    it('should return empty array for whitespace-only text', async () => {
      const segments = await service.segmentText('   ');
      expect(segments).toHaveLength(0);
    });

    it('should handle empty results from API', async () => {
      const mockResponse: SegmentationApiResponse = {
        results: [],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const segments = await service.segmentText('Some text');
      expect(segments).toHaveLength(0);
    });

    it('should handle segments that appear multiple times in text', async () => {
      const mockResponse: SegmentationApiResponse = {
        results: [
          { label: 0, score: 0, sentence_text: 'Hello.' },
          { label: 1, score: 0, sentence_text: 'Hello.' }, // Duplicate text
        ],
      };

      const originalText = 'Hello. Hello.';

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const segments = await service.segmentText(originalText);

      expect(segments).toHaveLength(2);
      // First segment should be at position 0
      expect(segments[0].start).toBe(0);
      // Second segment should be found after first segment
      expect(segments[1].start).toBeGreaterThan(segments[0].end);
    });

    it('should skip segments not found in original text', async () => {
      const mockResponse: SegmentationApiResponse = {
        results: [
          { label: 0, score: 0, sentence_text: 'Found text.' },
          { label: 1, score: 0, sentence_text: 'Not in original!' },
          { label: 2, score: 0, sentence_text: 'Also found.' },
        ],
      };

      const originalText = 'Found text. Also found.';

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const segments = await service.segmentText(originalText);

      expect(segments).toHaveLength(2);
      expect(segments[0].text).toBe('Found text.');
      expect(segments[1].text).toBe('Also found.');
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should throw AppError on API failure', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as Response);

      await expect(service.segmentText('Some text')).rejects.toMatchObject({
        code: 'HTTP_500',
      });
    });

    it('should throw AppError on network error', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('NetworkError'));

      await expect(service.segmentText('Some text')).rejects.toMatchObject({
        code: 'NETWORK_ERROR',
      });
    });
  });
});

