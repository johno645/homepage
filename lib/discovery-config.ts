export interface DiscoveryConfig {
  enabled: boolean;
  clusterName: string;
  environment: string;
  namespaces: string[];
  labelSelector: string;
  refreshSeconds: number;
  cacheSeconds: number;
  timeoutSeconds: number;
  healthEnabled: boolean;
  metricsEnabled: boolean;
  toolTemplates: Record<string, string>;
}

export function discoveryConfig(env: NodeJS.ProcessEnv = process.env): DiscoveryConfig {
  const bounded = (value: string | undefined, fallback: number, min: number, max: number) => {
    const number = Number(value);
    return value && Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
  };
  let toolTemplates: Record<string, string> = {};
  try {
    const parsed: unknown = JSON.parse(env.HOMEPAGE_TOOL_TEMPLATES ?? '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      toolTemplates = Object.fromEntries(Object.entries(parsed).filter(([, value]) => typeof value === 'string'));
    }
  } catch { console.error('Invalid HOMEPAGE_TOOL_TEMPLATES JSON'); }
  return {
    enabled: env.HOMEPAGE_K8S_ENABLED !== 'false',
    clusterName: env.HOMEPAGE_CLUSTER_NAME || 'Kubernetes',
    environment: env.HOMEPAGE_ENVIRONMENT || '',
    namespaces: [...new Set((env.HOMEPAGE_NAMESPACES ?? '').split(',').map(n => n.trim()).filter(Boolean))],
    labelSelector: env.HOMEPAGE_LABEL_SELECTOR || '',
    refreshSeconds: bounded(env.HOMEPAGE_REFRESH_SECONDS, 30, 10, 3600),
    cacheSeconds: bounded(env.HOMEPAGE_CACHE_SECONDS, 15, 0, 300),
    timeoutSeconds: bounded(env.HOMEPAGE_TIMEOUT_SECONDS, 10, 1, 60),
    healthEnabled: env.HOMEPAGE_HEALTH_ENABLED === 'true',
    metricsEnabled: env.HOMEPAGE_METRICS_ENABLED === 'true',
    toolTemplates,
  };
}
