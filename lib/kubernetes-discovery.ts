import { extractHttpRouteLinks, extractIngressLinks, safeUrl, type IngressLink } from './kubernetes-routes.ts';
import { discoveryConfig } from './discovery-config.ts';
import { attachHealth } from './workload-health.ts';

export interface K8sResponse {
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

export async function discover(config = discoveryConfig(), suppliedConfig?: import('@kubernetes/client-node').KubeConfig): Promise<K8sResponse> {
  const data: K8sResponse = { isInCluster: false, enabled: config.enabled, clusterName: config.clusterName, environment: config.environment, refreshSeconds: config.refreshSeconds, ingresses: [], warnings: [] };
  if (!config.enabled) return data;
  const k8s = await import('@kubernetes/client-node');
  const kubeConfig = suppliedConfig ?? new k8s.KubeConfig();
  if (!suppliedConfig) {
    if (process.env.KUBERNETES_SERVICE_HOST && process.env.KUBERNETES_SERVICE_PORT) {
      kubeConfig.loadFromCluster();
    } else if (process.env.NODE_ENV !== 'production') {
      kubeConfig.loadFromDefault();
      if (!kubeConfig.getCurrentCluster()) return { ...data, error: 'No Kubernetes context is configured.' };
    } else {
      return { ...data, error: 'In-cluster credentials are unavailable.' };
    }
  }
  class TimedObjectApi extends k8s.KubernetesObjectApi {
    constructor(configuration: import('@kubernetes/client-node').Configuration) {
      const transport = configuration.httpApi;
      super({ ...configuration, httpApi: { send(request) {
        request.setSignal(AbortSignal.timeout(config.timeoutSeconds * 1000));
        return transport.send(request);
      } } });
    }
  }
  const objectApi = kubeConfig.makeApiClient(TimedObjectApi);
  let successfulLists = 0;
  async function list(apiVersions: string[], kind: string, selector?: string): Promise<unknown[]> {
    const scopes = config.namespaces.length ? config.namespaces : [undefined];
    const items: unknown[] = [];
    for (const namespace of scopes) {
      let available = false;
      for (const version of apiVersions) {
        try {
          const response = await objectApi.list(version, kind, namespace, undefined, undefined, undefined, undefined, selector);
          items.push(...(response.items ?? []));
          successfulLists++;
          available = true;
          break;
        } catch (error) {
          const status = (error as { code?: number }).code;
          if (status === 404 || error instanceof Error && error.message.includes('Unrecognized API version and kind')) continue;
          console.error(`Discovery failed for ${kind}`, error instanceof Error ? error.message : 'Unknown error');
          data.warnings.push(`Unable to read ${kind}${namespace ? ` in ${namespace}` : ''}. Check API connectivity and RBAC.`);
          available = true;
          break;
        }
      }
      if (!available && kind === 'Ingress') data.warnings.push('Ingress API is unavailable.');
    }
    return items;
  }
  const [ingresses, routes, tlsRoutes, gateways, policies] = await Promise.all([
    list(['networking.k8s.io/v1'], 'Ingress', config.labelSelector),
    list(['gateway.networking.k8s.io/v1'], 'HTTPRoute', config.labelSelector),
    list(['gateway.networking.k8s.io/v1', 'gateway.networking.k8s.io/v1alpha2'], 'TLSRoute', config.labelSelector),
    list(['gateway.networking.k8s.io/v1'], 'Gateway'),
    list(['gateway.networking.k8s.io/v1', 'gateway.networking.k8s.io/v1alpha3'], 'BackendTLSPolicy'),
  ]);
  if (!successfulLists && data.warnings.length) throw new Error('All route discovery requests failed.');
  data.ingresses = [...extractIngressLinks(ingresses), ...extractHttpRouteLinks(routes, gateways, policies), ...extractHttpRouteLinks(tlsRoutes, gateways, policies, 'TLSRoute')];
  if (config.healthEnabled) {
    const [services, pods, slices, events, metrics, deployments, replicaSets, statefulSets, daemonSets] = await Promise.all([
      list(['v1'], 'Service'), list(['v1'], 'Pod'), list(['discovery.k8s.io/v1'], 'EndpointSlice'), list(['v1'], 'Event'),
      config.metricsEnabled ? list(['metrics.k8s.io/v1beta1'], 'PodMetrics') : Promise.resolve([]),
      list(['apps/v1'], 'Deployment'), list(['apps/v1'], 'ReplicaSet'), list(['apps/v1'], 'StatefulSet'), list(['apps/v1'], 'DaemonSet'),
    ]);
    attachHealth(data.ingresses, services, pods, slices, events, metrics, [...deployments, ...replicaSets, ...statefulSets, ...daemonSets]);
  }
  for (const link of data.ingresses) {
    link.environment ??= config.environment || undefined;
    for (const [name, template] of Object.entries(config.toolTemplates)) {
      const url = safeUrl(template.replace(/\{(name|namespace|cluster|environment)\}/g, (_, key: string) => encodeURIComponent(({ name: link.name, namespace: link.namespace, cluster: config.clusterName, environment: link.environment ?? '' } as Record<string, string>)[key])));
      if (url && !link.tools[name]) link.tools[name] = url;
    }
  }
  data.ingresses.sort((a, b) => a.namespace.localeCompare(b.namespace) || a.title.localeCompare(b.title));
  data.warnings = [...new Set(data.warnings)];
  data.isInCluster = true;
  data.fetchedAt = new Date().toISOString();
  return data;
}

