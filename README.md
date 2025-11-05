# Developer Homepage

A beautiful, configurable homepage for developers to organize and quickly access their deployments and resources.

## Features

- 🎨 Modern, clean UI with dark mode support
- ⚙️ Easy configuration via JSON file
- 🔗 Organized link cards with descriptions
- ☸️ Automatic Kubernetes route discovery (Ingress & Gateway API)
- 📱 Fully responsive design
- ⚡ Built with Next.js 16 and Tailwind CSS

## Getting Started

### Installation

```bash
npm install
# or
yarn install
# or
pnpm install
```

### Running the Development Server

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Building for Production

```bash
npm run build
npm start
```

## Configuration

Customize your links by editing `links.config.json`:

```json
{
  "name": "Developer Homepage",
  "links": [
    {
      "title": "Your Link Title",
      "url": "https://example.com",
      "description": "Brief description",
      "icon": "optional-icon-name"
    }
  ]
}
```

### Example Links

The config comes pre-populated with common developer services:
- GitHub
- Vercel
- AWS Console
- Netlify
- DigitalOcean
- Railway

Simply modify, add, or remove links to match your needs!

## Kubernetes Integration

**Note**: K8s integration is partially implemented. The homepage automatically detects if it's running inside a Kubernetes cluster. The Ingress discovery functionality is still being developed.

### Current Status

1. **Cluster Detection**: ✅ Working - App detects if running in K8s cluster
2. **Ingress Discovery**: 🔄 In Progress - API configured but needs proper K8s client implementation
3. **Auto-Display**: ⏳ Pending - Will show discovered routes as clickable link cards
4. **Fallback**: ✅ Working - Shows friendly "Not in cluster" message when not in K8s

### Running in Kubernetes

To deploy this in a Kubernetes cluster, simply create a Deployment and Service:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: homepage
spec:
  replicas: 1
  selector:
    matchLabels:
      app: homepage
  template:
    metadata:
      labels:
        app: homepage
    spec:
      serviceAccountName: homepage
      containers:
      - name: homepage
        image: your-registry/homepage:latest
        ports:
        - containerPort: 3000
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: homepage
  namespace: default
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: homepage-routes-reader
rules:
- apiGroups: ["networking.k8s.io"]
  resources: ["ingresses"]
  verbs: ["list", "get"]
- apiGroups: ["gateway.networking.k8s.io"]
  resources: ["httproutes", "gateways"]
  verbs: ["list", "get"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: homepage-routes-reader
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: homepage-routes-reader
subjects:
- kind: ServiceAccount
  name: homepage
  namespace: default
```

## Project Structure

```
homepage/
├── app/
│   ├── api/
│   │   └── k8s/
│   │       └── ingresses/
│   │           └── route.ts  # K8s Ingress & Gateway API endpoint
│   ├── page.tsx          # Main homepage
│   ├── layout.tsx        # Root layout
│   └── globals.css       # Global styles
├── components/
│   ├── LinkCard.tsx           # Reusable link card component
│   └── K8sLinksSection.tsx    # K8s Routes display component (Ingress & Gateway API)
├── helm/
│   └── homepage/         # Helm chart
│       ├── Chart.yaml
│       ├── values.yaml   # Configure Quick Links here
│       └── templates/
│           ├── _helpers.tpl
│           ├── deployment.yaml
│           ├── service.yaml
│           ├── ingress.yaml
│           ├── serviceaccount.yaml
│           ├── rbac.yaml
│           └── NOTES.txt
├── k8s/                  # Legacy K8s manifests
├── links.config.json     # Configuration file (fallback)
└── package.json
```

## Deploy

### Helm Chart (Recommended for Kubernetes)

Deploy to Kubernetes using the included Helm chart:

```bash
# Install with default values
helm install my-homepage ./helm/homepage

# Install with custom values
helm install my-homepage ./helm/homepage -f my-values.yaml

# Install in a specific namespace
helm install my-homepage ./helm/homepage --create-namespace --namespace homepage
```

See [helm/README.md](./helm/README.md) for detailed Helm deployment instructions.

### Other Platforms

Deploy this homepage to any platform that supports Next.js:

- **Vercel** (recommended): Simply push to GitHub and import
- **Netlify**: Connect your repository
- **Railway**: Deploy from GitHub
- **AWS**: Use Amplify or deploy manually

### Docker

```bash
# Build the image
docker build -t homepage:latest .

# Run locally
docker run -p 3000:3000 homepage:latest
```

## Technologies

- [Next.js 16](https://nextjs.org) - React framework
- [Tailwind CSS](https://tailwindcss.com) - Utility-first CSS
- [Lucide React](https://lucide.dev) - Icon library
- [TypeScript](https://www.typescriptlang.org) - Type safety
- [Kubernetes Client](https://github.com/kubernetes-client/javascript) - K8s API integration

## License

MIT
