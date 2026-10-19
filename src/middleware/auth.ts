// ==============================================================================
// K-POP / J-POP RANKINGS LEAGUE: AUTHENTICATION & RBAC MIDDLEWARE
// ==============================================================================

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { leagueStore } from '../repositories/leagueStore';
import { CONFIG } from '../config';
import { ParticipantRole } from '../types';

export interface AuthUserPayload {
  id: string;
  username: string;
  displayName: string;
  role: ParticipantRole;
  avatarUrl?: string;
  exp: number;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUserPayload;
}

/**
 * Generates an HMAC SHA-256 signed JWT-style token using native crypto.
 */
export function generateAuthToken(
  user: { id: string; username: string; displayName: string; role: ParticipantRole; avatarUrl?: string },
  expiresInSeconds: number = CONFIG.JWT_EXPIRES_IN_SECONDS
): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload: AuthUserPayload = {
    ...user,
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
  };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createHmac('sha256', CONFIG.JWT_SECRET)
    .update(dataToSign)
    .digest('base64url');

  return `${dataToSign}.${signature}`;
}

/**
 * Validates token signature and expiration.
 */
export function verifyAuthToken(token: string): AuthUserPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, signature] = parts;
    const dataToSign = `${encodedHeader}.${encodedPayload}`;

    const expectedSignature = crypto
      .createHmac('sha256', CONFIG.JWT_SECRET)
      .update(dataToSign)
      .digest('base64url');

    const actual = Buffer.from(signature);
    const expected = Buffer.from(expectedSignature);
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;

    const payload: AuthUserPayload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8')
    );

    const now = Math.floor(Date.now() / 1000);
    if (!Number.isFinite(payload.exp) || payload.exp <= now) {
      return null; // Expired
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Express middleware to authenticate requests.
 */
export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : (req.headers['x-auth-token'] as string);

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Autenticación requerida: Token ausente.',
    });
  }

  const payload = verifyAuthToken(token);
  if (!payload) {
    return res.status(401).json({
      success: false,
      error: 'Token inválido o expirado.',
    });
  }

  const participant = leagueStore.getParticipantById(payload.id);
  if (!participant) return res.status(401).json({ success: false, error: 'La cuenta ya no está disponible.' });
  req.user = { id: participant.id, username: participant.username, displayName: participant.displayName, role: participant.role, exp: payload.exp };
  next();
}

/**
 * Express guard middleware requiring role = 'admin'.
 */
export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Acceso denegado: se requieren privilegios de administrador.',
    });
  }
  next();
}
