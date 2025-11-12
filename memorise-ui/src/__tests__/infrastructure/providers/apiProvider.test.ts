import { describe, it, expect, beforeEach } from 'vitest';
import {
  getApiService,
  setApiProviderOverrides,
  resetApiProvider,
} from '@/infrastructure/providers/apiProvider';
import { BrowserApiService } from '@/infrastructure/services/BrowserApiService';

describe('apiProvider', () => {
  beforeEach(() => {
    resetApiProvider();
  });

  it('returns a BrowserApiService singleton by default', () => {
    const serviceA = getApiService();
    const serviceB = getApiService();
    expect(serviceA).toBeInstanceOf(BrowserApiService);
    expect(serviceA).toBe(serviceB);
  });

  it('supports overriding the api service', () => {
    const override = { translate: async () => ({ translatedText: '', targetLang: 'en' }) } as any;
    setApiProviderOverrides({ apiService: override });
    expect(getApiService()).toBe(override);
  });
});


