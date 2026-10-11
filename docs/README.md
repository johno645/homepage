# Application documentation

This directory describes the dashboard as it is currently implemented. Diagrams use Mermaid and render directly on GitHub.

| Document | Covers |
| --- | --- |
| [Application overview](./overview.md) | Features, main screens, technology, and current limitations |
| [Architecture](./architecture.md) | Data flow, API refresh, optional authentication, and source layout |
| [Route transport](./route-transport.md) | TLS termination, HTTPS backends, passthrough, and tag evidence |
| [Development and delivery](./development.md) | Local preview, checks, packaging, and deployment options |

## Configuration and deployment references

- [Dashboard configuration](../DASHBOARD.md): environment variables, annotations, health, developer tools, and OIDC settings.
- [Helm guide](../helm/README.md): chart configuration and installation.
- [Deployment guide](../DEPLOYMENT.md): deployment instructions.
- [Repository README](../README.md): project entry point.

Update these summaries when behavior changes. Keep detailed configuration examples in the configuration guides and link to them from here.
