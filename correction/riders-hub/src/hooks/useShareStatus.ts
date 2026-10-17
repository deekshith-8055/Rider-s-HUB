import { useEffect, useState } from 'react';
import { shareDiagnostics, describeShareError, type ShareStatus } from '../services/location/shareDiagnostics';

/** Human-readable status of this device's live-location sharing (refreshes every second). */
export function useShareStatus() {
  const [status, setStatus] = useState<ShareStatus>(shareDiagnostics.get());
  const [, tick] = useState(0);
  useEffect(() => {
    const unsub = shareDiagnostics.subscribe(setStatus);
    const id = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => {
      unsub();
      window.clearInterval(id);
    };
  }, []);

  const bothFailed = !!status.rtdbError && !!status.firestoreError;
  const ageS = status.lastOkAt ? Math.round((Date.now() - status.lastOkAt) / 1000) : null;

  let tone: 'ok' | 'warn' | 'error' = 'warn';
  let text = 'Waiting for your GPS fix…';
  if (bothFailed) {
    tone = 'error';
    text = `Your location is NOT reaching the server: ${describeShareError(status.firestoreError)}`;
  } else if (status.lastOkAt && ageS !== null && ageS < 20) {
    tone = status.rtdbError || status.firestoreError ? 'warn' : 'ok';
    text = `Sending your location ✓ (${ageS}s ago)${
      status.rtdbError ? ` — live channel issue: ${describeShareError(status.rtdbError)}` : ''
    }`;
  } else if (status.lastOkAt) {
    tone = 'warn';
    text = `Last sent ${ageS}s ago — is GPS on and the app open?`;
  }
  return { tone, text, status };
}
