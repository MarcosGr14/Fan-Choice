# Estado del proyecto — Fan Choice

> Estado comprobado el 25 de noviembre de 2026. Git y el estado de los servicios se contrastaron con sus paneles; no se consultaron datos de aplicación en producción. Esta instantánea incorpora el commit de producto `9b0fd64`; el commit documental que la contiene aparece después en el historial.

## Git

- **Rama:** `main`.
- **Commit de producto revisado:** `9b0fd64cd9238b09ba9cb0db42d2861db3a43752` — `feat(ui): refine rankings and label banner artists`.
- **Remoto:** `origin` → `https://github.com/MarcosGr14/Fan-Choice.git`.
- **Sincronización al preparar esta instantánea:** `origin/main` estaba en `c64211a6b08d639ed8fec13f193959c24150e319`; el commit de producto `9b0fd64` estaba listo para publicar. La actualización de documentación se registra en el commit siguiente.
- **Archivos ignorados:** solo `node_modules/` y `dist/`, dependencias y salida regenerable del build. No se encontraron dumps, temporales, copias de seguridad locales ni archivos de entorno en el listado ignorado.
- **Railway antes de publicar `9b0fd64`:** servicio `Fan-Choice`, entorno `production`, estado **Deployment successful**. El despliegue por GitHub mostraba el commit anterior, título `fix: improve ranking readability and weekly artist vote`; la UI no expuso el SHA. URL: `fan-choice-production.up.railway.app`; región EU West; una réplica.
- **Supabase:** proyecto “Ranking League” (`qhbnkhoyxffuskkuekeb`), estado **Healthy**, base principal en `us-east-1`, tamaño Nano. El panel muestra “No migrations” y “No backups”. No se ejecutó SQL ni se inspeccionaron tablas o registros.
- **Despliegue:** Railway está confirmado como el servicio activo visto en el panel. Cloudflare Pages permanece como configuración del repositorio, sin evidencia de que publique actualmente esta aplicación.

## Comprobaciones ejecutadas

En el checkout local, el 25-11-2026:

- `npm test` — **99 aprobadas, 0 fallidas** (33 motor de puntuación, 9 servicios, 13 votos periódicos y 44 integración API; además pasan las comprobaciones de regresión previas del runner).
- `npm run lint` — **correcto** (`tsc --noEmit`).
- `npm run build` — **correcto**, transformó 2.081 módulos y generó `dist/`.
- `git diff --check` — correcto.

El build imprime advertencias de compatibilidad de `configLoader: 'native'` sobre `__dirname`, extensiones de importación e índices de carpetas. No impidieron completar el build; quedan como mantenimiento técnico, no como fallo de compilación.

## Estado conocido del código

El commit `9b0fd64` incluye los nombres de las imágenes del carrusel en el orden indicado por el usuario, el favicon como marca de navegación, mejor legibilidad responsive del ranking y el contador, y el README público del producto. Su commit base `c64211a` añadió los arreglos de contraste de la selección diaria, el Top 3 y los solistas al Mega Voto, además de versionar los recursos PWA.

## Pendiente de confirmar

1. **Despliegue del último push:** confirmar en Railway que se completó la implementación automática de `9b0fd64` después de publicarlo.
2. **Esquema Supabase y migraciones:** el resumen del dashboard dice “No migrations”. No se comprobó si el esquema se creó/aplicó manualmente o si la app puede usar las tablas requeridas. Revisar el historial de migraciones y el esquema en modo lectura antes de cualquier cambio; no se consultaron filas ni temporada activa.
3. **Backups:** el panel indica “No backups”; confirmar si existe un respaldo administrado fuera de Supabase. No se inició ni modificó una política de backup.
4. **Revisión visual:** la comprobación visual local del ranking en la sesión anterior fue defectuosa. Falta revisar de forma fiable ranking desktop/móvil y el voto diario guardado en ambos temas, incluyendo nombres largos.
5. **PWA en dispositivos:** el código contiene manifest, iconos PNG de 48/192/512 y service worker con cache versionada; falta probar actualización de instalación existente e instalación nueva en dispositivos reales.
6. **Dependencia AI:** `@google/genai` figura en `package.json`; el uso activo no quedó confirmado en esta auditoría.

## Próximos pasos sugeridos

1. Confirmar el SHA exacto de Railway y revisar el esquema Supabase en modo lectura, en particular por la ausencia de migraciones registradas.
2. Confirmar la estrategia de backups sin cambiar configuración de producción.
3. Completar QA visual desktop/móvil y prueba PWA.
4. Decidir si se elimina o se integra `@google/genai` solo después de comprobar su uso y necesidad.

No cambiar puntuaciones, estado de temporada ni datos para resolver estos pendientes de documentación/verificación.
