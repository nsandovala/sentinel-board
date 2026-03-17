export interface Project {
    id: string;
    name: string;
    slug: string;
    description?: string;
    repoUrl?: string;
    color?: string;
    status: "active" | "paused" | "archived";
  }