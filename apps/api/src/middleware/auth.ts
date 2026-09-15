import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { RequestWithAuth } from '../types.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export const requireAuth = (req: RequestWithAuth, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };

    req.auth = {
      userId: decoded.userId,
      sessionClaims: { email: decoded.email },
    };

    next();
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Invalid token' });
  }
};
