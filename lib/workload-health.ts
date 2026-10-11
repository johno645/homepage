import { array, metadata, record, str, type IngressLink, type WorkloadHealth } from './kubernetes-routes.ts';

function cpu(value: unknown): number {
  const text = str(value);
  if (text.endsWith('n')) return parseFloat(text) / 1e6;
  if (text.endsWith('u')) return parseFloat(text) / 1e3;
  if (text.endsWith('m')) return parseFloat(text);
  return parseFloat(text) * 1000;
}
function memory(value: unknown): number {
  const text = str(value);
  const match = text.match(/^([\d.]+)([KMGTE]i?|m)?$/);
  if (!match) return 0;
  const factors: Record<string, number> = { Ki: 1024, Mi: 1024 ** 2, Gi: 1024 ** 3, Ti: 1024 ** 4, K: 1000, M: 1e6, G: 1e9, T: 1e12, m: .001 };
  return Number(match[1]) * (factors[match[2]] ?? 1) / 1024 ** 2;
}

export function attachHealth(links: IngressLink[], services: unknown[], pods: unknown[], slices: unknown[], events: unknown[], metrics: unknown[] = [], workloads: unknown[] = []): void {
  for (const link of links) {
    const matchedPods = new Map<string, ReturnType<typeof record>>();
    const warnings: string[] = [];
    let unknown = false;
    for (const backend of link.backends) {
      if (backend.kind !== 'Service') { unknown = true; continue; }
      const service = services.map(record).find(s => metadata(s).name === backend.name && metadata(s).namespace === backend.namespace);
      if (!service) { warnings.push(`Service unavailable: ${backend.namespace}/${backend.name}`); unknown = true; continue; }
      const selector = record(record(service.spec).selector);
      const endpoints = slices.map(record).filter(s => metadata(s).namespace === backend.namespace && record(record(s.metadata).labels)['kubernetes.io/service-name'] === backend.name).flatMap(s => array(s.endpoints));
      if (!endpoints.length) warnings.push(`No endpoints reported for ${backend.name}`);
      else if (!endpoints.some(e => record(e.conditions).ready !== false)) warnings.push(`No ready endpoints for ${backend.name}`);
      if (!Object.keys(selector).length) unknown = true;
      for (const pod of pods.map(record)) {
        if (metadata(pod).namespace !== backend.namespace) continue;
        const labels = record(record(pod.metadata).labels);
        const selected = Object.keys(selector).length && Object.entries(selector).every(([k, v]) => labels[k] === v);
        const referenced = endpoints.some(e => record(e.targetRef).kind === 'Pod' && record(e.targetRef).name === metadata(pod).name);
        if (selected || referenced) matchedPods.set(`${metadata(pod).namespace}/${metadata(pod).name}`, pod);
      }
    }
    const health: WorkloadHealth = { state: 'unknown', ready: 0, total: matchedPods.size, restarts: 0, workloads: [], rollouts: [], images: [], warnings };
    let hasMetrics = false;
    for (const [key, pod] of matchedPods) {
      const status = record(pod.status);
      if (array(status.conditions).some(c => c.type === 'Ready' && c.status === 'True')) health.ready++;
      health.restarts += array(status.containerStatuses).reduce((sum, c) => sum + Number(c.restartCount ?? 0), 0);
      health.images.push(...array(record(pod.spec).containers).map(c => str(c.image)).filter(Boolean));
      for (const ref of array(record(pod.metadata).ownerReferences)) {
        let owner = workloads.map(record).find(w => w.kind === ref.kind && metadata(w).name === ref.name && metadata(w).namespace === metadata(pod).namespace);
        if (owner?.kind === 'ReplicaSet') {
          const parent = array(record(owner.metadata).ownerReferences).find(o => o.kind === 'Deployment');
          if (parent) owner = workloads.map(record).find(w => w.kind === 'Deployment' && metadata(w).name === parent.name && metadata(w).namespace === metadata(pod).namespace) ?? owner;
        }
        health.workloads.push(owner ? `${owner.kind}/${metadata(owner).name}` : `${str(ref.kind)}/${str(ref.name)}`);
        if (owner && ['Deployment', 'StatefulSet', 'DaemonSet'].includes(str(owner.kind)) && !health.rollouts.some(r => r.name === metadata(owner).name && r.kind === owner.kind)) {
          const ownerSpec = record(owner.spec);
          const ownerStatus = record(owner.status);
          const desired = Number(owner.kind === 'DaemonSet' ? ownerStatus.desiredNumberScheduled ?? 0 : ownerSpec.replicas ?? 1);
          const ready = Number(ownerStatus.readyReplicas ?? ownerStatus.numberReady ?? 0);
          const updated = Number(ownerStatus.updatedReplicas ?? ownerStatus.updatedNumberScheduled ?? 0);
          health.rollouts.push({ name: metadata(owner).name, kind: str(owner.kind), ready, desired, updated });
          if (ready < desired || updated < desired) warnings.push(`${owner.kind}/${metadata(owner).name}: ${ready}/${desired} ready, ${updated} updated`);
          for (const c of array(ownerStatus.conditions)) {
            if ((c.type === 'Available' || c.type === 'Progressing') && c.status === 'False') warnings.push(`${metadata(owner).name}: ${str(c.reason)} ${str(c.message)}`);
          }
        }
      }
      if (status.phase === 'Pending' || status.phase === 'Failed') warnings.push(`${metadata(pod).name}: ${status.phase}`);
      for (const container of array(status.containerStatuses)) {
        const waiting = record(record(container.state).waiting);
        if (waiting.reason) warnings.push(`${metadata(pod).name}: ${waiting.reason}`);
      }
      for (const event of events.map(record)) {
        const object = record(event.involvedObject);
        if (event.type === 'Warning' && metadata(event).namespace === metadata(pod).namespace && object.name === metadata(pod).name && object.kind === 'Pod') warnings.push(`${str(event.reason)}: ${str(event.message)}`);
      }
      const metric = metrics.map(record).find(m => `${metadata(m).namespace}/${metadata(m).name}` === key);
      if (metric) {
        hasMetrics = true;
        for (const c of array(metric.containers)) {
          health.cpuMillicores = (health.cpuMillicores ?? 0) + (cpu(record(c.usage).cpu) || 0);
          health.memoryMiB = (health.memoryMiB ?? 0) + memory(record(c.usage).memory);
        }
      }
    }
    health.workloads = [...new Set(health.workloads)];
    health.images = [...new Set(health.images)];
    health.warnings = [...new Set(warnings)].slice(0, 20);
    health.state = health.total && health.ready !== health.total || warnings.length ? 'warning' : health.total && !unknown ? 'healthy' : 'unknown';
    if (!hasMetrics) { delete health.cpuMillicores; delete health.memoryMiB; }
    link.health = health;
  }
}
