export interface LinkItem {
  title: string;
  url: string;
  description: string;
  icon?: string;
}

export interface LinksConfig {
  name: string;
  links: LinkItem[];
}
