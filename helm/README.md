# Helm Chart for Homepage

This Helm chart deploys the Developer Homepage application to a Kubernetes cluster.

## Installation

### Prerequisites

- Kubernetes 1.19+
- Helm 3.0+
- kubectl configured to access your cluster

### Quick Start

```bash
# Add the repo (if hosted remotely)
helm repo add homepage https://your-chart-repo-url

# Install with default values
helm install my-homepage ./homepage

# Or install from values file
helm install my-homepage ./homepage -f my-values.yaml

# Install in a specific namespace
helm install my-homepage ./homepage --create-namespace --namespace homepage
```

### Upgrading

```bash
# Upgrade the release
helm upgrade my-homepage ./homepage

# Upgrade with new values
helm upgrade my-homepage ./homepage -f my-new-values.yaml

# Upgrade with specific values
helm upgrade my-homepage ./homepage --set links.name="My Dashboard" --set image.tag="v1.2.0"
```

### Uninstalling

```bash
helm uninstall my-homepage
```

## Configuration

### Quick Links

Configure your links via the `values.yaml` file:

```yaml
links:
  name: "My Developer Homepage"
  items:
    - title: "GitHub"
      url: "https://github.com"
      description: "Code repository and version control"
      icon: "github"
    - title: "My Project"
      url: "https://myproject.com"
      description: "My main project"
      icon: "project"
```

### Image Configuration

```yaml
image:
  repository: your-registry/homepage
  pullPolicy: IfNotPresent
  tag: "latest"
```

### Ingress

Enable and configure ingress:

```yaml
ingress:
  enabled: true
  className: "nginx"
  hosts:
    - host: homepage.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: homepage-tls
      hosts:
        - homepage.example.com
```

### Resources

Adjust resource limits:

```yaml
resources:
  limits:
    cpu: 500m
    memory: 512Mi
  requests:
    cpu: 100m
    memory: 128Mi
```

### Kubernetes Ingress Discovery

Enable or disable automatic K8s ingress discovery:

```yaml
k8s:
  enabled: true  # Set to false to disable K8s ingress discovery
```

## Values Reference

| Parameter | Description | Default |
|-----------|-------------|---------|
| `replicaCount` | Number of replicas | `1` |
| `image.repository` | Image repository | `your-registry/homepage` |
| `image.pullPolicy` | Image pull policy | `IfNotPresent` |
| `image.tag` | Image tag | `latest` |
| `links.name` | Homepage title | `Developer Homepage` |
| `links.items` | Array of link configurations | See values.yaml |
| `serviceAccount.create` | Create service account | `true` |
| `rbac.create` | Create RBAC resources | `true` |
| `service.type` | Service type | `ClusterIP` |
| `service.port` | Service port | `80` |
| `ingress.enabled` | Enable ingress | `false` |
| `ingress.className` | Ingress class name | `nginx` |
| `ingress.hosts` | Ingress host configurations | See values.yaml |
| `k8s.enabled` | Enable K8s ingress discovery | `true` |
| `resources.limits` | Resource limits | See values.yaml |
| `resources.requests` | Resource requests | See values.yaml |

## Examples

### Basic Installation

```bash
helm install homepage ./homepage
```

### With Custom Domain

```bash
helm install homepage ./homepage \
  --set ingress.enabled=true \
  --set ingress.hosts[0].host=homepage.mycompany.com
```

### With Custom Links

```bash
helm install homepage ./homepage \
  --set-string 'links.items[0].title=Internal Wiki' \
  --set-string 'links.items[0].url=https://wiki.mycompany.com' \
  --set-string 'links.items[0].description=Company knowledge base'
```

### Production Deployment

```bash
# Create production values file
cat > prod-values.yaml <<EOF
replicaCount: 3
image:
  repository: myregistry/homepage
  tag: v1.0.0
resources:
  limits:
    cpu: 1000m
    memory: 1Gi
  requests:
    cpu: 500m
    memory: 512Mi
ingress:
  enabled: true
  hosts:
    - host: homepage.mycompany.com
autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 10
EOF

# Install with production values
helm install homepage ./homepage -f prod-values.yaml
```

## Troubleshooting

### Check Pod Status

```bash
kubectl get pods -l app.kubernetes.io/name=homepage
```

### View Logs

```bash
kubectl logs -l app.kubernetes.io/name=homepage
```

### Check Service

```bash
kubectl get svc -l app.kubernetes.io/name=homepage
```

### Port Forward for Testing

```bash
kubectl port-forward svc/homepage 8080:80
# Then visit http://localhost:8080
```

### Debug Helm Installation

```bash
# Dry run to see what will be deployed
helm install homepage ./homepage --dry-run --debug

# Check current values
helm get values homepage
```

## Support

For issues and feature requests, please open an issue on the project repository.

