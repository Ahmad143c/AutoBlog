import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import type { RequestWithAuth } from '../types.js';

const router: Router = Router();

// Get dashboard stats
router.get('/stats', async (req: RequestWithAuth, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Get counts
    const [totalSites, totalPosts, activeWorkflows, publishedPosts, failedPosts] = await Promise.all([
      prisma.site.count({ where: { userId: user.id } }),
      prisma.post.count({ where: { userId: user.id } }),
      prisma.workflow.count({ where: { userId: user.id, isActive: true } }),
      prisma.post.count({ where: { userId: user.id, status: 'PUBLISHED' } }),
      prisma.post.count({ where: { userId: user.id, status: 'FAILED' } }),
    ]);

    // Calculate success rate
    const completedPosts = publishedPosts + failedPosts;
    const successRate = completedPosts > 0 
      ? Math.round((publishedPosts / completedPosts) * 100) 
      : 0;

    res.json({
      success: true,
      data: {
        totalSites,
        totalPosts,
        activeWorkflows,
        successRate,
      },
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch stats' });
  }
});

export { router as dashboardRouter };
