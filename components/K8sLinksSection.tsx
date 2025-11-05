'use client';

import { useEffect, useState } from 'react';
import LinkCard from './LinkCard';

interface IngressLink {
  title: string;
  url: string;
  description: string;
}

interface K8sResponse {
  isInCluster: boolean;
  ingresses: IngressLink[];
  error?: string;
}

export default function K8sLinksSection() {
  const [k8sData, setK8sData] = useState<K8sResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch K8s ingresses
    fetch('/api/k8s/ingresses')
      .then(res => res.json())
      .then((data: K8sResponse) => {
        setK8sData(data);
        setLoading(false);
      })
      .catch(error => {
        console.error('Error fetching K8s data:', error);
        setK8sData({ isInCluster: false, ingresses: [] });
        setLoading(false);
      });
  }, []);

  // Don't render anything while loading
  if (loading) {
    return null;
  }

  // Don't render if not in K8s
  if (!k8sData?.isInCluster) {
    return (
      <div className="mt-16">
        <div className="mb-8 text-center">
          <h2 className="mb-2 text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
            Kubernetes Routes
          </h2>
          <p className="text-base text-zinc-600 dark:text-zinc-400">
            Not running in a Kubernetes cluster
          </p>
        </div>
      </div>
    );
  }

  // Render K8s ingresses
  return (
    <div className="mt-16">
      <div className="mb-8 text-center">
        <h2 className="mb-2 text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
          Kubernetes Routes
        </h2>
        <p className="text-base text-zinc-600 dark:text-zinc-400">
          Discovered {k8sData.ingresses.length} route{k8sData.ingresses.length !== 1 ? 's' : ''} (Ingress & Gateway API)
        </p>
      </div>

      {k8sData.ingresses.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-zinc-600 dark:text-zinc-400">
            No routes found in the cluster
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {k8sData.ingresses.map((link, index) => (
            <LinkCard
              key={index}
              title={link.title}
              url={link.url}
              description={link.description}
              icon="k8s"
            />
          ))}
        </div>
      )}
    </div>
  );
}

