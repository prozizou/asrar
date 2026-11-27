import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import PublicShell from '../PublicShell';
import { MODULES, findModule, PLAY_STORE_URL } from '@/lib/publicPages';

type Params = { params: Promise<{ module: string }> };

export const dynamicParams = false;
export function generateStaticParams() {
  return MODULES.map((item) => ({ module: item.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const entry = findModule((await params).module);
  if (!entry) return {};
  return {
    title: `${entry.title} — ASRAR PRO`,
    description: entry.summary,
    alternates: { canonical: `/decouvrir/${entry.slug}` },
  };
}

export default async function ModulePage({ params }: Params) {
  const entry = findModule((await params).module);
  if (!entry) notFound();
  const others = MODULES.filter((item) => item.slug !== entry.slug).slice(0, 4);
  return (
    <PublicShell>
      <p className="pub-crumb"><Link href="/decouvrir">Découvrir</Link> › {entry.category}</p>
      <article className="pub-text">
        <h1>{entry.title}</h1>
        <p className="pub-lead">{entry.summary}</p>
        {entry.sections.map((section) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            {section.paragraphs.map((paragraph) => <p key={paragraph.slice(0, 40)}>{paragraph}</p>)}
          </section>
        ))}
        <p className="pub-actions">
          <a className="pub-button" href={PLAY_STORE_URL} rel="noopener">Télécharger l’application</a>
          <Link className="pub-button pub-button-ghost" href="/">Se connecter</Link>
        </p>
      </article>
      <aside aria-labelledby="pub-more">
        <h2 id="pub-more">Autres modules</h2>
        <ul className="pub-cards">
          {others.map((item) => (
            <li key={item.slug}>
              <Link href={`/decouvrir/${item.slug}`} className="pub-card">
                <strong>{item.title}</strong>
                <span>{item.summary}</span>
              </Link>
            </li>
          ))}
        </ul>
      </aside>
    </PublicShell>
  );
}
