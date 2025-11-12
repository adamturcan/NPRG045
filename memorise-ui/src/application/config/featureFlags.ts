export type FeatureFlagName =
  | 'semanticTagging'
  | 'remoteApi'
  | 'workspaceDiagnostics';

export type FeatureFlags = Record<FeatureFlagName, boolean>;

const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  semanticTagging: false,
  remoteApi: false,
  workspaceDiagnostics: false,
};

let overrides: Partial<FeatureFlags> | null = null;

export type FeatureFlagSnapshot = Readonly<FeatureFlags>;

export function getFeatureFlags(): FeatureFlagSnapshot {
  return Object.freeze({
    ...DEFAULT_FEATURE_FLAGS,
    ...(overrides ?? {}),
  }) as FeatureFlagSnapshot;
}

export function isFeatureEnabled(flag: FeatureFlagName): boolean {
  if (overrides?.[flag] !== undefined) {
    return overrides[flag] ?? false;
  }

  return DEFAULT_FEATURE_FLAGS[flag];
}

export function setFeatureFlagOverrides(next: Partial<FeatureFlags>): void {
  overrides = { ...next };
}

export function resetFeatureFlagOverrides(): void {
  overrides = null;
}

export function withFeatureFlags<T>(
  next: Partial<FeatureFlags>,
  fn: () => T
): T {
  const previous = overrides;
  overrides = { ...(overrides ?? {}), ...next };
  try {
    return fn();
  } finally {
    overrides = previous;
  }
}

