export function isTossWebView(): boolean {
  try {
    return (
      typeof window !== 'undefined' &&
      (navigator.userAgent.includes('TOSS') || !!(window as any).__AIT__)
    );
  } catch {
    return false;
  }
}
