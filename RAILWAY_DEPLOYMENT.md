# Railway Deployment Guide for AutoBlog API

This guide will help you deploy the AutoBlog API to Railway.app.

## Prerequisites

- Railway account ([https://railway.app](https://railway.app))
- GitHub repository with your AutoBlog code
- Railway CLI (optional, for CLI-based deployment)

## Deployment Options

### Option 1: GitHub Integration (Recommended)

#### Step 1: Prepare Your Repository

1. Ensure your repository is pushed to GitHub
2. Make sure the API code is in the `apps/api` directory
3. Verify that `.env.example` exists in `apps/api/`

#### Step 2: Create Railway Project

1. Go to [railway.app](https://railway.app) and sign in
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your AutoBlog repository
4. Railway will detect the project structure

#### Step 3: Configure Build Settings

In your Railway project settings:

1. **Root Directory**: Set to `apps/api`
2. **Build Command**: `pnpm install && pnpm build`
3. **Start Command**: `node dist/index.js`
4. **Port**: `3001`

#### Step 4: Add Required Services

You'll need to add these services in Railway:

1. **PostgreSQL Database**
   - Click "New Service" → "Database" → "PostgreSQL"
   - Railway will provide a connection string

2. **Redis** (for BullMQ)
   - Click "New Service" → "Database" → "Redis"
   - Railway will provide a connection string

#### Step 5: Configure Environment Variables

Add these environment variables in your Railway API service:

```env
# Database (provided by Railway PostgreSQL service)
DATABASE_URL={{Postgres.DATABASE_URL}}

# Redis (provided by Railway Redis service)  
REDIS_URL={{Redis.REDIS_URL}}

# API Configuration
PORT=3001
NODE_ENV=production
WEB_URL=https://your-frontend-domain.com

# Security (generate these yourself)
JWT_SECRET=your-long-random-jwt-secret
ENCRYPTION_KEY=your-64-character-hex-key

# AI Services
GROQ_API_KEY=your-groq-api-key
GROQ_MODEL=qwen/qwen3.8-27b

# Integrations
N8N_URL=https://your-n8n-instance.com
N8N_API_KEY=your-n8n-api-key
WEBHOOK_SECRET=your-random-webhook-secret

# Clerk Authentication (if using)
CLERK_SECRET_KEY=your-clerk-secret-key
CLERK_PUBLISHABLE_KEY=your-clerk-publishable-key
```

#### Step 6: Run Database Migrations

Railway doesn't automatically run Prisma migrations. You have two options:

**Option A: Railway CLI**
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Select your project
railway project

# Run migrations
railway run npx prisma migrate deploy
```

**Option B: Add migration to build process**
Add this to your `apps/api/package.json`:
```json
"scripts": {
  "postinstall": "npx prisma generate && npx prisma migrate deploy"
}
```

#### Step 7: Deploy

1. Push changes to your GitHub repository
2. Railway will automatically detect and deploy
3. Monitor the deployment logs in Railway dashboard

### Option 2: Railway CLI Deployment

#### Step 1: Install Railway CLI

```bash
npm install -g @railway/cli
```

#### Step 2: Login and Initialize

```bash
# Login to Railway
railway login

# Navigate to API directory
cd apps/api

# Initialize Railway project
railway init
```

#### Step 3: Add Services

```bash
# Add PostgreSQL
railway add postgresql

# Add Redis
railway add redis
```

#### Step 4: Configure Environment Variables

```bash
# Set environment variables
railway variables set PORT=3001
railway variables set NODE_ENV=production
railway variables set JWT_SECRET=your-secret
# ... add other variables
```

#### Step 5: Deploy

```bash
# Deploy to Railway
railway up
```

## Configuration Files

### railway.json

This file is included in `apps/api/railway.json`:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "node dist/index.js",
    "healthcheckPath": "/health"
  }
}
```

### Dockerfile

A Dockerfile is provided in `apps/api/Dockerfile` for container-based deployment if needed.

## Database Setup

### Manual Migration

If automatic migrations don't work, run them manually:

```bash
# Using Railway CLI
railway run npx prisma migrate deploy

# Or via Railway dashboard console
# Open your service → Console → Run: npx prisma migrate deploy
```

### Prisma Studio

To inspect your Railway database:

```bash
railway run npx prisma studio
```

## Troubleshooting

### Build Failures

1. **Module not found errors**: Ensure `@autoblog/shared` is built before the API
2. **TypeScript errors**: Check that TypeScript compilation succeeds locally first
3. **Dependency issues**: Verify `pnpm-lock.yaml` is committed to the repository

### Runtime Errors

1. **Database connection errors**: Check that `DATABASE_URL` is correctly set with Railway's PostgreSQL service
2. **Redis connection errors**: Verify `REDIS_URL` is set with Railway's Redis service
3. **Port binding**: Ensure Railway knows to use port 3001

### Environment Variables

1. **Missing variables**: Check Railway dashboard → Variables tab
2. **Invalid format**: Ensure no extra spaces or quotes in variable values
3. **Service references**: Use Railway's variable references like `{{Postgres.DATABASE_URL}}`

### Health Checks

The API includes a health check endpoint at `/health`. Railway uses this to determine if your service is healthy.

## Post-Deployment

### Get Your API URL

After deployment, Railway will provide a URL like:
```
https://your-api-name.up.railway.app
```

### Update Frontend Configuration

Update your frontend environment variables to point to the new Railway API URL:

```env
VITE_API_URL=https://your-api-name.up.railway.app
```

### Domain Setup (Optional)

1. Go to your Railway service → Settings → Domains
2. Add your custom domain
3. Configure DNS records as instructed by Railway

## Monitoring

### Logs

View real-time logs in Railway dashboard:
- Service → Logs tab
- Filter by deployment or service

### Metrics

Railway provides metrics for:
- CPU usage
- Memory usage
- Request counts
- Response times

## Scaling

Railway automatically scales your service based on demand. You can also configure:
- Minimum/maximum instances
- CPU/RAM limits
- Autoscaling rules

## Cost Considerations

- Railway has a free tier with limits
- PostgreSQL and Redis have separate costs
- Monitor usage to avoid unexpected charges
- Consider Railway's pricing for production workloads

## Next Steps

1. Test your deployed API endpoints
2. Configure frontend to use the new API URL
3. Set up monitoring and alerts
4. Configure custom domain
5. Set up CI/CD for automated deployments

## Support

For Railway-specific issues:
- [Railway Documentation](https://docs.railway.app)
- [Railway Discord](https://discord.gg/railway)

For AutoBlog-specific issues:
- Check the main README.md
- Open an issue in the repository