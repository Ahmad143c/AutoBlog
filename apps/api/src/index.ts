import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { requireAuth } from './middleware/auth.js';
import { postsRouter } from './routes/posts.js';
import { sitesRouter } from './routes/sites.js';
import { workflowsRouter } from './routes/workflows.js';
import { dashboardRouter } from './routes/dashboard.js';
import { webhookRouter } from './routes/webhook.js';
import { authRouter } from './routes/auth.js';
import { settingsRouter } from './routes/settings.js';
import { socialRouter } from './routes/social.js';

// Initialize BullMQ background worker
import './worker.js';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({ origin: process.env.WEB_URL || "http://localhost:5173" }));
app.use(express.json());
app.use(morgan('dev'));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Public webhook route (no auth)
app.use('/api/webhooks', webhookRouter);

// Public auth routes (no Clerk auth required for demo)
app.use('/api/auth', authRouter);

// Protected routes
app.use('/api/posts', requireAuth, postsRouter);
app.use('/api/sites', requireAuth, sitesRouter);
app.use('/api/workflows', requireAuth, workflowsRouter);
app.use('/api/dashboard', requireAuth, dashboardRouter);
app.use('/api/settings', requireAuth, settingsRouter);
app.use('/api/social', requireAuth, socialRouter);

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: err.message || 'Internal server error' });
});

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`🚀 API server running on http://0.0.0.0:${PORT}`);
});
