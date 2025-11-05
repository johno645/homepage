'use client';

import { ExternalLink } from 'lucide-react';

interface LinkCardProps {
  title: string;
  url: string;
  description: string;
  icon?: string;
}

export default function LinkCard({ title, url, description, icon }: LinkCardProps) {
  // Icon mapping - you can expand this with actual icon components
  const getIcon = () => {
    // For now, we'll use a simple emoji or the ExternalLink icon
    // You can install @iconify/react or similar for better icons
    return <ExternalLink className="h-6 w-6" />;
  };

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative flex flex-col rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition-all duration-200 hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
    >
      {/* Icon */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-zinc-100 to-zinc-200 text-zinc-700 transition-transform duration-200 group-hover:scale-110 dark:from-zinc-800 dark:to-zinc-900 dark:text-zinc-300">
          {getIcon()}
        </div>
        <ExternalLink className="h-4 w-4 text-zinc-400 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
      </div>

      {/* Content */}
      <div className="flex-1">
        <h3 className="mb-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          {title}
        </h3>
        <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          {description}
        </p>
      </div>
    </a>
  );
}

