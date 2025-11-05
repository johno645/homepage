'use client';

import LinkCard from '@/components/LinkCard';
import K8sLinksSection from '@/components/K8sLinksSection';
import linksConfig from '../links.config.json';
import { useEffect, useState } from 'react';

export default function Home() {
  const [config, setConfig] = useState<any>(linksConfig);

  useEffect(() => {
    // Fetch config from API to get Helm values at runtime
    fetch('/api/config')
      .then(res => res.json())
      .then(data => setConfig(data))
      .catch(() => {
        // Fall back to static config
        setConfig(linksConfig);
      });
  }, []);
  
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-50 via-white to-zinc-100 font-sans dark:from-black dark:via-zinc-950 dark:to-black">
      <main className="flex min-h-screen w-full max-w-6xl flex-col px-8 py-16 sm:px-16">
        {/* Header */}
        <div className="mb-16 text-center">
          <h1 className="mb-4 text-5xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-6xl">
            {config.name}
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400">
            Your personal developer dashboard
          </p>
        </div>

        {/* Static Links Section */}
        <div>
          <div className="mb-8 text-center">
            <h2 className="mb-2 text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
              Quick Links
            </h2>
            <p className="text-base text-zinc-600 dark:text-zinc-400">
              Configured links
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {(config.items || config.links || []).map((link: any, index: number) => (
              <LinkCard
                key={index}
                title={link.title}
                url={link.url}
                description={link.description}
                icon={link.icon}
              />
            ))}
          </div>
        </div>

        {/* K8s Links Section */}
        <K8sLinksSection />

        {/* Footer */}
        <div className="mt-16 text-center text-sm text-zinc-500 dark:text-zinc-500">
          <p>Configured via Helm values or <code className="rounded bg-zinc-100 px-2 py-1 dark:bg-zinc-900">links.config.json</code></p>
        </div>
      </main>
    </div>
  );
}
