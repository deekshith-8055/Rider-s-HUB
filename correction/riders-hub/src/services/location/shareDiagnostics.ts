/**
 * Tiny observable that records whether this device's live location is actually
 * reaching the server, so the UI can show a plain-English status instead of
 * failing silently (e.g. database rules not published).
 */
export interface ShareStatus {
  lastOkAt: number | null;
  rtdbError: string | null;
  firestoreError: string | null;
  /** How many riders each channel is currently delivering for the watched ride (null = not subscribed yet). */
  rtdbCount: number | null;
  firestoreCount: number | null;
}

let status: ShareStatus = { lastOkAt: null, rtdbError: null, firestoreError: null, rtdbCount: null, firestoreCount: null };
const listeners = new Set<(s: ShareStatus) => void>();

export const shareDiagnostics = {
  get: () => status,
  report(patch: Partial<ShareStatus>) {
    status = { ...status, ...patch };
    listeners.forEach((l) => l(status));
  },
  subscribe(cb: (s: ShareStatus) => void) {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  },
};

export function describeShareError(code: string | null): string {
  if (!code) return '';
  if (/permission[-_ ]denied/i.test(code)) return 'permission denied — publish the Firebase rules';
  if (/unavailable|network/i.test(code)) return 'network problem';
  return code;
}
