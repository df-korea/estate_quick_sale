export function isTossWebView(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    return !!(
      w.__appsInToss ||
      w.ReactNativeWebView ||
      w.__GRANITE_NATIVE_EMITTER ||
      navigator.userAgent.includes('TOSS')
    );
  } catch {
    return false;
  }
}
