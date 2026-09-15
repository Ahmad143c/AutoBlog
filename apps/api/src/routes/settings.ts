import { Router } from 'express';
import Groq from 'groq-sdk';
import { prisma } from '../lib/prisma.js';
import { encrypt, decrypt } from '../lib/crypto.js';

const GROQ_MODEL = process.env.GROQ_MODEL || 'qwen/qwen3.8-27b';
import type { RequestWithAuth } from '../types.js';

const router: Router = Router();

function maskGroqKey(apiKey: string) {
  return apiKey.length > 12
    ? `${apiKey.substring(0, 8)}...${apiKey.slice(-4)}`
    : 'gsk_****...****';
}

async function testGroqKey(apiKey: string) {
  const groq = new Groq({ apiKey });
  await groq.chat.completions.create({
    model: GROQ_MODEL,
    messages: [{ role: 'user', content: 'Say OK' }],
    max_tokens: 5,
  });
}

router.get('/groq-key', async (req: RequestWithAuth, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { groqApiKey: true },
    });

    if (!user?.groqApiKey) {
      return res.json({ success: true, data: { hasKey: false, maskedKey: null } });
    }

    let actualKey: string | null = null;
    try {
      actualKey = decrypt(user.groqApiKey);
    } catch (error) {
      console.warn('Failed to decrypt stored Groq API key metadata:', error);
    }

    res.json({
      success: true,
      data: {
        hasKey: true,
        maskedKey: actualKey ? maskGroqKey(actualKey) : 'gsk_****...****',
      },
    });
  } catch (error: any) {
    console.error('Failed to load Groq API key settings:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to load Groq API key' });
  }
});

router.post('/groq-key/test', async (req: RequestWithAuth, res) => {
  const { apiKey } = req.body;

  if (!apiKey || typeof apiKey !== 'string' || !apiKey.startsWith('gsk_')) {
    return res.status(400).json({
      success: false,
      error: "Invalid key format. Groq API keys start with 'gsk_'",
    });
  }

  try {
    await testGroqKey(apiKey);
    res.json({
      success: true,
      data: { valid: true, message: 'Key is valid and working.' },
    });
  } catch (error: any) {
    const message = String(error?.message || '');
    const isAuthError =
      error?.status === 401 ||
      message.toLowerCase().includes('invalid api key') ||
      message.toLowerCase().includes('unauthorized');

    res.json({
      success: true,
      data: {
        valid: false,
        message: isAuthError
          ? 'Invalid API key. Please check and try again.'
          : `Key test failed: ${message || 'Unknown error'}`,
      },
    });
  }
});

router.put('/groq-key', async (req: RequestWithAuth, res) => {
  const userId = req.auth?.userId;
  const { apiKey } = req.body;

  if (!userId) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  if (!apiKey || typeof apiKey !== 'string' || !apiKey.startsWith('gsk_')) {
    return res.status(400).json({
      success: false,
      error: "Invalid key format. Groq API keys start with 'gsk_'",
    });
  }

  try {
    await testGroqKey(apiKey);

    await prisma.user.update({
      where: { id: userId },
      data: { groqApiKey: encrypt(apiKey) },
    });

    res.json({
      success: true,
      data: {
        maskedKey: maskGroqKey(apiKey),
        message: 'API key saved successfully.',
      },
    });
  } catch (error: any) {
    const isAuthError = error?.status === 401;
    res.status(isAuthError ? 400 : 500).json({
      success: false,
      error: isAuthError
        ? 'Invalid API key. Could not authenticate with Groq.'
        : error.message || 'Failed to save Groq API key',
    });
  }
});

router.delete('/groq-key', async (req: RequestWithAuth, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { groqApiKey: null },
    });

    res.json({
      success: true,
      data: { message: 'API key removed. System key will be used.' },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to remove Groq API key' });
  }
});

export { router as settingsRouter };
