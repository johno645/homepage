# Architecture

## Application and discovery flow

```mermaid
flowchart TD
  Browser["Browser: directory, filters, details"] --> Page["Next.js page"]
  Config["links.config.json or HOMEPAGE_LINKS"] --> Page
  Page --> UI["K8sLinksSection"]
  UI --> API["GET /api/k8s/ingresses"]
  API --> Cache["Process cache and shared pending request"]
  Cache --> Discovery["Kubernetes discovery"]
  Discovery --> Kube["Kubernetes API: routes and dependencies"]
  Discovery --> Health["Optional workload health and pod metrics"]
  Health --> Kube
  Cache --> Policy["Filter snapshot by authenticated namespace policy"]
  Policy --> UI
  Browser <--> Prefs["Browser localStorage: preferences"]
```

Discovery reads Ingress, HTTPRoute, TLSRoute, Gateway, and BackendTLSPolicy resources. It resolves route hosts, listeners, transport metadata, backends, annotations, and tool URLs into a common app representation.

When health is enabled, discovery also reads Services, EndpointSlices, Pods, Events, and workload controllers. Service selectors and endpoint pod references connect routes to pods; owner references connect pods to workload rollouts. Metrics require both health and metrics to be enabled.

The server namespace list limits Kubernetes requests and Helm RBAC. The label selector applies to discovered routes, so their dependent resources remain available for resolution. An empty namespace list enables cluster-wide discovery.

## Refresh and failure handling

```mermaid
sequenceDiagram
  participant UI as Browser dashboard
  participant API as Discovery API
  participant Cache as Process cache
  participant K8s as Kubernetes API
  UI->>API: Initial load, visible-tab poll, or Refresh
  API->>API: Resolve namespace access policy
  alt Fresh cache exists
    API->>Cache: Read snapshot
    Cache-->>API: Cached discovery data
  else Cache expired or absent
    API->>K8s: Discover resources (coalesce concurrent calls)
    K8s-->>API: Resources or errors
    API->>Cache: Store successful discovery snapshot
  end
  alt Snapshot available
    API->>API: Filter for this user's permitted namespaces
    API-->>UI: JSON with private, no-store header
    UI->>UI: Replace displayed snapshot
  else Discovery failed
    API-->>UI: HTTP 503
    UI->>UI: Show error and retain previous snapshot if available
  end
```

Defaults are a 30-second browser refresh interval, a 15-second server cache, and a 10-second timeout per Kubernetes HTTP request. Manual Refresh uses the same cache. Each replica has its own cache; there is no distributed cache or background Kubernetes watch.

Optional APIs that are absent are skipped. Other discovery errors can produce warnings and partial results; total failure returns an error. The browser's retained snapshot is the fallback after a failed refresh, not a server-side stale-cache response.

## Optional OIDC access path

```mermaid
flowchart LR
  User["Browser"] --> Exposure["Ingress or Gateway"]
  Exposure --> Service["Homepage Service"]
  Service --> Proxy["oauth2-proxy sidecar: port 4180"]
  Proxy <--> IdP["Configured OIDC provider"]
  Proxy --> App["Next.js: loopback port 3000"]
  App --> Groups["Group-to-namespace response policy"]
  App --> Kube["Kubernetes API using ServiceAccount"]
```

In Helm authentication mode, the Service points to the proxy and Next.js listens on loopback. The proxy supplies trusted user/group headers. The chart requires a NetworkPolicy with allowed ingress peers for this mode; configure those peers and trusted proxy CIDRs for the deployment.

An optional group policy grants the union of namespaces mapped to the user's groups. A user with no mapped namespaces receives HTTP 403. Every discovery response is filtered, including cache hits; health for backends outside permitted namespaces is withheld. The dashboard still reads Kubernetes using its own ServiceAccount, not user impersonation.

UI filters and `homepage.dev/hidden` affect presentation. Use server scope, RBAC, and the authenticated policy to restrict discovery access. Without a group policy, discovered results are not filtered per user.

## API surface

| Endpoint | Purpose |
| --- | --- |
| `/` | Server-rendered page and interactive app directory |
| `/api/config` | Resolved configured quick links |
| `/api/k8s/ingresses` | Discovered Ingress, HTTPRoute, and TLSRoute apps, diagnostics, and optional health |
| `/api/health/live` | Application liveness |
| `/api/health/ready` | Application readiness, independent of Kubernetes availability |

The discovery endpoint keeps its original `ingresses` name for all supported route kinds. Health probes describe the dashboard process, so a Kubernetes API outage does not make them fail.

## Source map

| Location | Responsibility |
| --- | --- |
| `app/page.tsx` | Page composition and configured quick links |
| `components/K8sLinksSection.tsx` | App directory, preferences, refresh, filters, and details |
| `components/AppIcon.tsx` | Supported app icons |
| `app/api/k8s/ingresses/route.ts` | Access policy, request coalescing, caching, and discovery responses |
| `lib/config.ts` | Quick-link parsing and validation |
| `lib/discovery-config.ts` | Discovery settings and defaults |
| `lib/kubernetes-discovery.ts` | Kubernetes clients, resource reads, and snapshot assembly |
| `lib/kubernetes-routes.ts` | Route extraction, listener matching, TLS evidence, and annotations |
| `lib/workload-health.ts` | Service-to-pod joins, rollout health, and metrics |
| `lib/namespace-access.ts` | Group policy validation and response filtering |
| `helm/homepage/` | Chart, scoped RBAC, optional OIDC, and deployment controls |
