# Fan Choice Most Populars

Liga musical privada con rankings por temporada. Interfaz React y API Express, desplegadas juntas en Railway; persistencia PostgreSQL en Supabase.

## Desarrollo

Requiere Node.js 24. Copia `.env.example` a `.env` y configura tus credenciales locales.

```bash
npm ci
npm run dev
```

Abre http://localhost:3000. El servidor local incluye la API.

## Base de datos

Las migraciones están en `db/migrations`, numeradas en orden de aplicación. En una instalación existente ejecuta únicamente las pendientes. `004_idol_voting.sql` añade las votaciones de idols. El catálogo inicial de artistas está en `db/seeds`; el de idols, en `src/data/idols.ts`.

## Railway

El repositorio incluye `Dockerfile` y `railway.toml`. Configura estas variables en el servicio:

- `DATABASE_URL`: conexión PostgreSQL.
- `JWT_SECRET`: secreto propio y aleatorio.
- `USE_MOCK_LISTENING_DATA=false`.
- `SPOTIFY_DUO_CHARTS_API_URL`: origen del proveedor de reproducciones.
- `SPOTIFY_DUO_CHARTS_API_SECRET`: token de integración del proveedor.

La aplicación sirve frontend y API en el mismo dominio. Para compilar y arrancar manualmente:

```bash
npm run build
npm start
```

Nunca publiques `.env`, contraseñas ni copias de la base de datos. Las variables `VITE_` son públicas: no deben contener secretos. `.env.example` contiene únicamente valores de ejemplo.

## Rankings

- Artistas: Top 5 diario y bonus por reproducciones del catálogo aprobado.
- Idols: favoritos iniciales de 5 puntos por usuario y temporada; Top 10 diario con 10 a 1 puntos, independiente de Spotify.
- El día de votación usa la zona `America/Panama`.
- El administrador cierra la temporada manualmente. Los idols tienen un ganador por categoría y empiezan desde cero en la siguiente temporada.

## Mantenimiento

```bash
npm run lint
npm test
npm run build
npm run import:history
npm run import:lifetime
```

Las importaciones requieren la conexión y el proveedor configurados. Para cambiar una contraseña, ejecuta `npx tsx src/scripts/setPassword.ts <usuario>`; el comando la solicita de forma interactiva.

Los documentos antiguos se conservan localmente en `.local-notes/`, excluida de Git y del contexto de Docker.
