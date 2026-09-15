import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { generateBlogPostNonStream, generateSlug, generateExcerpt } from '../services/groq.service.js';
import { generateSEOData, calculateReadability } from '../services/seo.service.js';
import { publishToWordPress, uploadMediaToWordPress } from '../services/wordpress.service.js';
import axios from 'axios';
import path from 'path';

const router: Router = Router();

async function fetchImageBuffer(url: string) {
  const response = await axios.get(url, { responseType: 'arraybuffer' });
  const contentTypeHeader = response.headers['content-type'];
  const contentType = Array.isArray(contentTypeHeader) ? contentTypeHeader[0] : (contentTypeHeader as string || 'image/jpeg');
  const extension = contentType.split('/')[1] || 'jpg';
  
  return {
    buffer: Buffer.from(response.data),
    contentType,
    filename: `image_${Date.now()}.${extension}`
  };
}

// ... (keep existing n8n/generate if needed, but focus on /run)

router.post('/run', async (req, res) => {
  console.log('📥 Received webhook from n8n:', req.body);
  
  // Security check
  const secret = req.headers['x-autoblog-secret'];
  if (secret !== process.env.WEBHOOK_SECRET) {
    console.warn('❌ Unauthorized webhook attempt. Secret mismatch.');
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  try {
    const { workflowId } = req.body;
    let { dayOfWeek, weekNumber } = req.body;

    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
      include: { site: true }
    });

    if (!workflow || !workflow.isActive) {
      return res.status(404).json({ success: false, error: 'Workflow not found or inactive' });
    }

    // Default to current time if not provided
    if (!dayOfWeek) {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      dayOfWeek = days[new Date().getDay()];
    }

    if (!weekNumber) {
      const startDate = new Date(workflow.createdAt);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - startDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      weekNumber = Math.floor(diffDays / 7) + 1;
    }

    const scheduleData = typeof (workflow as any).scheduleData === 'string' 
      ? JSON.parse((workflow as any).scheduleData) 
      : (workflow as any).scheduleData;
      
    if (!scheduleData || !scheduleData.plan) {
      return res.status(400).json({ success: false, error: 'No schedule data found' });
    }

    const weekKey = `week${weekNumber}`;
    const dayData = scheduleData.plan[weekKey]?.[dayOfWeek];

    if (!dayData) {
      return res.json({ success: true, message: `No post scheduled for ${dayOfWeek} of ${weekKey}` });
    }

    // Determine title
    let title = dayData.title || (dayData.baseTopic ? `${dayData.baseTopic} — ${dayOfWeek} Edition` : "Automated Post");

    // Use the stored post description if available; otherwise generate content.
    let content: string;
    if (dayData.description && String(dayData.description).trim().length > 0) {
      content = String(dayData.description);
    } else {
      content = await generateBlogPostNonStream({
        userId: workflow.userId,
        topic: title,
        keywords: dayData.keywords ? dayData.keywords.split(',').map((k: string) => k.trim()) : [],
        tone: (workflow as any).tone || 'Professional',
        wordCount: (workflow as any).wordCount || 1000,
        language: (workflow as any).language || 'English',
      });
    }

    // Handle Image
    let featuredMediaId: number | undefined;
    if (dayData.imageUrl) {
      try {
        // If it's a relative URL, make it absolute (assuming API runs on localhost:3001)
        const absoluteUrl = dayData.imageUrl.startsWith('/') 
          ? `http://localhost:3001${dayData.imageUrl}` 
          : dayData.imageUrl;
          
        const img = await fetchImageBuffer(absoluteUrl);
        featuredMediaId = await uploadMediaToWordPress(workflow.site as any, {
          buffer: img.buffer,
          originalname: img.filename,
          mimetype: img.contentType
        });
      } catch (imgError) {
        console.error('Failed to process image for workflow:', imgError);
      }
    }

    const categories = Array.isArray(dayData.categories)
      ? dayData.categories.map((c: string) => c.trim()).filter(Boolean)
      : typeof dayData.categories === 'string'
      ? dayData.categories.split(',').map((c: string) => c.trim()).filter(Boolean)
      : [];

    const tags = Array.isArray(dayData.tags)
      ? dayData.tags.map((t: string) => t.trim().replace(/^#/, '')).filter(Boolean)
      : typeof dayData.tags === 'string'
      ? dayData.tags.split(',').map((t: string) => t.trim().replace(/^#/, '')).filter(Boolean)
      : [];

    // After generating content with Groq or retrieving it, generate SEO data too
    const seoData = await generateSEOData(workflow.userId, {
      postTitle: title,
      content,
      keywords: dayData.keywords
        ? dayData.keywords.split(",").map((k: string) => k.trim()).filter(Boolean)
        : [],
      tone: (workflow as any).tone || 'Professional',
    });

    // Inject schema markup into content
    let finalContent = content;
    if (seoData.schemaMarkup) {
      finalContent = `${content}
<script type="application/ld+json">
${seoData.schemaMarkup}
</script>`;
    }

    // Publish to WordPress with categories, tags, and SEO data
    const result = await publishToWordPress(workflow.site as any, {
      title,
      content: finalContent,
      slug: seoData.slug,
      excerpt: seoData.metaDescription,
      featuredMediaId,
      categories,
      tags,
      metaDescription: seoData.metaDescription,
      seoTitle: seoData.seoTitle,
      focusKeyword: seoData.selectedKeyword,
      schemaMarkup: seoData.schemaMarkup,
    });

    // Save post record with SEO data
    await prisma.post.create({
      data: {
        userId: workflow.userId,
        siteId: workflow.siteId,
        title,
        slug: seoData.slug,
        content: finalContent,
        excerpt: seoData.metaDescription,
        keywords: dayData.keywords ? dayData.keywords.split(',').map((k: string) => k.trim()) : [],
        categories,
        tags,
        tone: (workflow as any).tone || 'Professional',
        wordCount: (workflow as any).wordCount || 1000,
        status: 'PUBLISHED',
        publishedAt: new Date(),
        wpPostId: result.id,
        // SEO fields
        metaDescription: seoData.metaDescription,
        seoTitle: seoData.seoTitle,
        focusKeyword: seoData.selectedKeyword,
        schemaMarkup: seoData.schemaMarkup,
        readabilityScore: calculateReadability(content).score,
      }
    });

    await prisma.workflow.update({
      where: { id: workflowId },
      data: { lastRunAt: new Date() }
    });

    res.json({ success: true, data: result });

  } catch (error: any) {
    console.error('Error in workflow run webhook:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to run workflow' });
  }
});

export { router as webhookRouter };
