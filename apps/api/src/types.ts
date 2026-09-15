import type { Request } from 'express';

export interface RequestWithAuth extends Request {
  auth?: {
    userId: string;
    sessionClaims?: Record<string, unknown>;
  };
}
