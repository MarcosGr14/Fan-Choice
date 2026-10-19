// ==============================================================================
// K-POP / J-POP RANKINGS LEAGUE: ASIGNAR CONTRASEÑA A UN PARTICIPANTE
// ==============================================================================
// Uso:  npx tsx src/scripts/setPassword.ts marcos
// La contraseña se escribe en la terminal sin mostrarse: no pasa por el chat,
// ni por el historial del shell, ni por ningún archivo.

import pg from 'pg';
import { CONFIG } from '../config';
import { hashPassword } from '../services/passwordHash';

const MIN_LENGTH = 10;

function askHidden(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    if (!stdin.isTTY) {
      reject(new Error('Este script necesita una terminal interactiva.'));
      return;
    }
    process.stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    let input = '';
    const cleanup = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener('data', onData);
    };
    const onData = (chunk: string) => {
      for (const c of chunk) {
        if (c === '\r' || c === '\n') {
          cleanup();
          process.stdout.write('\n');
          resolve(input);
          return;
        }
        if (c === '\u0003') {
          cleanup();
          process.stdout.write('\n');
          reject(new Error('Cancelado.'));
          return;
        }
        if (c === '\u007f' || c === '\b') {
          input = input.slice(0, -1);
        } else {
          input += c;
        }
      }
    };
    stdin.on('data', onData);
  });
}

async function main() {
  const username = (process.argv[2] || '').trim().toLowerCase();
  if (!username) {
    console.error('Uso: npx tsx src/scripts/setPassword.ts <usuario>   (ejemplo: marcos)');
    process.exit(1);
  }
  if (!CONFIG.DATABASE_URL) {
    console.error('Falta DATABASE_URL en el .env.');
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString: CONFIG.DATABASE_URL });
  try {
    const found = await pool.query('SELECT id, display_name FROM participants WHERE username = $1', [username]);
    if (!found.rows.length) {
      console.error(`No existe el participante "${username}" en la base de datos.`);
      process.exit(1);
    }

    const password = await askHidden(`Nueva contraseña para ${found.rows[0].display_name} (mínimo ${MIN_LENGTH} caracteres): `);
    if (password.length < MIN_LENGTH) {
      console.error(`La contraseña debe tener al menos ${MIN_LENGTH} caracteres.`);
      process.exit(1);
    }
    const confirm = await askHidden('Repite la contraseña: ');
    if (confirm !== password) {
      console.error('Las contraseñas no coinciden. No se guardó nada.');
      process.exit(1);
    }

    await pool.query('UPDATE participants SET password_hash = $1, updated_at = NOW() WHERE username = $2', [
      hashPassword(password),
      username,
    ]);
    console.log(`✅ Contraseña guardada para "${username}". Reinicia la API para que la tome.`);
  } finally {
    await pool.end();
  }
}

main().catch((err: any) => {
  console.error('Error:', err.message);
  process.exit(1);
});