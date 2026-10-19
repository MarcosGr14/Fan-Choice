# GUÍA DE INTEGRACIÓN — ENDPOINT SEGURO EN SPOTIFY DUO CHARTS

> **Destino:** Repositorio de Spotify Duo Charts (`/home/marcos/Documentos/PROYECTOS/MUSIC/spotify-duo-charts`)  
> **Objetivo:** Exponer datos diarios de escucha agregados por artista de forma 100% de sólo lectura, segura y aislada.  
> **Garantía de Seguridad:** 0 escrituras, 0 migraciones en la base de datos de producción, 0 impacto en el polling ni en los endpoints existentes.

---

## 1. Archivo Nuevo: `src/integrationsApi.js`

Crea este archivo en `spotify-duo-charts/src/integrationsApi.js`:

```javascript
const express = require('express');
const Sentry = require('@sentry/node');
const db = require('./db');
const { ZONA_HORARIA, INTEGRATION_TOKEN } = require('./config');
const { describirError } = require('./errorUtils');

const router = express.Router();

// Middleware de autenticación segura
function verificarTokenIntegracion(req, res, next) {
  if (!INTEGRATION_TOKEN) {
    console.warn('[integrationsApi] AVISO: INTEGRATION_TOKEN no configurado en entorno.');
    return next();
  }

  const tokenHeader = req.headers['x-integration-token'];
  const authHeader = req.headers['authorization'];
  const bearerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const tokenProporcionado = tokenHeader || bearerToken;

  if (!tokenProporcionado || tokenProporcionado !== INTEGRATION_TOKEN) {
    return res.status(401).json({
      error: 'Acceso no autorizado: Token de integración inválido o ausente.'
    });
  }

  next();
}

router.use(verificarTokenIntegracion);

// GET /api/integrations/health
router.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    module: 'spotify-duo-charts-integration',
    timezone: ZONA_HORARIA,
    timestamp: new Date().toISOString()
  });
});

function obtenerFechaLocalHoy(zonaHoraria) {
  const formateador = new Intl.DateTimeFormat('en-CA', {
    timeZone: zonaHoraria,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formateador.format(new Date());
}

// Consulta SQL de sólo lectura optimizada
const SQL_DAILY_ARTIST_STREAMS = `
  WITH rango_dia AS (
    SELECT 
      ($1::date::timestamp AT TIME ZONE $2) AS inicio,
      (($1::date + 1)::timestamp AT TIME ZONE $2) AS fin
  ),
  cuentas AS (
    SELECT id, spotify_user_id, nombre_display, ROW_NUMBER() OVER (ORDER BY id) AS pos
    FROM usuarios_spotify
    ORDER BY id
    LIMIT 2
  ),
  reproducciones_filtradas AS (
    SELECT 
      r.usuario_id,
      ca.artista_id
    FROM reproducciones r
    JOIN rango_dia rd ON r.reproducido_en >= rd.inicio AND r.reproducido_en < rd.fin
    JOIN cancion_artistas ca ON ca.cancion_id = r.cancion_id
  )
  SELECT 
    ar.spotify_artist_id,
    ar.nombre AS artista_nombre,
    ar.imagen_url,
    COUNT(CASE WHEN rf.usuario_id = (SELECT id FROM cuentas WHERE pos = 1) THEN 1 END)::int AS account_1_streams,
    COUNT(CASE WHEN rf.usuario_id = (SELECT id FROM cuentas WHERE pos = 2) THEN 1 END)::int AS account_2_streams,
    COUNT(*)::int AS combined_streams
  FROM reproducciones_filtradas rf
  JOIN artistas ar ON ar.id = rf.artista_id
  GROUP BY ar.id, ar.spotify_artist_id, ar.nombre, ar.imagen_url
  ORDER BY combined_streams DESC, ar.nombre ASC;
`;

async function obtenerStreamsDiariosPorArtista(fecha, zonaHoraria, database = db) {
  const [resultadoStreams, resultadoCuentas] = await Promise.all([
    database.query(SQL_DAILY_ARTIST_STREAMS, [fecha, zonaHoraria]),
    database.query(
      'SELECT id, spotify_user_id, nombre_display, necesita_reconexion FROM usuarios_spotify ORDER BY id LIMIT 2'
    )
  ]);

  return {
    accounts: resultadoCuentas.rows,
    rows: resultadoStreams.rows
  };
}

// GET /api/integrations/daily-artist-streams?date=YYYY-MM-DD
router.get('/daily-artist-streams', async (req, res) => {
  const fechaParam = req.query.date;
  let fecha = fechaParam;

  if (fechaParam) {
    if (!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(fechaParam)) {
      return res.status(400).json({
        error: 'Formato de fecha inválido. Debe ser YYYY-MM-DD.'
      });
    }
  } else {
    fecha = obtenerFechaLocalHoy(ZONA_HORARIA);
  }

  try {
    const { accounts, rows } = await obtenerStreamsDiariosPorArtista(fecha, ZONA_HORARIA);

    const records = rows.map((r) => ({
      spotify_artist_id: r.spotify_artist_id,
      artist_name: r.artista_nombre,
      image_url: r.imagen_url,
      competition_date: fecha,
      account_1_streams: r.account_1_streams,
      account_2_streams: r.account_2_streams,
      combined_streams: r.combined_streams
    }));

    res.status(200).json({
      success: true,
      date: fecha,
      timezone: ZONA_HORARIA,
      synced_at: new Date().toISOString(),
      accounts: accounts.map((u) => ({
        id: u.id,
        spotify_user_id: u.spotify_user_id,
        nombre_display: u.nombre_display,
        necesita_reconexion: u.necesita_reconexion
      })),
      total_records: records.length,
      records
    });
  } catch (err) {
    console.error('Error en /api/integrations/daily-artist-streams:', describirError(err));
    Sentry.captureException(err, { tags: { ruta: '/api/integrations/daily-artist-streams' } });
    res.status(500).json({
      error: 'No se pudieron consultar las estadísticas de escucha por artista.'
    });
  }
});

module.exports = {
  router,
  obtenerStreamsDiariosPorArtista,
  SQL_DAILY_ARTIST_STREAMS
};
```

---

## 2. Modificación Quirúrgica en `src/config.js`

En `src/config.js`, agrega `INTEGRATION_TOKEN`:

```javascript
module.exports = {
  PORT: process.env.PORT || 3000,
  DATABASE_URL: process.env.DATABASE_URL,
  SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET,
  SPOTIFY_REDIRECT_URI: process.env.SPOTIFY_REDIRECT_URI,
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
  INTERVALO_CURRENTLY_MS: 20 * 1000,
  INTERVALO_HISTORIAL_MS: 5 * 60 * 1000,
  ZONA_HORARIA: process.env.ZONA_HORARIA || 'America/Panama',
  INTEGRATION_TOKEN: process.env.INTEGRATION_TOKEN || process.env.DUO_CHARTS_INTEGRATION_TOKEN
};
```

---

## 3. Montaje en `src/index.js`

En `src/index.js`, añade estas dos líneas:

```javascript
const integrationsApiRouter = require('./integrationsApi');

// justo después de app.use('/api', chartsApiRouter);
app.use('/api/integrations', integrationsApiRouter);
```

---

## 4. Variables de Entorno en Host (Railway)

En las variables de entorno de tu servicio Railway de Spotify Duo Charts:
```bash
INTEGRATION_TOKEN="un_token_secreto_y_seguro_generado_aqui"
```

Y en el `.env` de la nueva Liga K-pop / J-pop:
```bash
USE_MOCK_LISTENING_DATA=false
SPOTIFY_DUO_CHARTS_API_URL="https://tu-duo-charts.up.railway.app"
SPOTIFY_DUO_CHARTS_API_SECRET="un_token_secreto_y_seguro_generado_aqui"
```
