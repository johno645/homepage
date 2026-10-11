'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ExternalLink, RefreshCw, Search, Star, X, Copy } from 'lucide-react';
import type { IngressLink } from '@/lib/kubernetes-routes';
import AppIcon from './AppIcon';
import type { LinkItem } from '@/types/config';

interface K8sResponse {
  isInCluster: boolean;
  enabled: boolean;
  clusterName: string;
  environment: string;
  refreshSeconds: number;
  ingresses: IngressLink[];
  warnings: string[];
  fetchedAt?: string;
  error?: string;
}
interface Preferences {
  favorites: string[];
  namespace: string;
  environment: string;
  view: 'cards' | 'table';
  theme: 'system' | 'light' | 'dark';
  recent: string[];
}
const defaults: Preferences = { favorites: [], namespace: '', environment: '', view: 'cards', theme: 'system', recent: [] };
const storageKey = 'homepage.preferences.v1';
function snapshot() {
  try { return localStorage.getItem(storageKey) ?? ''; } catch { return ''; }
}
function subscribe(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener('homepage:preferences', callback);
  return () => { window.removeEventListener('storage', callback); window.removeEventListener('homepage:preferences', callback); };
}
function usePreferences() {
  const raw = useSyncExternalStore(subscribe, snapshot, () => '');
  const preferences = useMemo<Preferences>(() => {
    try {
      const p = JSON.parse(raw);
      return {
        favorites: Array.isArray(p.favorites) ? p.favorites.filter((v: unknown) => typeof v === 'string') : [],
        recent: Array.isArray(p.recent) ? p.recent.filter((v: unknown) => typeof v === 'string') : [],
        namespace: typeof p.namespace === 'string' ? p.namespace : '',
        environment: typeof p.environment === 'string' ? p.environment : '',
        view: p.view === 'table' ? 'table' : 'cards',
        theme: ['light', 'dark'].includes(p.theme) ? p.theme : 'system',
      };
    } catch { return defaults; }
  }, [raw]);
  const update = (patch: Partial<Preferences>) => {
    try { localStorage.setItem(storageKey, JSON.stringify({ ...preferences, ...patch })); window.dispatchEvent(new Event('homepage:preferences')); } catch { /* Browser storage can be disabled. */ }
  };
  return { preferences, update };
}
const control = 'rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900';
function Badge({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex rounded-md bg-zinc-100 px-2 py-1 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">{children}</span>;
}
function Health({ link }: { link: IngressLink }) {
  const health = link.health;
  return <span className={`text-xs font-medium ${health?.state === 'healthy' ? 'text-emerald-700 dark:text-emerald-400' : health?.state === 'warning' ? 'text-amber-700 dark:text-amber-400' : 'text-zinc-500'}`}>{health ? `${health.state} · ${health.ready}/${health.total} pods ready` : 'Health not enabled'}</span>;
}
function AppDetails({ link, close }: { link: IngressLink; close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  useEffect(() => { dialog.current?.showModal(); }, []);
  const command = `kubectl get ${link.kind.toLowerCase()} ${link.name} -n ${link.namespace} -o yaml`;
  return <dialog ref={dialog} onClose={close} className="fixed inset-0 m-auto max-h-[85vh] w-[min(44rem,95vw)] overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-6 text-zinc-900 shadow-2xl backdrop:bg-black/50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100" aria-labelledby="details-title">
    <div className="flex items-start justify-between gap-4"><div><h2 id="details-title" className="text-2xl font-bold">{link.title}</h2><p className="mt-1 text-sm text-zinc-500">{link.namespace} / {link.name} · {link.kind}</p></div><button autoFocus onClick={() => dialog.current?.close()} className={control} aria-label="Close details"><X size={18} /></button></div>
    <p className="my-4">{link.description}</p>
    <div className="flex flex-wrap gap-2">{link.tags.map(t => <Badge key={t}>{t}</Badge>)}</div>
    <div className="mt-6 space-y-5 text-sm">
      <section><h3 className="mb-2 font-semibold">Endpoint</h3><p className="break-all">{link.endpoint || 'Not resolved'}</p>{link.linkable && <a href={link.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-2 text-blue-600 dark:text-blue-400">Open app <ExternalLink size={14} /></a>}</section>
      <section><h3 className="mb-2 font-semibold">Transport evidence</h3><ul className="list-inside list-disc space-y-1">{link.evidence.map(e => <li key={e}>{e}</li>)}</ul><p className="mt-2 text-zinc-500">Tags describe declared configuration. HTTP reachability and successful TLS handshakes are not measured.</p></section>
      {(link.issues.length > 0 || !!link.health?.warnings.length) && <section className="rounded-lg bg-amber-50 p-3 text-amber-900 dark:bg-amber-950 dark:text-amber-200"><h3 className="font-semibold">Needs attention</h3><ul className="mt-2 list-inside list-disc space-y-1">{[...link.issues, ...(link.health?.warnings ?? [])].map((e, i) => <li key={i}>{e}</li>)}</ul></section>}
      <section><h3 className="mb-2 font-semibold">Backends</h3>{link.backends.length ? link.backends.map((b, i) => <p key={i}>{b.kind} {b.namespace}/{b.name}{b.port ? `:${b.port}` : ''}</p>) : <p>No backend reference</p>}</section>
      <section><h3 className="mb-2 font-semibold">Workload health</h3><Health link={link} />{link.health && <><p className="mt-2">{link.health.restarts} cumulative container restarts</p>{link.health.rollouts.map(r => <p key={`${r.kind}/${r.name}`} className="mt-2">{r.kind}/{r.name}: {r.ready}/{r.desired} replicas ready · {r.updated} updated</p>)}{link.health.workloads.map(w => <p key={w}>{w}</p>)}{link.health.images.map(image => <p className="mt-1 break-all font-mono text-xs" key={image}>{image}</p>)}{link.health.cpuMillicores !== undefined && <p className="mt-2">CPU: {Math.round(link.health.cpuMillicores)}m · Memory: {link.health.memoryMiB?.toFixed(1)} MiB</p>}</>}</section>
      {Object.keys(link.tools).length > 0 && <section><h3 className="mb-2 font-semibold">Developer tools</h3><div className="flex flex-wrap gap-2">{Object.entries(link.tools).map(([name, url]) => <a key={name} href={url} target="_blank" rel="noopener noreferrer" className={control}>{name} ↗</a>)}</div></section>}
      <section><h3 className="mb-2 font-semibold">Inspect resource</h3><div className="flex items-center gap-3"><code className="break-all text-xs">{command}</code><button className={control} aria-label="Copy kubectl command" onClick={async () => { try { await navigator.clipboard.writeText(command); setCopied(true); } catch { setCopyError('Clipboard unavailable. Select and copy the command.'); } }}><Copy size={16} /></button></div><p role="status" className="mt-2 text-xs">{copyError || (copied ? 'Copied' : '')}</p></section>
    </div>
  </dialog>;
}

export default function K8sLinksSection({ configuredLinks = [] }: { configuredLinks?: LinkItem[] }) {
  const [data, setData] = useState<K8sResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [selected, setSelected] = useState<IngressLink | null>(null);
  const search = useRef<HTMLInputElement>(null);
  const activeRequest = useRef<AbortController | null>(null);
  const { preferences, update } = usePreferences();
  const refresh = useCallback(async () => {
    if (activeRequest.current) return;
    const controller = new AbortController();
    activeRequest.current = controller;
    setLoading(true);
    try {
      const response = await fetch('/api/k8s/ingresses', { signal: controller.signal, cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to refresh Kubernetes data.');
      setData(result);
      setError(result.error || '');
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Unable to refresh Kubernetes data.');
    } finally {
      activeRequest.current = null;
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);
  useEffect(() => {
    const initial = setTimeout(() => void refresh(), 0);
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, (data?.refreshSeconds ?? 30) * 1000);
    return () => { clearTimeout(initial); clearInterval(timer); };
  }, [refresh, data?.refreshSeconds]);
  useEffect(() => () => { activeRequest.current?.abort(); }, []);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) && !target.isContentEditable && !document.querySelector('dialog[open]')) { e.preventDefault(); search.current?.focus(); }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => { document.documentElement.dataset.theme = preferences.theme; document.documentElement.classList.toggle('dark', preferences.theme === 'dark' || preferences.theme === 'system' && media.matches); };
    apply(); media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [preferences.theme]);
  const links = data?.ingresses ?? [];
  const namespaces = [...new Set(links.map(l => l.namespace))].sort();
  const environments = [...new Set(links.map(l => l.environment).filter((e): e is string => !!e))].sort();
  const tags = [...new Set(links.flatMap(l => l.tags))].sort();
  const needsAttention = (l: IngressLink) => l.issues.length > 0 || l.health?.state === 'warning';
  const filtered = links.filter(l =>
    (!preferences.namespace || l.namespace === preferences.namespace)
    && (!preferences.environment || l.environment === preferences.environment)
    && (!tag || l.tags.includes(tag)) && (!favoritesOnly || preferences.favorites.includes(l.id)) && (!attentionOnly || needsAttention(l))
    && `${l.title} ${l.endpoint} ${l.namespace} ${l.team ?? ''} ${l.environment ?? ''} ${l.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => Number(preferences.favorites.includes(b.id)) - Number(preferences.favorites.includes(a.id)));
  const openDetails = (link: IngressLink) => { setSelected(link); update({ recent: [link.id, ...preferences.recent.filter(id => id !== link.id)].slice(0, 8) }); };
  const favorite = (link: IngressLink) => update({ favorites: preferences.favorites.includes(link.id) ? preferences.favorites.filter(id => id !== link.id) : [...preferences.favorites, link.id] });
  const recent = preferences.recent.map(id => links.find(l => l.id === id)).filter((l): l is IngressLink => !!l);
  return <section aria-label="Developer dashboard" className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><h2 className="text-2xl font-semibold">{data?.clusterName || 'Cluster overview'}</h2><p className="mt-1 text-sm text-zinc-500">{data?.environment && `${data.environment} · `}{links.length} endpoints · {namespaces.length} namespaces{data?.fetchedAt && ` · Updated ${new Date(data.fetchedAt).toLocaleTimeString()}`}</p></div>
      <div className="flex gap-2"><select aria-label="Theme" className={control} value={preferences.theme} onChange={e => update({ theme: e.target.value as Preferences['theme'] })}><option value="system">System theme</option><option value="light">Light</option><option value="dark">Dark</option></select><button onClick={() => void refresh()} disabled={loading} className={`${control} flex items-center gap-2 disabled:opacity-50`}><RefreshCw size={16} className={loading ? 'animate-spin' : ''} />{loading ? 'Refreshing' : 'Refresh'}</button></div>
    </div>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[['Endpoints', links.length], ['Namespaces', namespaces.length], ['Needs attention', links.filter(needsAttention).length], ['Favorites', links.filter(l => preferences.favorites.includes(l.id)).length]].map(([title, count]) => <div key={title} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"><p className="text-sm text-zinc-500">{title}</p><p className="mt-1 text-2xl font-semibold">{count}</p></div>)}</div>
    {error && <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">{error}{data?.fetchedAt && ' Showing the last successful snapshot.'}</div>}
    {data?.warnings.map(w => <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200" key={w}>{w}</p>)}
    <div className="flex flex-wrap gap-3"><label className="relative min-w-56 flex-1"><Search size={17} className="absolute left-3 top-3 text-zinc-400" /><input ref={search} aria-label="Search apps, hosts, namespaces and tags" placeholder="Search apps, hosts, tags…  /" value={query} onChange={e => setQuery(e.target.value)} className={`${control} w-full pl-10`} /></label><select aria-label="Namespace" value={preferences.namespace} onChange={e => update({ namespace: e.target.value })} className={control}><option value="">All namespaces</option>{preferences.namespace && !namespaces.includes(preferences.namespace) && <option value={preferences.namespace}>{preferences.namespace} (unavailable)</option>}{namespaces.map(n => <option key={n} value={n}>{n} ({links.filter(l => l.namespace === n).length})</option>)}</select><select aria-label="Environment" value={preferences.environment} onChange={e => update({ environment: e.target.value })} className={control}><option value="">All environments</option>{preferences.environment && !environments.includes(preferences.environment) && <option value={preferences.environment}>{preferences.environment} (unavailable)</option>}{environments.map(e => <option key={e}>{e}</option>)}</select><select aria-label="Tag" className={control} value={tag} onChange={e => setTag(e.target.value)}><option value="">All tags</option>{tags.map(t => <option key={t}>{t}</option>)}</select></div>
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm"><div className="flex gap-4"><label className="flex items-center gap-2"><input type="checkbox" checked={favoritesOnly} onChange={e => setFavoritesOnly(e.target.checked)} />Favorites</label><label className="flex items-center gap-2"><input type="checkbox" checked={attentionOnly} onChange={e => setAttentionOnly(e.target.checked)} />Needs attention</label><button className="text-blue-600 dark:text-blue-400" onClick={() => { setQuery(''); setTag(''); setFavoritesOnly(false); setAttentionOnly(false); update({ namespace: '', environment: '' }); }}>Clear filters</button></div><select aria-label="Layout" className={control} value={preferences.view} onChange={e => update({ view: e.target.value as Preferences['view'] })}><option value="cards">Cards</option><option value="table">Table</option></select></div>
    {recent.length > 0 && <div className="flex flex-wrap items-center gap-2 text-xs"><span className="text-zinc-500">Recently viewed</span>{recent.map(l => <button key={l.id} className={control} onClick={() => openDetails(l)}>{l.title}</button>)}</div>}
    {loading && !data ? <div aria-label="Loading routes" role="status" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map(i => <div key={i} className="h-48 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-900" />)}</div> : !filtered.length ? <div className="rounded-xl border border-dashed border-zinc-300 p-10 text-center text-zinc-500 dark:border-zinc-700">{data?.enabled === false ? 'Kubernetes discovery is disabled.' : links.length ? 'No apps match these filters.' : 'No routes discovered. Check connectivity, discovery scope, and resource annotations.'}</div> : preferences.view === 'cards' ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{filtered.map(link => <article key={link.id} className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"><div className="flex items-start justify-between gap-3"><button onClick={() => openDetails(link)} className="flex items-center gap-2 text-left font-semibold hover:underline"><AppIcon name={link.icon} />{link.title}</button><button aria-label={`${preferences.favorites.includes(link.id) ? 'Unfavorite' : 'Favorite'} ${link.title}`} aria-pressed={preferences.favorites.includes(link.id)} onClick={() => favorite(link)}><Star size={17} className={preferences.favorites.includes(link.id) ? 'fill-amber-400 text-amber-500' : 'text-zinc-400'} /></button></div><p className="text-xs text-zinc-500">{link.namespace}{link.team && ` · ${link.team}`}{link.environment && ` · ${link.environment}`}</p><p className="break-all text-sm text-zinc-500">{link.endpoint || 'Endpoint unresolved'}</p><div className="flex flex-wrap gap-1.5">{link.tags.map(t => <Badge key={t}>{t}</Badge>)}</div><Health link={link} /><div className="mt-auto flex items-center justify-between pt-2 text-sm"><button className="text-blue-600 dark:text-blue-400" onClick={() => openDetails(link)}>Details{needsAttention(link) ? ' · Needs attention' : ''}</button>{link.linkable && <a href={link.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${link.title}`} className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400">Open <ExternalLink size={14} /></a>}</div></article>)}</div> : <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800"><table className="w-full text-left text-sm"><caption className="sr-only">Discovered cluster endpoints</caption><thead className="bg-zinc-100 dark:bg-zinc-900"><tr>{['Favorite', 'App', 'Namespace', 'Transport', 'Health', 'Endpoint'].map(h => <th className="p-3" key={h} scope="col">{h}</th>)}</tr></thead><tbody>{filtered.map(l => <tr key={l.id} className="border-t border-zinc-200 dark:border-zinc-800"><td className="p-3"><button aria-label={`Favorite ${l.title}`} aria-pressed={preferences.favorites.includes(l.id)} onClick={() => favorite(l)}><Star size={16} className={preferences.favorites.includes(l.id) ? 'fill-amber-400 text-amber-500' : 'text-zinc-400'} /></button></td><td className="p-3"><button onClick={() => openDetails(l)} className="font-medium hover:underline">{l.title}</button></td><td className="p-3">{l.namespace}</td><td className="p-3"><div className="flex min-w-48 flex-wrap gap-1">{l.tags.map(t => <Badge key={t}>{t}</Badge>)}</div></td><td className="min-w-40 p-3"><Health link={l} /></td><td className="p-3">{l.linkable ? <a className="text-blue-600 dark:text-blue-400" href={l.url} target="_blank" rel="noopener noreferrer">{l.url} ↗</a> : l.endpoint || 'Unresolved'}</td></tr>)}</tbody></table></div>}
    {configuredLinks.length > 0 && <section className="border-t border-zinc-200 pt-6 dark:border-zinc-800"><h2 className="mb-3 font-semibold">Quick links</h2><div className="flex flex-wrap gap-3">{configuredLinks.filter(l => `${l.title} ${l.description} ${l.url}`.toLowerCase().includes(query.toLowerCase())).map(l => <a key={l.url} title={l.description} href={l.url} target="_blank" rel="noopener noreferrer" className={`${control} inline-flex items-center gap-2`}><AppIcon name={l.icon} />{l.title} ↗</a>)}</div></section>}
    {selected && <AppDetails key={selected.id} link={selected} close={() => setSelected(null)} />}
  </section>;
}
