# Quick Start Guide

## 🚀 Get Running in 60 Seconds

1. **Install dependencies** (if not already done):
   ```bash
   npm install
   ```

2. **Start the development server**:
   ```bash
   npm run dev
   ```

3. **Open your browser**:
   Navigate to [http://localhost:3000](http://localhost:3000)

## 📝 Customize Your Links

Edit `links.config.json` to add, remove, or modify your links:

```json
{
  "name": "My Homepage",
  "links": [
    {
      "title": "My Project",
      "url": "https://myproject.com",
      "description": "The best project ever",
      "icon": "project"
    }
  ]
}
```

That's it! The page will automatically refresh with your changes.

## 🎨 Customization Tips

- Change the title by editing the `name` field in `links.config.json`
- Add as many links as you want
- Each link can have a title, URL, description, and optional icon
- The layout automatically adjusts to the number of links
- Dark mode is automatic based on your system preferences

## ☸️ Kubernetes Deployment

Deploy to your K8s cluster to automatically discover all Ingress routes:

```bash
# Build and push Docker image
docker build -t your-registry/homepage:latest .
docker push your-registry/homepage:latest

# Deploy to cluster
kubectl apply -f k8s/

# Access your homepage
kubectl port-forward svc/homepage 3000:80
```

See `DEPLOYMENT.md` for detailed instructions!

## 📦 Other Deploy Options

Ready to go live? Deploy to Vercel with one click:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/homepage)

Or deploy to any platform that supports Next.js!

