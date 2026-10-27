import { Inbox, CircleAlert, LoaderCircle } from 'lucide-react';
import type { ReactNode } from 'react';

export default function ViewState({ kind = 'empty', title, description, action, compact = false }: {
  kind?: 'empty' | 'loading' | 'error'; title: string; description?: string; action?: ReactNode; compact?: boolean;
}) {
  const Icon = kind === 'error' ? CircleAlert : kind === 'loading' ? LoaderCircle : Inbox;
  return <section className={`view-state view-state-${kind}${compact ? ' view-state-compact' : ''}`}
    role={kind === 'error' ? 'alert' : kind === 'loading' ? 'status' : undefined} aria-live={kind === 'loading' ? 'polite' : undefined}>
    <span className="view-state-icon" aria-hidden="true"><Icon size={24} /></span>
    <div className="view-state-copy"><h2>{title}</h2>{description && <p>{description}</p>}{action && <div className="view-state-action">{action}</div>}</div>
  </section>;
}
