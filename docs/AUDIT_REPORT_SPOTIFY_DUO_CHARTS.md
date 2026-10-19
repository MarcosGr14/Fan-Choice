# AUDITORÍA TÉCNICA SPOTIFY DUO CHARTS PARA K-POP / J-POP RANKINGS LEAGUE

> **Fecha:** 2026-10-18  
> **Estado:** COMPLETADA (FASE 0)  
> **Repositorio Auditado:** `/home/marcos/Documentos/PROYECTOS/MUSIC/spotify-duo-charts`  
> **Rama:** `main`

---

## 1. Resumen Ejecutivo

La integración de datos entre **Spotify Duo Charts** y la nueva **K-pop / J-pop Rankings League** es técnicamente **viable y confiable**.

- **Puntos Fuertes Identificados:**
  1. Identificadores canónicos únicos garantizados (`artistas.spotify_artist_id`, `canciones.spotify_track_id`).
  2. Timestamps oficiales en UTC (`reproducido_en TIMESTAMPTZ`) provenientes directamente del payload `played_at` de Spotify.
  3. Soporte para temas en colaboración mediante la tabla asociativa `cancion_artistas`.
  4. Deduplicación estricta a nivel de base de datos mediante el índice único `idx_reproduccion_unica (usuario_id, cancion_id, reproducido_en)` y cláusula `ON CONFLICT DO NOTHING`.
  5. Zona horaria de referencia estandarizada en `America/Panama` (UTC-5 fijo, sin DST).

- **Necesidad Identificada:**
  Ningún endpoint público actual expone las reproducciones agregadas por artista y fecha con el `spotify_artist_id` canónico y desglose por usuario. Se implementa un endpoint de sólo lectura protegido con token: `GET /api/integrations/daily-artist-streams`.

---

## 2. Inventario de Modelo de Datos

| Entidad | Tabla | Clave Primaria | Identificador Spotify | Propósito |
| :--- | :--- | :--- | :--- | :--- |
| Cuentas de Usuario | `usuarios_spotify` | `id SERIAL` | `spotify_user_id` | Almacena tokens y perfiles de los dos participantes. |
| Artistas | `artistas` | `id SERIAL` | `spotify_artist_id` | Catálogo de artistas. Imagen completada asíncronamente. |
| Álbumes | `albumes` | `id SERIAL` | `spotify_album_id` | Catálogo de álbumes. |
| Canciones | `canciones` | `id SERIAL` | `spotify_track_id` | Catálogo de tracks. |
| Acreditación | `cancion_artistas` | `(cancion_id, artista_id)` | N/A | Relación N:M. `es_principal = true` para el artista index 0. |
| Historial Real | `reproducciones` | `id BIGSERIAL` | N/A | Hecho inmutable. Cada stream con `played_at`. |
| Estado en Vivo | `reproduccion_actual`| `usuario_id` | N/A | Snapshot temporal de widget currently-playing. |

---

## 3. Flujo de Captura y Ciclos de Polling

1. **Worker de Historial Real (`pollRecentlyPlayed`):**
   - Ejecutado cada 5 minutos (`INTERVALO_HISTORIAL_MS = 300,000`).
   - Endpoint Spotify: `GET /v1/me/player/recently-played?limit=50`.
   - Inserción idempotente con `ON CONFLICT (usuario_id, cancion_id, reproducido_en) DO NOTHING`.
2. **Worker de Enriquecimiento de Imágenes (`completarImagenesDeArtistas`):**
   - Lotes de 15 artistas sin imagen por ciclo.
   - Endpoint Spotify: `GET /v1/artists/{id}`.
3. **Worker de Estado en Vivo (`pollCurrentlyPlaying`):**
   - Cada 20 segundos (`INTERVALO_CURRENTLY_MS = 20,000`).
   - Endpoint Spotify: `GET /v1/me/player/currently-playing`. Solo actualiza `reproduccion_actual`.

---

## 4. Diseño del Endpoint de Integración (Fase 1)

### Especificación:
- **Ruta:** `GET /api/integrations/daily-artist-streams`
- **Seguridad:** Cabecera `x-integration-token: <INTEGRATION_API_KEY>`.
- **Query Params:** `?date=YYYY-MM-DD` (validado con regex ISO).
- **Zona Horaria:** Proyección a `America/Panama`.
- **Naturaleza:** 100% de sólo lectura. No inserta, modifica ni bloquea registros.
- **Payload de Respuesta:**
  ```json
  {
    "success": true,
    "date": "2026-10-18",
    "timezone": "America/Panama",
    "synced_at": "2026-10-18T05:22:00.000Z",
    "accounts": [
      { "id": 1, "spotify_user_id": "...", "display_name": "Marcos" },
      { "id": 2, "spotify_user_id": "...", "display_name": "Jackie" }
    ],
    "records": [
      {
        "spotify_artist_id": "3Nrfpe0tUJi4K4DXYWgMUX",
        "artist_name": "BTS",
        "image_url": "https://...",
        "account_1_streams": 4,
        "account_2_streams": 2,
        "combined_streams": 6
      }
    ]
  }
  ```
