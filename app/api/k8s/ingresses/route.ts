import { NextResponse } from 'next/server';

// Inline K8s types to avoid needing separate types package
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

export async function GET() {
  try {
    // Try to load K8s client
    let k8sClient: any;
    let isInCluster = false;

    try {
      // Dynamic import to avoid errors when not in K8s
      const k8s = await import('@kubernetes/client-node');
      k8sClient = new k8s.KubeConfig();
      
      // Try to load from cluster
      try {
        k8sClient.loadFromCluster();
        isInCluster = true;
      } catch {
        // Not in cluster, try from default location
        try {
          k8sClient.loadFromDefault();
          isInCluster = true;
        } catch {
          // Not configured
          isInCluster = false;
        }
      }
    } catch {
      // K8s client not available
      isInCluster = false;
    }

    if (!isInCluster || !k8sClient) {
      return NextResponse.json<K8sResponse>({
        isInCluster: false,
        ingresses: [],
      });
    }

    // Fetch both Ingress and Gateway API HTTPRoutes
    const k8s = await import('@kubernetes/client-node');
    const ingresses: IngressLink[] = [];
    
    // 1. Fetch Ingress resources (standard Kubernetes Ingress)
    try {
      const netApi = k8sClient.makeApiClient(k8s.NetworkingV1Api);
      const ingressResponse = await netApi.listIngressForAllNamespaces();
      
      if (ingressResponse.items && ingressResponse.items.length > 0) {
        for (const ingress of ingressResponse.items) {
          if (ingress.spec && ingress.spec.rules && ingress.spec.rules.length > 0) {
            for (const rule of ingress.spec.rules) {
              if (rule.host) {
                // Determine protocol from TLS settings
                const protocol = ingress.spec.tls && ingress.spec.tls.length > 0 ? 'https' : 'http';
                const namespace = ingress.metadata?.namespace || 'default';
                const name = ingress.metadata?.name || 'unknown';
                
                // Handle path-based routing
                if (rule.http && rule.http.paths && rule.http.paths.length > 0) {
                  for (const path of rule.http.paths) {
                    const pathValue = path.path || '/';
                    const url = `${protocol}://${rule.host}${pathValue}`;
                    ingresses.push({
                      title: `${rule.host}${pathValue} (${namespace}/${name})`,
                      url,
                      description: `Ingress: ${name} in namespace ${namespace}`,
                    });
                  }
                } else {
                  // No paths defined, just use the host
                  const url = `${protocol}://${rule.host}`;
                  ingresses.push({
                    title: `${rule.host} (${namespace}/${name})`,
                    url,
                    description: `Ingress: ${name} in namespace ${namespace}`,
                  });
                }
              }
            }
          }
        }
      }
    } catch (error: any) {
      console.error('Error fetching Ingress resources:', error.message);
    }

    // 2. Fetch Gateway API HTTPRoutes (Gateway API v1)
    try {
      const objectApi = k8s.KubernetesObjectApi.makeApiClient(k8sClient);
      // Gateway API uses gateway.networking.k8s.io/v1 and HTTPRoute kind
      const httpRoutesResponse = await objectApi.list(
        'gateway.networking.k8s.io/v1',
        'HTTPRoute'
      );
      
      if (httpRoutesResponse.items && Array.isArray(httpRoutesResponse.items)) {
        for (const route of httpRoutesResponse.items) {
          const routeAny = route as any;
          if (routeAny.spec && routeAny.spec.hostnames && routeAny.spec.hostnames.length > 0) {
            const namespace = routeAny.metadata?.namespace || 'default';
            const name = routeAny.metadata?.name || 'unknown';
            
            // Handle path-based routing in HTTPRoute
            if (routeAny.spec.rules && routeAny.spec.rules.length > 0) {
              for (const rule of routeAny.spec.rules) {
                if (rule.matches && rule.matches.length > 0) {
                  for (const match of rule.matches) {
                    const pathValue = match.path?.value || '/';
                    for (const hostname of routeAny.spec.hostnames) {
                      const url = `https://${hostname}${pathValue}`;
                      ingresses.push({
                        title: `${hostname}${pathValue} (${namespace}/${name})`,
                        url,
                        description: `HTTPRoute: ${name} in namespace ${namespace}`,
                      });
                    }
                  }
                } else {
                  // No paths defined, just use hostnames
                  for (const hostname of routeAny.spec.hostnames) {
                    const url = `https://${hostname}`;
                    ingresses.push({
                      title: `${hostname} (${namespace}/${name})`,
                      url,
                      description: `HTTPRoute: ${name} in namespace ${namespace}`,
                    });
                  }
                }
              }
            } else {
              // No rules defined, just use hostnames
              for (const hostname of routeAny.spec.hostnames) {
                const url = `https://${hostname}`;
                ingresses.push({
                  title: `${hostname} (${namespace}/${name})`,
                  url,
                  description: `HTTPRoute: ${name} in namespace ${namespace}`,
                });
              }
            }
          }
        }
      }
    } catch (error: any) {
      // Gateway API might not be installed, which is fine
      if (!error.message.includes('404') && !error.message.includes('not found')) {
        console.error('Error fetching Gateway API HTTPRoutes:', error.message);
      }
    }

    return NextResponse.json<K8sResponse>({
      isInCluster: true,
      ingresses,
    });
  } catch (error: any) {
    console.error('Error fetching K8s routes:', error.message);
    
    return NextResponse.json<K8sResponse>({
      isInCluster: false,
      ingresses: [],
      error: error.message,
    });
  }
}

