import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { encryptObject, encrypt } from '../lib/crypto.js';
import { testWordPressConnection } from '../services/wordpress.service.js';
import type { Platform } from '@autoblog/shared';
import type { RequestWithAuth } from '../types.js';

const router: Router = Router();

const createSiteSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  platform: z.enum(['WORDPRESS', 'NEXTJS']),
  credentials: z.object({
    username: z.string().min(1).optional(),
    appPassword: z.string().min(1).optional(),
    cmsType: z.string().optional(),
    apiUrl: z.string().url().optional(),
    apiToken: z.string().optional(),
  }),
  socialPlatforms: z.array(z.object({
    platform: z.enum(['FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'TWITTER', 'THREADS', 'YOUTUBE']),
    credentials: z.record(z.string()),
    accountName: z.string(),
  })).optional(),
});


const testConnectionSchema = z.object({
  url: z.string().url(),
  platform: z.enum(['WORDPRESS', 'NEXTJS']),
  credentials: z.object({
    username: z.string().min(1).optional(),
    appPassword: z.string().min(1).optional(),
    cmsType: z.string().optional(),
    apiUrl: z.string().url().optional(),
    apiToken: z.string().optional(),
  }),
});

// List all sites for user
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

    const sites = await prisma.site.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        socialAccounts: {
          where: { isActive: true },
          select: { platform: true, accountName: true, expiresAt: true }
        },
        _count: { select: { posts: true } }
      }
    });

    const now = new Date();
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(now.getDate() + 7);

    // Don't return credentials, add tokenExpiringSoon
    const sanitized = sites.map(site => {
      let tokenExpiringSoon = false;
      let expiresInDays = 0;
      let expiringPlatform = '';
      
      site.socialAccounts?.forEach(acc => {
        if (acc.expiresAt && acc.expiresAt < sevenDaysFromNow) {
          tokenExpiringSoon = true;
          expiresInDays = Math.max(0, Math.ceil((acc.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
          expiringPlatform = acc.platform;
        }
      });

      return {
        ...site,
        tokenExpiringSoon,
        expiresInDays,
        expiringPlatform,
        credentials: undefined,
      };
    });

    res.json({ success: true, data: sanitized });
  } catch (error) {
    console.error('Error fetching sites:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch sites' });
  }
});

// GET /api/sites/:id — include social accounts
router.get('/:id', async (req: RequestWithAuth, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const site = await prisma.site.findFirst({
      where: { id: req.params.id, userId },
      include: {
        socialAccounts: {
          where: { isActive: true }
        }
      }
    });

    if (!site) {
      return res.status(404).json({ success: false, error: "Site not found" });
    }

    const { decrypt } = await import('../lib/crypto.js');
    const socialAccounts = site.socialAccounts.map(acc => {
      let credentials = {};
      if (acc.credentials) {
        try {
          credentials = JSON.parse(decrypt(acc.credentials as string));
        } catch (e) {
          console.warn(`Failed to decrypt credentials for account ${acc.id}:`, e);
        }
      }
      return {
        id: acc.id,
        platform: acc.platform,
        accountName: acc.accountName,
        createdAt: acc.createdAt,
        credentials
      };
    });

    res.json({
      success: true,
      data: {
        ...site,
        credentials: undefined,
        socialAccounts
      }
    });
  } catch (error) {
    console.error('Error fetching site details:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch site details' });
  }
});


// Get WordPress categories for a site
router.get('/:id/categories', async (req: RequestWithAuth, res) => {
  try {
    const site = await prisma.site.findUnique({ where: { id: req.params.id } });
    if (!site) return res.status(404).json({ success: false, error: "Site not found" });

    if (!site.credentials) {
      // Return empty categories if credentials missing
      return res.json({ success: true, data: [] });
    }

    const { decryptObject } = await import('../lib/crypto.js');
    const credentials = decryptObject(site.credentials as any);
    if (!credentials || !credentials.username || !credentials.appPassword) {
      return res.json({ success: true, data: [] });
    }
    const token = Buffer.from(`${credentials.username}:${credentials.appPassword}`).toString("base64");

    const axios = (await import('axios')).default;
    const response = await axios.get(
      `${site.url}/wp-json/wp/v2/categories?per_page=100`,
      { headers: { Authorization: `Basic ${token}` } }
    );

    res.json({
      success: true,
      data: response.data.map((c: any) => ({ id: c.id, name: c.name })),
    });
  } catch (error: any) {
    console.error('Error fetching categories:', error.message);
    // Return empty categories on error to avoid breaking UI
    res.json({ success: true, data: [] });
  }
});

// Test WordPress connection
router.post('/test', async (req: RequestWithAuth, res) => {
  try {
    const parsed = testConnectionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.message });
    }

    const { url, platform, credentials } = parsed.data;
    
    if (platform === 'WORDPRESS') {
      const { username, appPassword } = credentials;
      if (!username || !appPassword) {
        return res.status(400).json({ success: false, error: 'Username and app password are required for WordPress' });
      }
      const isValid = await testWordPressConnection(url, username, appPassword);

      if (isValid) {
        res.json({ success: true, message: 'Connection successful' });
      } else {
        res.status(400).json({ success: false, error: 'Connection failed. Please check your credentials.' });
      }
    } else if (platform === 'NEXTJS') {
      // Next.js connection testing would go here
      res.json({ success: true, message: 'Next.js connection testing not yet implemented' });
    }
  } catch (error) {
    console.error('Error testing connection:', error);
    res.status(500).json({ success: false, error: 'Failed to test connection' });
  }
});

// Create new site
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

    const parsed = createSiteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.message });
    }

    const data = parsed.data;

    // Validate credentials based on platform
    if (data.platform === 'WORDPRESS') {
      if (!data.credentials.username || !data.credentials.appPassword) {
        return res.status(400).json({ 
          success: false, 
          error: 'Username and app password are required for WordPress' 
        });
      }

      // Test connection for WordPress sites
      const isValid = await testWordPressConnection(
        data.url,
        data.credentials.username,
        data.credentials.appPassword
      );

      if (!isValid) {
        return res.status(400).json({ 
          success: false, 
          error: 'Could not connect to WordPress. Please check your credentials and try again.' 
        });
      }
    } else if (data.platform === 'NEXTJS') {
      if (!data.credentials.cmsType || !data.credentials.apiUrl || !data.credentials.apiToken) {
        return res.status(400).json({ 
          success: false, 
          error: 'CMS type, API URL, and API token are required for Next.js' 
        });
      }
    }

    // Encrypt credentials
    const encryptedCredentials = encryptObject(data.credentials);

    const site = await prisma.site.create({
      data: {
        userId: user.id,
        name: data.name,
        url: data.url,
        platform: data.platform as Platform,
        credentials: encryptedCredentials,
        status: 'ACTIVE',
      },
    });

    // Save social accounts for this site
    if (data.socialPlatforms && data.socialPlatforms.length > 0) {
      for (const social of data.socialPlatforms) {
        try {
          // Validate credentials are not empty
          const hasCredentials = Object.values(social.credentials)
            .some((v: any) => v?.trim());

          if (!hasCredentials) continue;

          let expiresAt = null;
          if (social.platform === 'LINKEDIN') {
            expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 60);
          }

          await prisma.socialAccount.upsert({
            where: {
              siteId_platform: {
                siteId: site.id,
                platform: social.platform as any,
              }
            },
            create: {
              userId: user.id,
              siteId: site.id,
              platform: social.platform as any,
              accountName: social.accountName,
              credentials: encrypt(JSON.stringify(social.credentials)),
              isActive: true,
              expiresAt,
            },
            update: {
              accountName: social.accountName,
              credentials: encrypt(JSON.stringify(social.credentials)),
              isActive: true,
              expiresAt,
            }
          });
        } catch (e) {
          console.warn(`Failed to save ${social.platform} account:`, e);
        }
      }
    }

    // Return site with social accounts
    const siteWithSocial = await prisma.site.findUnique({
      where: { id: site.id },
      include: { socialAccounts: true }
    });

    if (siteWithSocial) {
      siteWithSocial.credentials = undefined as any;
    }

    res.json({ success: true, data: siteWithSocial });
  } catch (error) {
    console.error('Error creating site:', error);
    res.status(500).json({ success: false, error: 'Failed to create site' });
  }
});

// Update site (name, url, and optionally credentials)
router.put('/:id', async (req: RequestWithAuth, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const site = await prisma.site.findFirst({
      where: { id: req.params.id, userId },
    });

    if (!site) {
      return res.status(404).json({ success: false, error: 'Site not found' });
    }

    const { name, url, credentials } = req.body;

    const updateData: any = {};
    if (name) updateData.name = name;
    if (url) updateData.url = url;

    if (credentials && Object.keys(credentials).length > 0) {
      updateData.credentials = encryptObject(credentials);
    }

    const updated = await prisma.site.update({
      where: { id: site.id },
      data: updateData,
    });

    res.json({
      success: true,
      data: { ...updated, credentials: undefined },
    });
  } catch (error) {
    console.error('Error updating site:', error);
    res.status(500).json({ success: false, error: 'Failed to update site' });
  }
});

// Add social accounts to an existing site
router.post('/:id/social', async (req: RequestWithAuth, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const site = await prisma.site.findFirst({
      where: { id: req.params.id, userId },
    });

    if (!site) {
      return res.status(404).json({ success: false, error: 'Site not found' });
    }

    const { socialPlatforms } = req.body;
    if (!socialPlatforms || !Array.isArray(socialPlatforms)) {
      return res.status(400).json({ success: false, error: 'socialPlatforms array is required' });
    }

    const saved = [];
    for (const social of socialPlatforms) {
      try {
        const hasCredentials = Object.values(social.credentials as Record<string, string>)
          .some((v: any) => v?.trim());
        if (!hasCredentials) continue;

        let expiresAt = null;
        if (social.platform === 'LINKEDIN') {
          expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 60);
        }

        const account = await prisma.socialAccount.upsert({
          where: {
            siteId_platform: {
              siteId: site.id,
              platform: social.platform as any,
            }
          },
          create: {
            userId,
            siteId: site.id,
            platform: social.platform as any,
            accountName: social.accountName,
            credentials: encrypt(JSON.stringify(social.credentials)),
            isActive: true,
            expiresAt,
          },
          update: {
            accountName: social.accountName,
            credentials: encrypt(JSON.stringify(social.credentials)),
            isActive: true,
            expiresAt,
          }
        });
        saved.push(account);
      } catch (e) {
        console.warn(`Failed to save ${social.platform} account:`, e);
      }
    }

    res.json({ success: true, data: saved });
  } catch (error) {
    console.error('Error saving social accounts:', error);
    res.status(500).json({ success: false, error: 'Failed to save social accounts' });
  }
});

// Remove a social account from a site
router.delete('/:id/social/:accountId', async (req: RequestWithAuth, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const account = await prisma.socialAccount.findFirst({
      where: { id: req.params.accountId, siteId: req.params.id, userId },
    });

    if (!account) {
      return res.status(404).json({ success: false, error: 'Social account not found' });
    }

    // Delete related SocialShare records first (no cascade defined in schema)
    await prisma.$transaction([
      prisma.socialShare.deleteMany({ where: { socialAccountId: account.id } }),
      prisma.socialAccount.delete({ where: { id: account.id } }),
    ]);

    res.json({ success: true, message: 'Social account removed' });
  } catch (error) {
    console.error('Error removing social account:', error);
    res.status(500).json({ success: false, error: 'Failed to remove social account' });
  }
});

// Delete site
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

    const siteId = req.params.id;
    const site = await prisma.site.findFirst({
      where: { id: siteId, userId: user.id },
    });

    if (!site) {
      return res.status(404).json({ success: false, error: 'Site not found' });
    }
    // Fetch workflows to delete from n8n first
    const workflows = await prisma.workflow.findMany({
      where: { siteId: siteId, userId: user.id }
    });

    // Delete workflows from n8n
    for (const w of workflows) {
      try {
        const { deleteWorkflowFromN8n } = await import('../services/n8n.service.js');
        await deleteWorkflowFromN8n(w.n8nWorkflowId);
      } catch (err) {
        console.warn(`Failed to delete workflow ${w.n8nWorkflowId} from n8n:`, err);
      }
    }

    // Delete all associated data in a transaction
    await prisma.$transaction([
      prisma.socialAccount.deleteMany({ where: { siteId: siteId } }),
      prisma.post.deleteMany({ where: { siteId: siteId } }),
      prisma.workflow.deleteMany({ where: { siteId: siteId } }),
      prisma.site.delete({ where: { id: siteId } }),
    ]);

    res.json({ success: true, message: 'Site disconnected and all associated data deleted' });
  } catch (error) {
    console.error('Error deleting site:', error);
    res.status(500).json({ success: false, error: 'Failed to delete site' });
  }
});

export { router as sitesRouter };

