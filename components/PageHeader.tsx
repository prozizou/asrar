import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';

export default function PageHeader({ title, description, eyebrow, actions }: {
  title: string; description?: string; eyebrow?: string; actions?: ReactNode;
}) {
  return <header className="page-heading">
    <Link href="/menu" className="page-back"><ArrowLeft size={18} aria-hidden="true" /> Tableau de bord</Link>
    <div className="page-heading-row"><div className="page-heading-copy">
      {eyebrow && <p className="page-eyebrow">{eyebrow}</p>}
      <h1>{title}</h1>{description && <p className="page-description">{description}</p>}
    </div>{actions && <div className="page-heading-actions">{actions}</div>}</div>
  </header>;
}
