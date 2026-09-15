import 'dotenv/config';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { prisma } from './lib/prisma.js';
import { publishToWordPress } from './services/wordpress.service.js';
import { publishQueue } from './lib/redis.js';

const redis = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

const worker = new Worker(
  'publish-posts',
  async (job) => {
    const { postId, siteId, userId } = job.data;

    console.log(`Processing publish job for post ${postId}`);

    try {
      // Get post and site
      const post = await prisma.post.findUnique({
        where: { id: postId },
        include: { site: true },
      });

      if (!post) {
        throw new Error('Post not found');
      }

      // Update status to publishing
      await prisma.post.update({
        where: { id: postId },
        data: { status: 'PUBLISHING' },
      });

      // Publish to WordPress
      const result = await publishToWordPress(post.site as any, {
        title: post.title,
        content: post.content,
        excerpt: post.excerpt || undefined,
        slug: post.slug,
        categories: post.categories,
        tags: post.tags,
        featuredMediaId: (post as any).featuredMediaId || undefined,
        metaDescription: post.metaDescription || undefined,
        seoTitle: post.seoTitle || undefined,
        focusKeyword: post.focusKeyword || undefined,
        schemaMarkup: post.schemaMarkup || undefined,
      });

      // Update post with success
      await prisma.post.update({
        where: { id: postId },
        data: {
          status: 'PUBLISHED',
          publishedAt: new Date(),
          wpPostId: result.id,
        },
      });

      console.log(`Successfully published post ${postId} to WordPress`);
      return { success: true, wpPostId: result.id };
    } catch (error) {
      console.error(`Failed to publish post ${postId}:`, error);

      // Update post with error
      await prisma.post.update({
        where: { id: postId },
        data: {
          status: 'FAILED',
          errorLog: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      throw error;
    }
  },
  {
    connection: redis,
    concurrency: 5,
  }
);

worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed:`, err.message);
});

async function processScheduledPosts() {
  try {
    const now = new Date();
    const scheduledPosts = await prisma.post.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledAt: {
          lte: now,
        },
      },
    });

    for (const post of scheduledPosts) {
      console.log(`Enqueuing scheduled post: ${post.id} ("${post.title}")`);
      
      // Update status to PUBLISHING first so another iteration won't pick it up
      await prisma.post.update({
        where: { id: post.id },
        data: { status: 'PUBLISHING' },
      });

      await publishQueue.add('publish-post', {
        postId: post.id,
        siteId: post.siteId,
        userId: post.userId,
      }, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      });
    }
  } catch (error) {
    console.error('Error processing scheduled posts:', error);
  }
}

// Check every 30 seconds
const scheduledPostsInterval = setInterval(processScheduledPosts, 30000);

console.log('BullMQ worker started for publish-posts queue');

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down worker...');
  clearInterval(scheduledPostsInterval);
  await worker.close();
  await redis.disconnect();
  await prisma.$disconnect();
  process.exit(0);
});
