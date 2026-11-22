'use client';
import { useEffect } from 'react';
import { auth } from '../lib/firebase';
import { startDiagnostics } from '../lib/diagnostics';

export default function DiagnosticMonitor() {
  useEffect(() => startDiagnostics({
    version: process.env.NEXT_PUBLIC_APP_VERSION,
    getToken: () => auth.currentUser?.getIdToken() || null,
  }), []);
  return null;
}
