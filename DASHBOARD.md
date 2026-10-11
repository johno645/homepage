# Kubernetes developer dashboard

For a summary of the application and diagrams, see the [application documentation](./docs/README.md).

The dashboard discovers Ingress, HTTPRoute, and TLSRoute resources and connects them to backend health. Search by name, hostname, namespace, team, environment, or tag. Use `/` to focus search, select cards or a table, and open Details for transport evidence, workload versions, warnings, developer tools, and a copyable inspection command.

Favorites, recently viewed apps, theme, namespace, environment, and layout are stored in this browser. They are not synchronized between users or devices. Polling runs while the tab is visible; Refresh uses the same shared server cache. Failed refreshes preserve the last successful browser snapshot.

## Discovery and health

Example Helm values:

```yaml
k8s:
  enabled: true
  clusterName: development-eu
  environment: development
  namespaces: [apps, infra]
  labelSelector: dashboard=true
  refreshSeconds: 30
  cacheSeconds: 15
  timeoutSeconds: 10
  health:
    enabled: true
  metrics:
    enabled: true
```

An empty namespace list allows discovery across the cluster and creates a ClusterRole. A namespace list creates a Role and RoleBinding in each listed namespace and restricts server requests to those namespaces. Include namespaces containing referenced Gateways, backend Services, and BackendTLSPolicies. Namespace filters in the UI only change the displayed results; use the server namespace list or authenticated access policy to restrict access.

The label selector applies to Ingress, HTTPRoute, and TLSRoute discovery, not their dependent resources. Optional APIs that are not installed are skipped. Permission and connectivity errors produce warnings. Health and metrics are disabled by default; enabling health adds read access to Services, Pods, Events, EndpointSlices, Deployments, ReplicaSets, StatefulSets, and DaemonSets. Metrics additionally require the Metrics API and read access to its pods. No Secrets or write permissions are requested.

Workload health uses Service selectors and EndpointSlice pod references, pod readiness, container restarts, owner chains, and replica rollout counts. A healthy workload does not establish that its public endpoint is reachable. Container restart counts are cumulative. Warning events can persist after recovery. Selectorless Services and dependencies outside discovery scope can have unknown health. CPU and memory are current pod measurements, not historical charts.

Environment variables for non-Helm deployments:

| Variable | Default | Purpose |
| --- | --- | --- |
| `HOMEPAGE_K8S_ENABLED` | `true` | Disable discovery with `false` |
| `HOMEPAGE_CLUSTER_NAME` | `Kubernetes` | Displayed cluster name |
| `HOMEPAGE_ENVIRONMENT` | empty | Default app environment |
| `HOMEPAGE_NAMESPACES` | empty | Comma-separated server scope |
| `HOMEPAGE_LABEL_SELECTOR` | empty | Kubernetes route label selector |
| `HOMEPAGE_REFRESH_SECONDS` | `30` | Browser polling interval, 10–3600 seconds |
| `HOMEPAGE_CACHE_SECONDS` | `15` | Cache lifetime per server replica, 0–300 seconds |
| `HOMEPAGE_TIMEOUT_SECONDS` | `10` | Timeout per Kubernetes HTTP request, 1–60 seconds |
| `HOMEPAGE_HEALTH_ENABLED` | `false` | Read workload health |
| `HOMEPAGE_METRICS_ENABLED` | `false` | Read current pod metrics when health is enabled |
| `HOMEPAGE_TOOL_TEMPLATES` | `{}` | JSON map of developer-tool URL templates |

Development uses local kubeconfig when in-cluster environment variables are absent. Production uses in-cluster credentials. `/api/health/live` and `/api/health/ready` check the dashboard application independently of Kubernetes availability so cluster outages do not remove access to diagnostics.

## App annotations

Set metadata on the Ingress or route:

```yaml
metadata:
  labels:
    dashboard: "true"
  annotations:
    homepage.dev/title: "Orders API"
    homepage.dev/icon: "server"
    homepage.dev/description: "Commerce service"
    homepage.dev/team: "Commerce"
    homepage.dev/environment: "development"
    homepage.dev/tags: "internal, critical"
    homepage.dev/repository: "https://github.com/example/orders"
    homepage.dev/runbook: "https://wiki.example.com/runbooks/orders"
    homepage.dev/ci: "https://ci.example.com/orders"
    homepage.dev/gitops: "https://gitops.example.com/applications/orders"
    homepage.dev/metrics: "https://metrics.example.com/d/orders"
    homepage.dev/logs: "https://logs.example.com/orders"
    homepage.dev/traces: "https://traces.example.com/orders"
```

Icon names include `server`, `k8s`, `github`, `globe`, `aws`, `vercel`, `netlify`, `digitalocean`, and `railway`; unknown icons use the external-link symbol.

`homepage.dev/hidden: "true"` hides a resource from the app directory. It is a presentation option, not an authorization boundary. `homepage.dev/url` provides an explicit HTTP(S) browser URL, useful for wildcard hosts, matching rules that cannot be represented as a link, or a TLSRoute carrying HTTPS. Tool URLs and configured quick links must use HTTP(S) and cannot embed credentials.

For shared tool URL patterns:

```yaml
toolTemplates:
  gitops: "https://gitops.example.com/applications/{namespace}-{name}"
  metrics: "https://metrics.example.com/d/apps?var-namespace={namespace}&var-app={name}"
  logs: "https://logs.example.com/apps/{namespace}/{name}"
```

Supported placeholders are `{name}`, `{namespace}`, `{cluster}`, and `{environment}`. Substituted values are URL encoded. Resource annotations override the corresponding shared template.

## TLS and route tags

Transport tags show declared configuration and the evidence used to derive it. They do not claim a successful handshake or controller support.

| Tag | Evidence |
| --- | --- |
| HTTP/HTTPS frontend | Matching Ingress TLS host or Gateway listener protocol |
| TLS frontend | Gateway TLS listener; application protocol is not assumed |
| TLS termination | Matching Ingress TLS configuration or a terminating Gateway listener |
| TLS passthrough | NGINX `ssl-passthrough: "true"`, or a TLSRoute attached to a Passthrough listener |
| HTTPS/GRPCS backend | NGINX `backend-protocol`, or ALB `backend-protocol` annotation |
| HTTPS/TLS backend configured | A BackendTLSPolicy target matches the backend Service |
| TLS re-encryption | Termination plus an explicitly configured encrypted upstream |
| Backend TLS unknown | No supported transport evidence is available |

NGINX passthrough also requires the controller to enable the feature. Controller-specific defaults and unrecognized annotations remain unknown. Service-wide BackendTLSPolicy targets are supported; port-name targets only match when the backend reference uses that same name, so numeric references to port-specific policies can remain unknown. Policy status and TLS handshakes are not probed.

Gateway discovery respects parent namespace, listener section/port, and hostname intersection. Missing listeners and incompatible hostnames remain visible without invented clickable endpoints. Rejected routes display controller condition reasons. Regex, header, query, and non-GET match rules are not automatically treated as browser links. TLSRoute may carry a non-HTTP protocol and requires an explicit URL annotation to offer an Open link.

References: [Gateway TLS configuration](https://gateway-api.sigs.k8s.io/guides/user-guides/tls/), [BackendTLSPolicy](https://gateway-api.sigs.k8s.io/reference/api-types/policy/backendtlspolicy/), and [NGINX annotations](https://kubernetes.github.io/ingress-nginx/user-guide/nginx-configuration/annotations/).

## Optional OIDC authentication

The chart can add an OAuth2 Proxy sidecar. Create an OIDC client at your identity provider and a Kubernetes Secret containing `client-id`, `client-secret`, and `cookie-secret`. The cookie secret should encode 32 random bytes; manage these credentials outside Git.

```yaml
auth:
  enabled: true
  issuerUrl: "https://identity.example.com"
  redirectUrl: "https://dashboard.example.com/oauth2/callback"
  existingSecret: dashboard-oidc
  emailDomains: [example.com]
  allowedGroups: [developers]
  trustedProxyCIDRs: [10.0.0.0/24] # Replace with actual trusted ingress proxy ranges.
  groupNamespaces:
    commerce: [commerce-dev, commerce-test]
    platform: [infra, commerce-dev, commerce-test]
networkPolicy:
  enabled: true
  ingressFrom:
    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: ingress-system
```

Use an HTTPS Ingress or Gateway endpoint. Authentication requires an issuer URL, callback URL, existing Secret, allowed email domains, trusted proxy ranges, and an ingress NetworkPolicy. The app binds to localhost in the pod; the Service exposes the authenticated proxy port. Application probes run against localhost from the app container. Do not expose an additional unauthenticated application port or reuse these trusted-header settings without an equivalent isolation boundary. The configured CNI must enforce NetworkPolicy.

`groupNamespaces` optionally authorizes route results by the authenticated `X-Forwarded-Groups` header written by OAuth2 Proxy. Groups receive the union of their mapped namespaces, limited by the discovery scope. Unmapped users receive HTTP 403. Filtering happens on every API response, including cached responses; health for cross-scope backends is withheld. Empty mappings give admitted users the full server discovery scope. Provider group claims must be configured and verified with a real login before deploying access rules. This model does not impersonate users against the Kubernetes API.

Direct deployments use `HOMEPAGE_AUTH_PROXY=true` and `HOMEPAGE_GROUP_NAMESPACES` containing a JSON group-to-namespace map, and must enforce the same trusted proxy isolation. Malformed policies fail closed.

See [OAuth2 Proxy configuration](https://oauth2-proxy.github.io/oauth2-proxy/configuration/overview/) for provider claims, cookie secrets, and forwarded-header configuration.

## Deployment and validation

The chart supports an Ingress or `httpRoute`, CPU autoscaling, a PodDisruptionBudget, and an ingress NetworkPolicy. Configure Gateway parent references before enabling `httpRoute`. Set autoscaling minimum replicas and disruption budgets together so voluntary maintenance can proceed.

```bash
npm test
npm run test:integration
npx playwright install chromium
npm run test:browser
npm run lint
npm run build
helm lint ./helm/homepage
helm template homepage ./helm/homepage -f helm/homepage/ci/full-values.yaml
npm run dev:mock
```

The mock preview runs at `http://127.0.0.1:3100` with a local fixture Kubernetes API. It uses a generated kubeconfig for that fixture, not the real cluster. Integration tests use the real SDK against this local API to cover scoping, optional API versions, and partial permission failures. Browser tests run isolated desktop and mobile Chromium sessions against the fixture dashboard and cover transport details, keyboard search, favorites, layout persistence, refresh failures, themes, and viewport overflow.

CI validates tests, lint, production build, the container, and Helm. It scans the production image for fixable HIGH/CRITICAL vulnerabilities. Publication downloads that validated image and publishes a `sha-<commit>` tag plus a branch/version alias; releases additionally update `prod`. Pull requests do not publish images or assume AWS credentials. The SHA tag remains reproducible as a reference only if the registry prevents overwriting it; use image digests for enforced immutability.

## Follow-up integrations

The repo provides configurable links for source, CI, GitOps, monitoring, logs, traces, and runbooks. Live deployment history, historical monitoring charts, endpoint/TLS probes, identity-provider validation, preference synchronization, and tests in a real disposable Kubernetes cluster still need their respective services and environments. List/watch caching can replace polling if measured cluster scale warrants it; the current cache is local to each app replica.
