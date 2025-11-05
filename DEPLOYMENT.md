# Kubernetes Deployment Guide

This guide will help you deploy the Developer Homepage to a Kubernetes cluster.

## Prerequisites

- A running Kubernetes cluster
- `kubectl` configured to access your cluster
- Docker registry access (optional, if building images)

## Deployment Steps

### 1. Create Docker Image

First, build and push your Docker image:

```bash
# Build the image
docker build -t your-registry/homepage:latest .

# Push to registry
docker push your-registry/homepage:latest
```

### 2. Apply Kubernetes Manifests

Deploy all required resources:

```bash
kubectl apply -f k8s/
```

Or apply individually:

```bash
# ServiceAccount
kubectl apply -f k8s/service-account.yaml

# RBAC (ClusterRole and ClusterRoleBinding)
kubectl apply -f k8s/rbac.yaml

# Deployment
kubectl apply -f k8s/deployment.yaml

# Service
kubectl apply -f k8s/service.yaml

# Ingress (optional, to expose the homepage itself)
kubectl apply -f k8s/ingress.yaml
```

### 3. Verify Deployment

Check that everything is running:

```bash
# Check pods
kubectl get pods -l app=homepage

# Check service
kubectl get svc homepage

# Check logs
kubectl logs -l app=homepage

# Describe pod for any issues
kubectl describe pod -l app=homepage
```

### 4. Access the Homepage

If you created an Ingress:

```bash
kubectl get ingress homepage
```

Or port-forward to access locally:

```bash
kubectl port-forward svc/homepage 3000:3000
```

Then open http://localhost:3000

## Permissions Required

The homepage needs read-only access to Ingress resources across all namespaces. This is configured via the RBAC manifests:

- **ClusterRole**: Grants `list` and `get` permissions on `ingresses` resources in `networking.k8s.io` API group
- **ClusterRoleBinding**: Binds the ServiceAccount to the ClusterRole

## Security Considerations

- The ServiceAccount has **read-only** access to Ingress resources
- No write permissions are granted
- Access is scoped to only Ingress resources
- Consider using RBAC to further restrict access if needed for your security requirements

## Troubleshooting

### Homepage shows "Not in cluster"

1. Verify the ServiceAccount exists:
   ```bash
   kubectl get serviceaccount homepage
   ```

2. Check RBAC is properly configured:
   ```bash
   kubectl describe clusterrole homepage-ingress-reader
   kubectl describe clusterrolebinding homepage-ingress-reader
   ```

3. Test permissions manually:
   ```bash
   kubectl auth can-i list ingresses --as=system:serviceaccount:default:homepage
   ```

### No ingresses showing up

1. Verify ingresses exist in your cluster:
   ```bash
   kubectl get ingress --all-namespaces
   ```

2. Check the homepage has proper namespace permissions

3. Review pod logs for errors:
   ```bash
   kubectl logs -l app=homepage --tail=100
   ```

### Build/Pull Image Errors

If using a private registry:

1. Create an image pull secret:
   ```bash
   kubectl create secret docker-registry regcred \
     --docker-server=your-registry \
     --docker-username=your-username \
     --docker-password=your-password \
     --docker-email=your-email
   ```

2. Add to deployment spec:
   ```yaml
   spec:
     imagePullSecrets:
     - name: regcred
   ```

## Scaling

To scale the deployment:

```bash
kubectl scale deployment homepage --replicas=3
```

## Updating

To update the deployment with a new image:

```bash
# Update image in deployment
kubectl set image deployment/homepage homepage=your-registry/homepage:v1.0.1

# Or edit deployment directly
kubectl edit deployment homepage

# Check rollout status
kubectl rollout status deployment/homepage
```

## Cleanup

To remove all resources:

```bash
# Remove everything
kubectl delete -f k8s/

# Or individually
kubectl delete deployment homepage
kubectl delete service homepage
kubectl delete ingress homepage
kubectl delete serviceaccount homepage
kubectl delete clusterrolebinding homepage-ingress-reader
kubectl delete clusterrole homepage-ingress-reader
```

