# AutoBlog

An automated blog content management system that leverages AI to generate, schedule, and publish blog posts across multiple platforms. AutoBlog integrates with WordPress and Next.js CMS, provides social media sharing capabilities, and uses n8n for workflow automation.

## 🚀 Features

- **AI-Powered Content Generation**: Generate blog posts using Groq AI with customizable topics, keywords, tone, and word count
- **Multi-Platform Publishing**: Support for WordPress and Next.js CMS integration
- **Workflow Automation**: Schedule and automate content publishing using n8n workflows
- **Social Media Integration**: Share content across Facebook, Instagram, LinkedIn, Twitter, Threads, and YouTube
- **SEO Optimization**: Built-in SEO features including meta descriptions, focus keywords, and schema markup
- **Rich Text Editor**: TipTap-based editor for content creation and editing
- **Image Management**: Upload and manage featured images for blog posts
- **Scheduling**: Schedule posts for future publication with flexible scheduling options
- **User Management**: Multi-tenant support with plan-based access (FREE, PRO, AGENCY)
- **Queue System**: BullMQ-based background job processing for efficient task management

## 🏗️ Architecture

AutoBlog is a monorepo application built with:

### Backend (`apps/api`)
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Cache/Queue**: Redis with BullMQ for background jobs
- **Authentication**: Clerk for user authentication
- **AI Integration**: Groq SDK for content generation
- **Workflow Engine**: n8n for automation

### Frontend (`apps/web`)
- **Framework**: React with Vite
- **Styling**: Tailwind CSS with Radix UI components
- **Editor**: TipTap rich text editor
- **State Management**: Zustand
- **Routing**: React Router
- **Authentication**: Clerk React

### Shared Code (`packages/shared`)
- Shared types and utilities between frontend and backend

## 📁 Project Structure

```
autoblog/
├── apps/
│   ├── api/                 # Backend Express API
│   │   ├── src/
│   │   │   ├── routes/      # API routes (posts, sites, workflows, etc.)
│   │   │   ├── services/    # Business logic (Groq, n8n, WordPress)
│   │   │   ├── middleware/  # Authentication middleware
│   │   │   ├── lib/         # Database and Redis clients
│   │   │   └── index.ts     # API entry point
│   │   ├── prisma/          # Database schema
│   │   └── uploads/         # User uploaded files
│   └── web/                 # Frontend React app
│       ├── src/
│       │   ├── components/  # React components
│       │   ├── pages/       # Page components
│       │   ├── layouts/     # Layout components
│       │   └── lib/         # API client and utilities
│       └── public/          # Static assets
├── packages/
│   └── shared/              # Shared TypeScript code
├── docker-compose.yml       # Development environment
└── pnpm-workspace.yaml     # Monorepo configuration
```

## 🛠️ Tech Stack

### Backend
- **Runtime**: Node.js (>=18.0.0)
- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL 15
- **ORM**: Prisma
- **Cache/Queue**: Redis 7 + BullMQ
- **Authentication**: Clerk
- **AI**: Groq SDK
- **Automation**: n8n
- **Validation**: Zod

### Frontend
- **Framework**: React 18
- **Build Tool**: Vite
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI
- **Editor**: TipTap
- **State Management**: Zustand
- **HTTP Client**: Axios
- **Authentication**: Clerk React

### Infrastructure
- **Containerization**: Docker & Docker Compose
- **Package Manager**: pnpm (>=8.0.0)

## 🚦 Getting Started

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- Docker & Docker Compose

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd autoblog
```

2. Install dependencies:
```bash
pnpm install
```

3. Start development environment:
```bash
docker-compose up -d
```

4. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

5. Run database migrations:
```bash
pnpm db:migrate
```

6. Start development servers:
```bash
pnpm dev
```

The API will be available at `http://localhost:3001` and the web app at `http://localhost:5173`.

### Environment Variables

Key environment variables (see `.env.example`):

```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/autoblog
REDIS_URL=redis://host:6379

# API Configuration
PORT=3001
WEB_URL=http://localhost:5173

# Security
JWT_SECRET=your-jwt-secret
ENCRYPTION_KEY=your-64-char-hex-key

# AI Services
GROQ_API_KEY=your-groq-api-key
GROQ_MODEL=qwen/qwen3.8-27b

# Integrations
N8N_URL=http://localhost:5678
N8N_API_KEY=your-n8n-api-key
WEBHOOK_SECRET=your-webhook-secret
```

## 📊 Database Schema

The application uses PostgreSQL with the following main models:

- **User**: User accounts with authentication and plan management
- **Site**: CMS integrations (WordPress, Next.js)
- **Post**: Blog posts with SEO, scheduling, and publishing status
- **Workflow**: Automated content generation workflows
- **SocialAccount**: Connected social media accounts
- **SocialShare**: Social media sharing history

## 🔧 Available Scripts

### Root Level
- `pnpm dev` - Start all development servers in parallel
- `pnpm build` - Build all packages
- `pnpm db:migrate` - Run database migrations
- `pnpm db:generate` - Generate Prisma client
- `pnpm db:studio` - Open Prisma Studio
- `pnpm docker:up` - Start Docker services
- `pnpm docker:down` - Stop Docker services

### API (`apps/api`)
- `pnpm dev` - Start API development server
- `pnpm build` - Build API for production
- `pnpm start` - Start production API server

### Web (`apps/web`)
- `pnpm dev` - Start web development server
- `pnpm build` - Build web app for production
- `pnpm preview` - Preview production build

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/verify` - Verify authentication

### Posts
- `GET /api/posts` - List all posts
- `POST /api/posts` - Create new post
- `GET /api/posts/:id` - Get single post
- `PUT /api/posts/:id` - Update post
- `DELETE /api/posts/:id` - Delete post
- `POST /api/posts/:id/publish` - Publish post

### Sites
- `GET /api/sites` - List all sites
- `POST /api/sites` - Connect new site
- `PUT /api/sites/:id` - Update site configuration
- `DELETE /api/sites/:id` - Remove site

### Workflows
- `GET /api/workflows` - List all workflows
- `POST /api/workflows` - Create workflow
- `PATCH /api/workflows/:id/toggle` - Toggle workflow status
- `DELETE /api/workflows/:id` - Delete workflow

### Social
- `GET /api/social/accounts` - List connected accounts
- `POST /api/social/connect` - Connect social account
- `POST /api/social/share` - Share post to social media

### Dashboard
- `GET /api/dashboard/stats` - Get dashboard statistics

## 🧪 Development

### Database Management

```bash
# Create a new migration
pnpm db:migrate

# Regenerate Prisma client after schema changes
pnpm db:generate

# Open Prisma Studio to inspect database
pnpm db:studio
```

### Docker Services

The project includes Docker Compose configuration for:
- **PostgreSQL**: Database server (port 5434)
- **Redis**: Cache and queue server (port 6379)
- **n8n**: Workflow automation (port 5678)

Access n8n at `http://localhost:5678` with credentials:
- Username: `admin`
- Password: `autoblog123`

## 🚀 Deployment

### Production Build

```bash
# Build all packages
pnpm build

# Start production servers
# API
cd apps/api && npm start

# Web (serve built files)
cd apps/web && npm run preview
```

### Environment Setup

Ensure all environment variables are properly configured for production:
- Use strong secrets for JWT and encryption
- Configure production database URLs
- Set up proper CORS origins
- Configure production API endpoints

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions, please open an issue in the repository.
