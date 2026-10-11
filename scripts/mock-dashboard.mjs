import { spawn } from 'node:child_process';
import { mockCluster } from '../tests/integration/mock-cluster.mjs';

const mock = await mockCluster();
const app = spawn('npm', ['run', 'dev', '--', '--hostname', '127.0.0.1', '--port', process.env.DASHBOARD_PORT || '3100'], {
  stdio: 'inherit',
  env: { ...process.env, KUBECONFIG: mock.kubeconfig, HOMEPAGE_K8S_ENABLED: 'true', HOMEPAGE_CLUSTER_NAME: 'Local fixture cluster', HOMEPAGE_NAMESPACES: 'apps,infra', HOMEPAGE_LABEL_SELECTOR: 'dashboard=true', HOMEPAGE_HEALTH_ENABLED: 'true', HOMEPAGE_METRICS_ENABLED: 'true', HOMEPAGE_AUTH_PROXY: 'false', HOMEPAGE_GROUP_NAMESPACES: '{}' },
});
function stop() { app.kill('SIGTERM'); mock.server.close(); }
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
app.on('exit', () => mock.server.close());
