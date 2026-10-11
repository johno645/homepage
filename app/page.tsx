import K8sLinksSection from '@/components/K8sLinksSection';
import linksConfig from '../links.config.json';
import type { LinksConfig } from '@/types/config';
import { resolveLinksConfig } from '@/lib/config';

export const dynamic = 'force-dynamic';
export default function Home() {
  const config = resolveLinksConfig(process.env.HOMEPAGE_LINKS, linksConfig as LinksConfig);
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
        <header className="mb-8 border-b border-zinc-200 pb-6 dark:border-zinc-800"><p className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-500">Developer dashboard</p><h1 className="text-3xl font-bold tracking-tight">{config.name}</h1></header>
        <K8sLinksSection configuredLinks={config.links} />
      </main>
    </div>
  );
}
