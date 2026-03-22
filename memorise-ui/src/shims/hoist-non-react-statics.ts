// No-op shim for hoist-non-react-statics.
// The real package bundles react-is@16 which crashes on React 19.
// This shim is safe because the hoisting is only cosmetic (copies displayName, etc).
export default function hoistNonReactStatics<T, S>(target: T, _source: S): T {
  return target;
}
