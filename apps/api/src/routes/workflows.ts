import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { createWorkflowInN8n, toggleWorkflow, deleteWorkflowFromN8n, generateCronExpression } from '../services/n8n.service.js';
import type { RequestWithAuth } from '../types.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { generateDescription, generateMetadata, generateBlogPostNonStream, generateWorkflowPlan } from '../services/groq.service.js';

const upload = multer({ storage: multer.memoryStorage() });

const router: Router = Router();

const createWorkflowSchema = z.object({
  siteId: z.string(),
  name: z.string().min(1),
  schedule: z.object({
    type: z.enum(['daily', 'weekly', 'custom']),
    time: z.string(),
    days: z.array(z.number()).optional(),
    customExpression: z.string().optional(),
  }),
  topic: z.string().min(1),
  keywords: z.array(z.string()),
  tone: z.string(),
  wordCount: z.number().int().min(100).max(2000),
});

// List all workflows for user
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

    const workflows = await prisma.workflow.findMany({
      where: { userId: user.id },
      include: { 
        site: { select: { name: true, url: true } }
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: workflows });
  } catch (error) {
    console.error('Error fetching workflows:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch workflows' });
  }
});

// Upload image for workflow day
router.post('/upload-image', upload.single('image'), async (req: RequestWithAuth, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No image provided' });
    }

    const imageKey = req.body.imageKey;
    const uploadsDir = path.join(__dirname, '../../uploads/workflow-images');
    
    // Ensure directory exists
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filename = `${imageKey}_${Date.now()}${path.extname(req.file.originalname)}`;
    const uploadPath = path.join(uploadsDir, filename);
    
    fs.writeFileSync(uploadPath, req.file.buffer);
    
    res.json({
      success: true,
      data: { url: `/uploads/workflow-images/${filename}` }
    });
  } catch (error: any) {
    console.error('Error uploading workflow image:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to upload image' });
  }
});

// Create new workflow
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

    const data = req.body;

    // Check if site belongs to user
    const site = await prisma.site.findFirst({
      where: { id: data.siteId, userId: user.id },
    });

    if (!site) {
      return res.status(404).json({ success: false, error: 'Site not found' });
    }

    // Build actual cron expression from user selection
    let cronExpression = '0 9 * * *';
    if (data.scheduleData.type === 'cron') {
      cronExpression = data.scheduleData.cronExpression;
    } else {
      // Map day names to numbers for the cron generator
      const dayMap: Record<string, number> = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
      const dayNumbers = data.scheduleData.days?.map((d: string) => dayMap[d]);
      
      cronExpression = generateCronExpression({
        type: data.scheduleData.type,
        time: data.scheduleData.time,
        days: dayNumbers
      });
    }

    // Create workflow in database
    const workflow = await prisma.workflow.create({
      data: {
        userId: user.id,
        siteId: data.siteId,
        n8nWorkflowId: 'pending',
        name: data.name,
        schedule: cronExpression,
        topic: 'Custom Workflow', // Placeholder since it's per-day now
        keywords: [],
        tone: data.tone,
        wordCount: data.wordCount,
        scheduleData: data.scheduleData,
        isActive: true,
      } as any,
    });

    try {
      // Create in n8n (re-using existing service)
      const n8nWorkflowId = await createWorkflowInN8n({
        workflowName: data.name,
        cronExpression,
        payload: {
          workflowId: workflow.id,
          userId: user.id,
          siteId: data.siteId,
          topic: workflow.topic,
          keywords: workflow.keywords,
          tone: workflow.tone,
          wordCount: workflow.wordCount,
        },
      });

      await prisma.workflow.update({
        where: { id: workflow.id },
        data: { n8nWorkflowId },
      });

      await toggleWorkflow(n8nWorkflowId, true);

      res.json({ success: true, data: workflow });
    } catch (n8nError) {
      await prisma.workflow.delete({ where: { id: workflow.id } });
      throw n8nError;
    }
  } catch (error: any) {
    console.error('Error creating workflow:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to create workflow' });
  }
});

// Toggle workflow active status
router.patch('/:id/toggle', async (req: RequestWithAuth, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const workflowId = req.params.id;
    const workflow = await prisma.workflow.findFirst({
      where: { id: workflowId, userId: user.id },
    });

    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }

    // Toggle in n8n
    await toggleWorkflow(workflow.n8nWorkflowId, !workflow.isActive);

    // Update in database
    const updated = await prisma.workflow.update({
      where: { id: workflowId },
      data: { isActive: !workflow.isActive },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error toggling workflow:', error);
    res.status(500).json({ success: false, error: 'Failed to toggle workflow' });
  }
});

// Delete workflow
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

    const workflowId = req.params.id;
    const workflow = await prisma.workflow.findFirst({
      where: { id: workflowId, userId: user.id },
    });

    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }

    // Delete from n8n
    await deleteWorkflowFromN8n(workflow.n8nWorkflowId);

    // Delete from database
    await prisma.workflow.delete({ where: { id: workflowId } });

    res.json({ success: true, message: 'Workflow deleted' });
  } catch (error) {
    console.error('Error deleting workflow:', error);
    res.status(500).json({ success: false, error: 'Failed to delete workflow' });
  }
});

// Get single workflow by id
router.get('/:id', async (req: RequestWithAuth, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const workflow = await prisma.workflow.findFirst({
      where: { id: req.params.id, userId: user.id },
      include: { site: { select: { name: true, url: true } } },
    });

    if (!workflow) return res.status(404).json({ success: false, error: 'Workflow not found' });
    res.json({ success: true, data: workflow });
  } catch (error) {
    console.error('Error fetching workflow:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch workflow' });
  }
});

// Update workflow
router.put('/:id', async (req: RequestWithAuth, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const workflow = await prisma.workflow.findFirst({
      where: { id: req.params.id, userId: user.id },
    });
    if (!workflow) return res.status(404).json({ success: false, error: 'Workflow not found' });

    const data = req.body;

    // Rebuild cron
    let cronExpression = workflow.schedule;
    if (data.scheduleData?.type === 'cron') {
      cronExpression = data.scheduleData.cronExpression;
    } else if (data.scheduleData) {
      const dayMap: Record<string, number> = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
      const dayNumbers = data.scheduleData.days?.map((d: string) => dayMap[d]);
      const { generateCronExpression } = await import('../services/n8n.service.js');
      cronExpression = generateCronExpression({
        type: data.scheduleData.type,
        time: data.scheduleData.time,
        days: dayNumbers,
      });
    }

    const updated = await prisma.workflow.update({
      where: { id: req.params.id },
      data: {
        name: data.name ?? workflow.name,
        siteId: data.siteId ?? workflow.siteId,
        schedule: cronExpression,
        tone: data.tone ?? workflow.tone,
        wordCount: data.wordCount ?? workflow.wordCount,
        scheduleData: data.scheduleData ?? (workflow as any).scheduleData,
      } as any,
    });

    res.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('Error updating workflow:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to update workflow' });
  }
});



// Update schedule data of a workflow
router.put('/:id/schedule', async (req: RequestWithAuth, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const workflow = await prisma.workflow.findFirst({
      where: { id: req.params.id, userId },
    });

    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }

    const { scheduleData } = req.body;

    const updated = await prisma.workflow.update({
      where: { id: req.params.id },
      data: {
        scheduleData: scheduleData,
      },
    });

    res.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('Error updating workflow schedule:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/generate-plan', async (req: RequestWithAuth, res) => {
  try {
    console.log('generate-plan request body:', req.body);
    const { name, count, tone = 'Professional', language = 'English', wordCount = 1000 } = req.body;
    if (!name) return res.status(400).json({ success: false, error: 'Name is required' });
    const countNum = Number(count);
    const safeCount = Number.isInteger(countNum) && countNum > 0 ? countNum : 7;
    const plan = await generateWorkflowPlan({ userId: req.auth?.userId, workflowName: name, count: safeCount, tone, language, wordCount });
    res.json({ success: true, data: plan });
  } catch (error: any) {
    console.error('Error generating plan:', error);
    console.error(error.stack);
    res.status(500).json({ success: false, error: error.message || 'Failed to generate plan', stack: error.stack });
  }
});

// Generate description for a workflow
router.post('/generate-description', async (req: RequestWithAuth, res) => {
  try {
    const {
      title,
      keywords = [],
      categories = '',
      tags = '',
      wordCount = 1000,
      tone = 'Professional',
      language = 'English',
      descriptionFormat = 'articleBody',
    } = req.body;
    if (!title) return res.status(400).json({ success: false, error: 'Title is required' });
    // Use Groq to generate a professional description with headings and respect tone/language
    const description = await generateDescription({ userId: req.auth?.userId, title, keywords, categories, tags, wordCount, tone, language, descriptionFormat });
    res.json({ success: true, data: { description } });
  } catch (error: any) {
    console.error('Error generating description:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to generate description' });
  }
});

export { router as workflowsRouter };
