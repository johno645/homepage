# Quick Start - Helm Deployment

## Prerequisites

- Kubernetes cluster (1.19+)
- Helm 3.0+ installed
- kubectl configured

## Quick Installation

```bash
# Navigate to the helm chart directory
cd helm/homepage

# Install with default configuration
helm install my-homepage .

# Check the deployment
kubectl get pods -l app.kubernetes.io/name=homepage

# Forward port to access
kubectl port-forward svc/my-homepage 8080:80
# Open http://localhost:8080
```

## Customize Your Links

### Option 1: Edit values.yaml

Edit `values.yaml`:

```yaml
links:
  name: "My Dashboard"
  items:
    - title: "Internal Wiki"
      url: "https://wiki.mycompany.com"
      description: "Company knowledge base"
      icon: "wiki"
    - title: "Monitoring"
      url: "https://monitoring.mycompany.com"
      description: "System monitoring"
      icon: "monitoring"
```

Then install:
```bash
helm install my-homepage .
```

### Option 2: Override with --set

```bash
helm install my-homepage . \
  --set links.name="My Dashboard" \
  --set links.items[0].title="Internal Wiki" \
  --set links.items[0].url="https://wiki.mycompany.com"
```

### Option 3: Use a custom values file

Create `my-values.yaml`:

```yaml
links:
  name: "My Company Homepage"
  items:
    - title: "GitHub"
      url: "https://github.com/mycompany"
      description: "Our GitHub"
      icon: "github"
```

Install:
```bash
helm install my-homepage . -f my-values.yaml
```

## Production Deployment

```bash
# Create namespace
kubectl create namespace homepage

# Install with production values
helm install homepage . \
  --namespace homepage \
  --set replicaCount=3 \
  --set ingress.enabled=true \
  --set ingress.hosts[0].host=homepage.mycompany.com \
  --set autoscaling.enabled=true
```

## Upgrade

```bash
# Upgrade with new values
helm upgrade my-homepage . --set links.name="New Name"

# Upgrade from values file
helm upgrade my-homepage . -f my-new-values.yaml
```

## Uninstall

```bash
helm uninstall my-homepage
```

## Next Steps

- See [README.md](./README.md) for full documentation
- Configure ingress for external access
- Set up monitoring and logging
- Enable autoscaling for production

