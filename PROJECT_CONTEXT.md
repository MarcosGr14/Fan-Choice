# Contexto del proyecto — Fan Choice

> Documento de continuidad basado en código, configuración, Git y paneles de producción revisados el 25 de noviembre de 2026.

## 1. Propósito

Fan Choice es una aplicación de premios para artistas de K-pop y J-pop. Reúne votaciones diarias y periódicas, rankings de artistas e idols, estadísticas de reproducciones y resultados por temporada. Las temporadas cerradas conservan un archivo de sus resultados.

## 2. Reglas y protección de datos

- Mantener separados los rankings de artistas hombres y mujeres, y los rankings de idols.
- Conservar los votos, temporadas cerradas y resultados históricos. No reiniciar, truncar ni borrar datos como parte de cambios ordinarios.
- Aplicar en servidor las reglas de cantidad, categoría, elegibilidad y periodo; no confiar solo en la interfaz.
- Antes de cambiar elegibilidad, puntuación, cierre de temporada o persistencia, revisar conjuntamente servicio, controlador, repositorio y pruebas.
- Las migraciones vigentes están en `db/migrations/` y son SQL explícito. No ejecutar una migración contra datos reales sin entender su efecto y contar con autorización y recuperación verificable.

## 3. Funcionalidad comprobada en el código

- Voto diario de Top 5 por categoría de artistas.
- Rankings de artistas hombres y mujeres, y rankings independientes de idols.
- Puntuación de artistas con votos y datos de reproducciones/bonos, calculada en `src/engine/scoringEngine.ts`.
- Archivo de temporadas con resultados congelados; el cierre y el registro de auditoría se gestionan desde los servicios y la persistencia.
- Votaciones periódicas semanales y mensuales para artistas e idols. Las reglas están en `src/services/periodicVoting.ts` y `src/services/idolService.ts`, con validación de servidor en sus controladores.
- Catálogo curado de artistas y catálogo estático de idols; hay recursos locales de retratos en `public/images/idols/`.
- Estadísticas diarias y un histórico de reproducciones obtenidos mediante el proveedor Duo Charts de Spotify.
- Administración autenticada para temporadas, catálogo de artistas y sincronización.
- Tema claro/oscuro, carrusel de imágenes, iconos, manifest y service worker para PWA.

La presencia de la funcionalidad en el código no demuestra por sí sola su estado, configuración o datos en producción.

## 4. Arquitectura y tecnologías verificadas

### Interfaz

- React 19, TypeScript y Vite 8.
- Tailwind CSS 4 mediante `@tailwindcss/vite`; estilos propios concentrados en `src/index.css`.
- Motion para animaciones y Lucide React para iconos.
- Fuentes cargadas en `index.html`: Onest y Unbounded.
- Colores y temas definidos como variables CSS en `src/index.css`; el tema oscuro usa fondo `#0e0e12` y acento Volt `#c8ff2e`.
- `src/services/apiClient.ts` consume `/api/v1` por defecto; `VITE_API_BASE_URL` permite configurar una API separada.

### API y reglas de negocio

- Node.js 24, Express 4 y API REST bajo `/api/v1`.
- `src/server.ts` registra seguridad, salud, rutas API y sirve `dist/` en producción cuando frontend y API corren juntos.
- Las rutas pasan por controladores (`src/controllers/`), reglas/servicios (`src/services/`) y `LeagueStore` (`src/repositories/leagueStore.ts`).
- `LeagueStore` mantiene estado de trabajo en memoria; al iniciar puede hidratarlo desde Postgres y persiste cambios por la capa `PostgresPersistence`.
- Autenticación JWT y controles administrativos en `src/middleware/`; hay limitación de peticiones en rutas sensibles.

### Base de datos e integraciones

- PostgreSQL se conecta directamente mediante `pg` y `DATABASE_URL`. La documentación y el historial identifican Supabase como el proveedor usado para Postgres; el repositorio no declara el SDK `supabase-js`.
- Migraciones: `001_initial_schema.sql` a `005_periodic_voting.sql` en `db/migrations/`.
- Duo Charts se integra mediante `src/services/spotifyDuoProvider.ts`; el servicio de sincronización y los formatos se encuentran en `syncService.ts`, `rangeSync.ts` y `lifetimeService.ts`.
- El paquete `@google/genai` aparece como dependencia, pero su uso funcional no se confirmó en este recorrido. No asumir que exista una integración activa por el solo hecho de estar instalado.

### Despliegue comprobado

El repositorio contiene dos configuraciones compatibles:

1. **Railway en un solo servicio:** `railway.toml` usa `Dockerfile`; el contenedor compila Vite y ejecuta Express, que puede servir `dist/`. El health check es `/health`.
2. **Cloudflare Pages para la interfaz + API externa:** `wrangler.jsonc` publica `dist/`; en build de Pages, `vite.config.ts` exige `VITE_API_BASE_URL` con la URL de API esperada en Railway.

La revisión de los paneles confirma que **Railway es el proveedor frontend/API activo**. El servicio Fan-Choice en el entorno `production` muestra una implementación exitosa, desplegada desde GitHub, con el título `fix: improve ranking readability and weekly artist vote`, coincidente con el commit local `c64211a`. El panel mostró la URL pública `fan-choice-production.up.railway.app`, región EU West y una réplica. El panel no mostró el SHA del despliegue, así que la coincidencia exacta por hash no está confirmada.

Cloudflare Pages sigue configurado en el repositorio como opción para la interfaz; no se encontró evidencia de que esté sirviendo la aplicación activa.

### Supabase comprobado

Se accedió al dashboard del proyecto **Ranking League** (`qhbnkhoyxffuskkuekeb`). El estado mostrado es **Healthy**; el recurso Primary Database aparece en `us-east-1` (East US / North Virginia), tamaño Nano. El resumen del panel indica “No migrations” y “No backups”. Esto describe el estado que reporta el dashboard, pero no confirma por sí solo el esquema real, las filas, la temporada activa ni si se aplicaron manualmente scripts SQL fuera del registro de migraciones. No se consultaron tablas ni se ejecutó SQL.

## 5. Identidad visual

- Dirección aprobada: identidad de Fan Choice con tratamiento moderno, elegante y minimalista, conservando la paleta Tinta + Volt.
- Tipografías actuales verificadas: Onest y Unbounded.
- Hay temas claro y oscuro.
- El carrusel de inicio usa imágenes locales optimizadas en WebP. Los iconos instalables PNG son 48×48, 192×192 y 512×512.
- Las vistas de voto, Mega Voto, idols y Spotify Stats habían sido aprobadas previamente; los arreglos posteriores solicitados explícitamente para contraste de voto y catálogo semanal sí podían afectar esas vistas.

## 6. Instrucciones de trabajo

- El usuario proporcionó instrucciones globales de trabajo en la conversación. En la inspección del 25-11-2026 no se encontró un `AGENTS.md` en este repositorio ni en sus directorios padres inmediatos; si aparece uno más adelante, revisarlo y aplicarlo.
- Leer los documentos de continuidad y comprobar el código y el estado de Git antes de cambios sustanciales.
- Preferir cambios pequeños; no alterar funciones ajenas al pedido.
- Ejecutar las comprobaciones disponibles que correspondan y distinguir claramente pruebas locales de validación de producción.
- No hacer push, despliegues, ni operaciones destructivas salvo autorización explícita.
- Nunca incluir secretos o valores de variables de entorno en documentos, logs o respuestas.

## 7. Documentos de continuidad

- `PROJECT_CONTEXT.md`: propósito, invariantes y arquitectura comprobada.
- `PROJECT_STATUS.md`: rama, commit, comprobaciones y pendientes a la última revisión.
- `CHANGELOG.md`: hitos respaldados por commits del repositorio.
