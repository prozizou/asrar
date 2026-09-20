'use client';
// Recherche globale des modules (revue design : « absence de recherche
// visible » — retrouver Hatims, Abajad, Rouwhanes… sans dérouler les
// familles). Purement locale : les 12 modules tiennent en mémoire, aucun
// appel réseau, donc un résultat instantané à chaque frappe. La logique de
// correspondance vit dans lib/moduleSearch.js (pure, testée) ; ce composant
// ne fait que l'UI.
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, X } from 'lucide-react';
import { searchModules } from '@/lib/moduleSearch';
import { trackRecentModule } from '@/lib/recentModules';

export default function MenuSearch({ items }) {
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchModules(items, query), [items, query]);
  const active = query.trim().length > 0;

  return (
    <div className="menu-search-wrap">
      <div className="menu-search">
        <Search size={17} strokeWidth={2} aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un module…"
          aria-label="Rechercher un module"
          autoComplete="off"
        />
        {active && (
          <button type="button" className="menu-search-clear" onClick={() => setQuery('')} aria-label="Effacer la recherche">
            <X size={15} strokeWidth={2.5} aria-hidden="true" />
          </button>
        )}
      </div>

      {active && (
        results.length > 0 ? (
          <ul className="menu-search-results">
            {results.map((it) => (
              <li key={it.href}>
                <Link href={it.href} className="menu-search-result" onClick={() => trackRecentModule(it.href)}>
                  <span className="menu-search-result-icon" aria-hidden="true">{it.icon}</span>
                  <span className="menu-search-result-id">
                    <strong>{it.label}</strong>
                    <span>{it.category}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="menu-search-empty">Aucun module ne correspond à « {query.trim()} ».</p>
        )
      )}
    </div>
  );
}
