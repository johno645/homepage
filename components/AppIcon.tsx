import { Box, Cloud, ExternalLink, Github, Globe, Rocket, Server } from 'lucide-react';
import type { ComponentType } from 'react';

const icons: Record<string, ComponentType<{ className?: string; 'aria-hidden'?: boolean }>> = {
  github: Github,
  aws: Cloud,
  vercel: Globe,
  netlify: Globe,
  digitalocean: Cloud,
  railway: Rocket,
  k8s: Box,
  server: Server,
  globe: Globe,
};

export default function AppIcon({ name, className = 'h-4 w-4' }: { name?: string; className?: string }) {
  const Icon = (name && icons[name]) || ExternalLink;
  return <Icon className={className} aria-hidden />;
}
