// ==============================================================================
// K-POP / J-POP RANKINGS LEAGUE: AUTHENTICATION CONTROLLER
// ==============================================================================

import { Request, Response } from 'express';
import { leagueStore } from '../repositories/leagueStore';
import { generateAuthToken, AuthenticatedRequest } from '../middleware/auth';
import { hashPassword, verifyPassword } from '../services/passwordHash';

// Hash de relleno: se verifica contra él cuando el usuario no existe, para que
// la respuesta tarde lo mismo y no se pueda adivinar qué usuarios existen.
let dummyHash: string | null = null;
function getDummyHash(): string {
  if (!dummyHash) dummyHash = hashPassword('relleno-no-es-una-contrasena-real');
  return dummyHash;
}

export async function login(req: Request, res: Response) {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      error: 'Se requiere nombre de usuario y contraseña.',
    });
  }

  const participant = leagueStore.getParticipantByUsername(String(username));
  let passwordOk = false;
  if (participant) {
    passwordOk = verifyPassword(String(password), participant.passwordHash);
  } else {
    verifyPassword(String(password), getDummyHash()); // solo para igualar tiempos
  }

  if (!participant || !passwordOk) {
    return res.status(401).json({
      success: false,
      error: 'Credenciales inválidas.',
    });
  }

  const token = generateAuthToken({
    id: participant.id,
    username: participant.username,
    displayName: participant.displayName,
    role: participant.role,
    avatarUrl: participant.avatarUrl,
  });

  return res.status(200).json({
    success: true,
    token,
    user: {
      id: participant.id,
      username: participant.username,
      displayName: participant.displayName,
      role: participant.role,
      avatarUrl: participant.avatarUrl,
    },
  });
}

export async function getMe(req: AuthenticatedRequest, res: Response) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'No autenticado.' });
  }

  const participant = leagueStore.getParticipantById(req.user.id);
  if (!participant) {
    return res.status(404).json({ success: false, error: 'Usuario no encontrado.' });
  }

  return res.status(200).json({
    success: true,
    user: {
      id: participant.id,
      username: participant.username,
      displayName: participant.displayName,
      role: participant.role,
      avatarUrl: participant.avatarUrl,
    },
  });
}