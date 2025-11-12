import {
  getFeatureFlags,
  isFeatureEnabled,
  resetFeatureFlagOverrides,
  setFeatureFlagOverrides,
  withFeatureFlags,
} from '@/application/config/featureFlags';

describe('featureFlags', () => {
  afterEach(() => {
    resetFeatureFlagOverrides();
  });

  it('returns defaults when no overrides are provided', () => {
    const snapshot = getFeatureFlags();
    expect(snapshot.semanticTagging).toBe(false);
    expect(snapshot.remoteApi).toBe(false);
    expect(snapshot.workspaceDiagnostics).toBe(false);
  });

  it('allows querying individual flags', () => {
    expect(isFeatureEnabled('semanticTagging')).toBe(false);
    setFeatureFlagOverrides({ semanticTagging: true });
    expect(isFeatureEnabled('semanticTagging')).toBe(true);
  });

  it('merges overrides on top of defaults', () => {
    setFeatureFlagOverrides({ remoteApi: true });
    const snapshot = getFeatureFlags();
    expect(snapshot.remoteApi).toBe(true);
    expect(snapshot.semanticTagging).toBe(false);
  });

  it('supports temporary overrides via withFeatureFlags', () => {
    setFeatureFlagOverrides({ semanticTagging: false });
    const result = withFeatureFlags({ semanticTagging: true }, () => {
      return isFeatureEnabled('semanticTagging');
    });
    expect(result).toBe(true);
    expect(isFeatureEnabled('semanticTagging')).toBe(false);
  });
});

