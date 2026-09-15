import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { publishQueue } from '../lib/redis.js';
import { 
  generateBlogPost, 
  continueBlogPost,
  countWords,
  generateSlug, 
  generateExcerpt,
  generateBlogPostNonStream,
  generateMetadata,
  improvePostReadability
} from '../services/groq.service.js';
import { calculateReadability, generateSEOData } from '../services/seo.service.js';
import { publishToWordPress, uploadMediaToWordPress } from '../services/wordpress.service.js';
import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage() });
import type { RequestWithAuth } from '../types.js';

const router: Router = Router();

const createPostSchema = z.object({
  siteId: z.string(),
  title: z.string().min(1),
  content: z.string().min(1),
  excerpt: z.string().optional(),
  keywords: z.array(z.string()),
  tone: z.string(),
  wordCount: z.number().int().positive(),
  categories: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  scheduledAt: z.string().datetime().optional(),
  slug: z.string().optional(),
  metaDescription: z.string().nullable().optional(),
  seoTitle: z.string().nullable().optional(),
  focusKeyword: z.string().nullable().optional(),
  schemaMarkup: z.string().nullable().optional(),
  readabilityScore: z.number().int().nullable().optional(),
});

const generateSchema = z.object({
  topic: z.string().min(1),
  keywords: z.array(z.string()),
  tone: z.string(),
  wordCount: z.number().int().min(100).max(3000),
  language: z.string().optional(),
});

// List all posts for user
router.get('/', async (req: RequestWithAuth, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const posts = await prisma.post.findMany({
      where: { userId: user.id },
      include: {
        site: {
          select: {
            name: true,
            url: true,
            socialAccounts: {
              select: { platform: true }
            }
          }
        },
        socialShares: true
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: posts });
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch posts' });
  }
});

// Get a specific post
router.get('/:id', async (req: RequestWithAuth, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const post = await prisma.post.findFirst({
      where: { id: req.params.id, userId },
      include: {
        site: {
          select: {
            name: true,
            url: true,
            socialAccounts: {
              select: { platform: true }
            }
          }
        },
        socialShares: true
      },
    });

    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }

    res.json({ success: true, data: post });
  } catch (error) {
    console.error('Error fetching post:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch post' });
  }
});

// Generate post content (streaming)
router.post('/generate', async (req: RequestWithAuth, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const parsed = generateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.message });
    }

    // Set headers for streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let generatedContent = '';
    const stream = await generateBlogPost({ ...parsed.data, userId });
    
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        generatedContent += content;
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    const minWords = Math.floor(parsed.data.wordCount * 0.95);
    for (let attempt = 0; attempt < 2; attempt++) {
      const actualWords = countWords(generatedContent);
      if (actualWords >= minWords) {
        break;
      }

      const remainingWords = parsed.data.wordCount - actualWords;
      if (remainingWords < 150) {
        break;
      }

      const continuation = await continueBlogPost({
        ...parsed.data,
        userId,
        existingContent: generatedContent,
        remainingWords,
      });

      for await (const chunk of continuation) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          generatedContent += content;
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }
    }
    
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: any) {
    console.error('Error generating post:', error);
    const isKeyError =
      error?.status === 401 ||
      String(error?.message || '').includes('API key') ||
      String(error?.message || '').includes('No Groq API key');

    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({
        error: isKeyError
          ? error.message || 'Invalid Groq API key. Please update your key in Settings.'
          : error.message || 'Failed to generate post',
      })}\n\n`);
      res.write('data: [DONE]\n\n');
      return res.end();
    }

    res.status(500).json({ success: false, error: error.message || 'Failed to generate post' });
  }
});

// Generate metadata (keywords, categories, tags)
router.post('/generate-metadata', async (req: RequestWithAuth, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { title, language, tone } = req.body;
    if (!title || typeof title !== 'string') {
      return res.status(400).json({ success: false, error: 'Title is required' });
    }

    const metadata = await generateMetadata(title, { userId, language, tone });
    res.json({ success: true, data: metadata });
  } catch (error: any) {
    console.error('Error generating metadata:', error);
    res.status(500).json({ success: false, error: 'Failed to generate metadata' });
  }
});

// Create/save draft post
router.post('/', async (req: RequestWithAuth, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Check rate limit for FREE users
    if (user.plan === 'FREE') {
      const postCount = await prisma.post.count({
        where: { 
          userId: user.id,
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
      });
      
      if (postCount >= 5) {
        return res.status(403).json({ 
          success: false, 
          error: 'Free plan limit reached (5 posts/month). Upgrade to PRO for unlimited posts.' 
        });
      }
    }

    const parsed = createPostSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.message });
    }

    const data = parsed.data;
    const slug = data.slug || generateSlug(data.title);
    const excerpt = data.metaDescription || data.excerpt || generateExcerpt(data.content);

    const post = await prisma.post.create({
      data: {
        userId: user.id,
        siteId: data.siteId,
        title: data.title,
        slug,
        content: data.content,
        excerpt,
        keywords: data.keywords,
        categories: data.categories || [],
        tags: data.tags || [],
        tone: data.tone,
        wordCount: data.wordCount,
        status: data.scheduledAt ? 'SCHEDULED' : 'DRAFT',
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
        metaDescription: data.metaDescription || null,
        seoTitle: data.seoTitle || null,
        focusKeyword: data.focusKeyword || null,
        schemaMarkup: data.schemaMarkup || null,
        readabilityScore: data.readabilityScore || null,
      },
    });

    res.json({ success: true, data: post });
  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({ success: false, error: 'Failed to create post' });
  }
});

// Improve readability for a specific post without publishing changes.
router.post('/:id/improve-readability', async (req: RequestWithAuth, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const post = await prisma.post.findFirst({
      where: { id: req.params.id, userId },
    });

    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }

    const sourceContent = String(req.body.content || post.content || '');
    if (!sourceContent.trim()) {
      return res.status(400).json({ success: false, error: 'Post content is required' });
    }

    const title = String(req.body.title || post.title || '');
    const keywords = Array.isArray(req.body.keywords)
      ? req.body.keywords
      : Array.isArray(post.keywords)
        ? post.keywords
        : [];

    const content = await improvePostReadability({
      userId,
      title,
      content: sourceContent,
      keywords,
      tone: String(req.body.tone || post.tone || 'Professional'),
      language: String(req.body.language || 'English'),
      targetWordCount: Number(req.body.wordCount || post.wordCount || undefined),
    });

    const readability = calculateReadability(content);

    res.json({
      success: true,
      data: {
        content,
        readability,
      },
    });
  } catch (error: any) {
    console.error('Error improving readability:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to improve readability' });
  }
});

// Publish immediately
router.post('/:id/publish', async (req: RequestWithAuth, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const postId = req.params.id;
    const post = await prisma.post.findFirst({
      where: { id: postId, userId: user.id },
      include: { site: true },
    });

    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }

    // Add to BullMQ queue for immediate processing
    await publishQueue.add('publish-post', {
      postId: post.id,
      siteId: post.siteId,
      userId: user.id,
    }, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    });

    // Update status
    await prisma.post.update({
      where: { id: postId },
      data: { status: 'PUBLISHING' },
    });

    res.json({ success: true, message: 'Post queued for publishing' });
  } catch (error) {
    console.error('Error publishing post:', error);
    res.status(500).json({ success: false, error: 'Failed to publish post' });
  }
});

// Schedule post
router.post('/:id/schedule', upload.single('featuredImage'), async (req: RequestWithAuth, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const scheduleSchema = z.object({
      scheduledAt: z.string().datetime(),
    });

    const parsed = scheduleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.message });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const postId = req.params.id;
    const post = await prisma.post.findFirst({
      where: { id: postId, userId: user.id },
      include: { site: true },
    });

    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }

    let featuredMediaId = (post as any).featuredMediaId as number | null | undefined;
    if (req.file) {
      if (!post.site) {
        return res.status(400).json({ success: false, error: 'Post site not found' });
      }

      try {
        console.log(`[Schedule] Uploading featured image for scheduled post ${postId}: ${req.file.originalname}`);
        featuredMediaId = await uploadMediaToWordPress(post.site as any, {
          buffer: req.file.buffer,
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
        });
        console.log(`[Schedule] Featured image uploaded with media ID: ${featuredMediaId}`);
      } catch (error) {
        console.error('Failed to upload scheduled post media to WordPress:', error);
        return res.status(500).json({
          success: false,
          error: `Failed to upload featured image: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }

    const updated = await prisma.post.update({
      where: { id: postId },
      data: {
        status: 'SCHEDULED',
        scheduledAt: new Date(parsed.data.scheduledAt),
        ...(featuredMediaId ? { featuredMediaId } : {}),
      },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error scheduling post:', error);
    res.status(500).json({ success: false, error: 'Failed to schedule post' });
  }
});

// Delete post
router.delete('/:id', async (req: RequestWithAuth, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const postId = req.params.id;
    const post = await prisma.post.findFirst({
      where: { id: postId, userId: user.id },
      include: { site: true }
    });

    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }

    let wpTrashed = false;
    if (post.wpPostId && post.site) {
      try {
        const { decryptObject } = await import('../lib/crypto.js');
        const credentials = decryptObject(post.site.credentials as any);
        const token = Buffer.from(`${credentials.username}:${credentials.appPassword}`).toString("base64");
        const axios = (await import('axios')).default;
        
        await axios.delete(
          `${post.site.url}/wp-json/wp/v2/posts/${post.wpPostId}`,
          { headers: { Authorization: `Basic ${token}` } }
        );
        wpTrashed = true;
      } catch (wpError: any) {
        console.warn("WordPress trash failed:", wpError.message);
      }
    }

    await prisma.$transaction([
      prisma.socialShare.deleteMany({ where: { postId } }),
      prisma.post.delete({ where: { id: postId } })
    ]);

    res.json({
      success: true,
      data: {
        wpTrashed,
        message: wpTrashed
          ? "Post deleted from AutoBlog and moved to trash on WordPress."
          : "Post deleted from AutoBlog only (not on WordPress or WP trash failed)."
      }
    });
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({ success: false, error: 'Failed to delete post' });
  }
});

// Update post
router.put('/:id', upload.single('featuredImage'), async (req: RequestWithAuth, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const existing = await prisma.post.findFirst({
      where: { id: req.params.id, userId },
      include: { site: true }
    });
    if (!existing) return res.status(404).json({ success: false, error: 'Not found' });

    // Note: For now we don't save local image files like the prompt suggests because the environment might not have the folder, 
    // but the prompt explicitly asked for saving to `../../uploads/post-images`. Let me adapt that part using a buffer or minimal storage if needed.
    // Actually, in the project `uploadMediaToWordPress` handles media. Let's just follow the prompt's instruction.
    let featuredImageUrl = (existing as any).featuredImageUrl;
    let featuredMediaId = (existing as any).featuredMediaId;
    if (req.file) {
      const fs = await import('fs');
      const path = await import('path');
      
      const filename = `post_${req.params.id}_${Date.now()}${path.extname(req.file.originalname)}`;
      const dirPath = path.join(__dirname, "../../uploads/post-images");
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      const uploadPath = path.join(dirPath, filename);
      fs.writeFileSync(uploadPath, req.file.buffer);
      featuredImageUrl = `/uploads/post-images/${filename}`;

      try {
        featuredMediaId = await uploadMediaToWordPress(existing.site as any, {
          buffer: req.file.buffer,
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
        });
      } catch (error) {
        console.error('Failed to upload updated featured image to WordPress:', error);
        return res.status(500).json({
          success: false,
          error: `Failed to upload featured image: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }

    const updated = await prisma.post.update({
      where: { id: req.params.id },
      data: {
        title: req.body.title,
        content: req.body.content,
        keywords: JSON.parse(req.body.keywords || "[]"),
        categories: JSON.parse(req.body.categories || "[]"),
        tags: JSON.parse(req.body.tags || "[]"),
        tone: req.body.tone,
        wordCount: parseInt(req.body.wordCount),
        slug: req.body.slug !== undefined ? req.body.slug : undefined,
        metaDescription: req.body.metaDescription !== undefined ? (req.body.metaDescription || null) : undefined,
        seoTitle: req.body.seoTitle !== undefined ? (req.body.seoTitle || null) : undefined,
        focusKeyword: req.body.focusKeyword !== undefined ? (req.body.focusKeyword || null) : undefined,
        schemaMarkup: req.body.schemaMarkup !== undefined ? (req.body.schemaMarkup || null) : undefined,
        readabilityScore: req.body.readabilityScore !== undefined ? (req.body.readabilityScore ? parseInt(req.body.readabilityScore) : null) : undefined,
        ...(req.body.status ? { status: req.body.status } : {}),
        ...(req.body.scheduledAt !== undefined ? { 
          scheduledAt: (req.body.scheduledAt === 'null' || !req.body.scheduledAt) ? null : new Date(req.body.scheduledAt) 
        } : {}),
        ...(featuredImageUrl ? { featuredImageUrl } : {}),
        ...(featuredMediaId ? { featuredMediaId } : {}),
        updatedAt: new Date(),
      }
    });

    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Publish with optional image
router.post('/:id/publish-with-image', upload.single('featuredImage'), async (req: RequestWithAuth, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const postId = req.params.id;
    console.log(`[Publish] User ${userId} publishing post ${postId}`);
    
    const post = await prisma.post.findFirst({
      where: { id: postId, userId },
      include: { site: true },
    });

    if (!post) {
      console.error(`[Publish] Post ${postId} not found for user ${userId}`);
      return res.status(404).json({ success: false, error: 'Post not found' });
    }

    if (!post.site) {
      console.error(`[Publish] Post ${postId} has no associated site`);
      return res.status(400).json({ success: false, error: 'Post site not found' });
    }

    console.log(`[Publish] Post found: ${post.title}, Site: ${post.site.url}`);
    console.log(`[Publish] Categories: ${JSON.stringify(post.categories)}, Tags: ${JSON.stringify(post.tags)}`);

    let featuredMediaId: number | undefined;

    // Handle image upload if present
    if (req.file) {
      try {
        console.log(`[Publish] Uploading featured image: ${req.file.originalname}`);
        featuredMediaId = await uploadMediaToWordPress(post.site as any, {
          buffer: req.file.buffer,
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
        });
        console.log(`[Publish] Image uploaded with media ID: ${featuredMediaId}`);
      } catch (error) {
        console.error('Failed to upload media to WordPress:', error);
        return res.status(500).json({ success: false, error: `Failed to upload featured image: ${error instanceof Error ? error.message : String(error)}` });
      }
    }

    // Save SEO fields first
    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: {
        ...(req.body.slug ? { slug: req.body.slug } : {}),
        metaDescription: req.body.metaDescription !== undefined ? (req.body.metaDescription || null) : undefined,
        seoTitle: req.body.seoTitle !== undefined ? (req.body.seoTitle || null) : undefined,
        focusKeyword: req.body.focusKeyword !== undefined ? (req.body.focusKeyword || null) : undefined,
        schemaMarkup: req.body.schemaMarkup !== undefined ? (req.body.schemaMarkup || null) : undefined,
        readabilityScore: req.body.readabilityScore !== undefined ? (req.body.readabilityScore ? parseInt(req.body.readabilityScore) : null) : undefined,
      },
      include: { site: true },
    });

    // Publish to WordPress
    try {
      console.log(`[Publish] Publishing to WordPress: ${updatedPost.site.url}`);
      const wpPost = await publishToWordPress(updatedPost.site as any, {
        title: updatedPost.title,
        content: updatedPost.content,
        excerpt: updatedPost.metaDescription || updatedPost.excerpt || undefined,
        slug: updatedPost.slug,
        categories: updatedPost.categories,
        tags: updatedPost.tags,
        featuredMediaId,
        metaDescription: updatedPost.metaDescription || undefined,
        seoTitle: updatedPost.seoTitle || undefined,
        focusKeyword: updatedPost.focusKeyword || undefined,
        schemaMarkup: updatedPost.schemaMarkup || undefined,
      });
      console.log(`[Publish] Successfully published to WordPress, WP Post ID: ${wpPost.id}`);

      // Update post in database
      const finalUpdated = await prisma.post.update({
        where: { id: postId },
        data: {
          status: 'PUBLISHED',
          publishedAt: new Date(),
          wpPostId: wpPost.id,
          ...(featuredMediaId ? { featuredMediaId } : {}),
        },
      });

      console.log(`[Publish] Post ${postId} marked as PUBLISHED in database`);
      res.json({ success: true, data: finalUpdated });
    } catch (wpError) {
      console.error('Failed to publish to WordPress:', wpError);
      throw new Error(`WordPress publish failed: ${wpError instanceof Error ? wpError.message : String(wpError)}`);
    }
  } catch (error: any) {
    console.error('Error publishing with image:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to publish post' });
  }
});

// POST /api/posts/generate-seo
// Called after content is generated to get SEO data
router.post("/generate-seo", async (req: RequestWithAuth, res) => {
  const userId = req.auth?.userId;
  if (!userId) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const { postTitle, content, keywords, tone } = req.body

  if (!postTitle || !content) {
    return res.status(400).json({
      success: false,
      error: "postTitle and content are required"
    })
  }

  try {
    const seoData = await generateSEOData(userId, {
      postTitle,
      content,
      keywords: Array.isArray(keywords) ? keywords : [],
      tone: tone || "Professional",
    })

    res.json({ success: true, data: seoData })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export { router as postsRouter };
