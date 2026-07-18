// src/services/__tests__/LinkPreviewService.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LinkPreviewService from '../LinkPreviewService.js';

describe('LinkPreviewService', () => {
  beforeEach(() => {
    LinkPreviewService.cache.clear();
    vi.restoreAllMocks();
  });

  it('should resolve and return live metadata if fetch succeeds', async () => {
    const mockResponse = {
      status: 'success',
      data: {
        title: 'Axona Protocol',
        description: 'Decentralized P2P mesh network',
        image: { url: 'https://axona.net/og.png' },
        logo: { url: 'https://axona.net/favicon.ico' },
        publisher: 'Axona Network'
      }
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockResponse
    });

    const preview = await LinkPreviewService.fetchPreview('https://axona.net/protocol');
    
    expect(fetchSpy).toHaveBeenCalled();
    expect(preview.title).toBe('Axona Protocol');
    expect(preview.description).toBe('Decentralized P2P mesh network');
    expect(preview.image).toBe('https://axona.net/og.png');
    expect(preview.publisher).toBe('Axona Network');
  });

  it('should fall back to local mocks for popular websites if fetch fails', async () => {
    // Force fetch failure (e.g. offline/network error)
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

    const preview = await LinkPreviewService.fetchPreview('https://github.com/axona/protocol');
    expect(preview.publisher).toBe('GitHub');
    expect(preview.title).toContain('GitHub');
    expect(preview.logo).toContain('favicon');
  });

  it('should generate fallback metadata for arbitrary websites if fetch fails', async () => {
    // Force fetch failure
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

    const preview = await LinkPreviewService.fetchPreview('https://example.com/some/page');
    expect(preview.publisher).toBe('EXAMPLE.COM');
    expect(preview.title).toBe('Example.com — Link Preview');
    expect(preview.description).toContain('Visit example.com');
  });

  it('should cache preview results to prevent duplicate calls', async () => {
    const mockResponse = {
      status: 'success',
      data: { title: 'Cached Title', publisher: 'CacheTest' }
    };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockResponse
    });

    const url = 'https://some-uncached-site.com';
    const preview1 = await LinkPreviewService.fetchPreview(url);
    const preview2 = await LinkPreviewService.fetchPreview(url);
    
    expect(fetchSpy).toHaveBeenCalledTimes(1); // Fetch called only once
    expect(preview1).toBe(preview2);
  });
});
