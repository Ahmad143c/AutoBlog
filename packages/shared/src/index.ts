// Enums
export enum Platform {
  WORDPRESS = 'WORDPRESS',
  NEXTJS = 'NEXTJS',
}

export enum PostStatus {
  DRAFT = 'DRAFT',
  SCHEDULED = 'SCHEDULED',
  PUBLISHING = 'PUBLISHING',
  PUBLISHED = 'PUBLISHED',
  FAILED = 'FAILED',
}

export enum SiteStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ERROR = 'ERROR',
}

export enum Plan {
  FREE = 'FREE',
  PRO = 'PRO',
  AGENCY = 'AGENCY',
}

// Types
export interface User {
  id: string;
  clerkId: string;
  email: string;
  name: string;
  password: string;
  groqApiKey?: string;
  plan: Plan;
  createdAt: Date;
}

export interface Site {
  id: string;
  userId: string;
  name: string;
  url: string;
  platform: Platform;
  credentials: Record<string, string>;
  status: SiteStatus;
  createdAt: Date;
}

export interface Post {
  id: string;
  userId: string;
  siteId: string;
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  keywords: string[];
  tone: string;
  wordCount: number;
  status: PostStatus;
  scheduledAt?: Date;
  publishedAt?: Date;
  wpPostId?: number;
  featuredImageUrl?: string;
  featuredMediaId?: number;
  n8nRunId?: string;
  errorLog?: string;
  site?: {
    name: string;
    url: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface Workflow {
  id: string;
  userId: string;
  siteId: string;
  n8nWorkflowId: string;
  name: string;
  schedule: string;
  topic: string;
  keywords: string[];
  tone: string;
  wordCount: number;
  isActive: boolean;
  lastRunAt?: Date;
  site?: {
    name: string;
    url: string;
  };
  createdAt: Date;
}

// API Request/Response Types
export interface GeneratePostRequest {
  topic: string;
  keywords: string[];
  tone: string;
  wordCount: number;
  language?: string;
}

export interface CreatePostRequest {
  siteId: string;
  title: string;
  content: string;
  excerpt?: string;
  keywords: string[];
  tone: string;
  wordCount: number;
  scheduledAt?: string;
}

export interface CreateSiteRequest {
  name: string;
  url: string;
  platform: Platform;
  credentials: {
    username: string;
    appPassword: string;
  };
}

export interface CreateWorkflowRequest {
  siteId: string;
  name: string;
  schedule: {
    type: 'daily' | 'weekly' | 'custom';
    time: string;
    days?: number[];
    customExpression?: string;
  };
  topic: string;
  keywords: string[];
  tone: string;
  wordCount: number;
}

export interface DashboardStats {
  totalSites: number;
  totalPosts: number;
  activeWorkflows: number;
  successRate: number;
}

// API Response wrapper
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
