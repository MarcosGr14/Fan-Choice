// ==============================================================================
// K-POP / J-POP RANKINGS LEAGUE: CONFIGURATION MANAGER
// ==============================================================================

import dotenv from 'dotenv';
dotenv.config();

const DEFAULT_JWT_SECRET = 'league_super_secret_jwt_signing_key_32_bytes_min';
const NODE_ENV = process.env.NODE_ENV || 'development';

// En producción es obligatorio definir JWT_SECRET: con el valor por defecto
// (que está escrito en el código) cualquiera podría fabricar tokens válidos.
if (NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET es obligatorio en producción. Defínelo en las variables de entorno.');
}

if (NODE_ENV === 'production' && !process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL es obligatorio en producción.');
}

export const CONFIG = {
  APP_DISPLAY_NAME: process.env.APP_DISPLAY_NAME || 'Fan Choice Most Populars',
  PORT: parseInt(process.env.API_PORT || process.env.PORT || '3001', 10),
  NODE_ENV,
  LEAGUE_TIMEZONE: process.env.LEAGUE_TIMEZONE || 'America/Panama',
  DATABASE_URL: process.env.DATABASE_URL || '',
  JWT_SECRET: process.env.JWT_SECRET || DEFAULT_JWT_SECRET,
  JWT_SECRET_IS_DEFAULT: !process.env.JWT_SECRET,
  JWT_EXPIRES_IN_SECONDS: 7 * 24 * 3600, // 7 days
  USE_MOCK_LISTENING_DATA: process.env.USE_MOCK_LISTENING_DATA !== 'false',
  SPOTIFY_DUO_CHARTS_API_URL: process.env.SPOTIFY_DUO_CHARTS_API_URL || 'http://127.0.0.1:3000',
  SPOTIFY_DUO_CHARTS_API_SECRET: process.env.SPOTIFY_DUO_CHARTS_API_SECRET || '',
  PARTICIPANT_1_NAME: process.env.PARTICIPANT_1_NAME || 'Alex',
  PARTICIPANT_1_USERNAME: process.env.PARTICIPANT_1_USERNAME || 'alex',
  PARTICIPANT_2_NAME: process.env.PARTICIPANT_2_NAME || 'Sam',
  PARTICIPANT_2_USERNAME: process.env.PARTICIPANT_2_USERNAME || 'sam',
};