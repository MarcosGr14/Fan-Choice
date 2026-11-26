# Changelog — Fan Choice

Cambios notables ordenados del más reciente al más antiguo. Las referencias son commits reales del historial de Git; no se asignan versiones de producto.

## 2026-11-25 — `9b0fd64`

### Cambiado

- El carrusel de inicio identifica las siete fotos con sus artistas en el orden confirmado por el usuario.
- El logo de navegación usa el icono FCA existente.
- Aumentada la legibilidad del ranking y alineado el contador de voto para pantallas pequeñas.
- README convertido en una descripción pública del producto, sus reglas y su stack.

### Verificación registrada

- 99 pruebas, TypeScript y build de producción pasaron localmente el 25-11-2026.

## 2026-11-25 — `c64211a`

### Corregido

- Mejor legibilidad de nombres y datos del Top 3 en el ranking de escritorio.
- El voto diario guardado usa superficies y texto del tema activo.
- El Mega Voto semanal de artistas admite solistas aprobados y elegibles, además de grupos.
- Versionadas las URLs de iconos y manifest; actualizado el nombre de caché del service worker.

### Verificación registrada

- 99 pruebas, TypeScript y build de producción pasaron en el checkout local el 25-11-2026. La revisión visual local anterior no fue concluyente.

## 2026-11-25 — `62d9fe3`

### Añadido y cambiado

- Carrusel de inicio con siete banners WebP proporcionados por el usuario.
- Actualización de los iconos PWA/favicon.
- Ajustes visuales de la página de inicio y del ranking.

## 2026-11-24 — `4dd1c93`

### Cambiado

- Avance del rediseño visual de Fan Choice, aplicado a la navegación, rankings, idols, votaciones periódicas y estilos adaptables.

## 2026-11-23 — `cdf3bb7`

### Cambiado

- Inicio rediseñado con presentación de temporada y tarjetas de líderes.

## 2026-11-23 — `68e588d`

### Añadido

- Mega Voto semanal y votaciones mensuales para artistas e idols, con persistencia y migración `005_periodic_voting.sql`.
- Manifest, iconos, registro de service worker y mensajes de error de interfaz.

## 2026-11-23 — `8f21714`

### Añadido y cambiado

- Incorporación de idols solicitados al catálogo.
- Resultados de idols Top 10 en el archivo de temporadas cerradas.

## 2026-11-23 — `02e731c`

### Añadido

- Retratos locales adicionales para idols.

## 2026-10-20 — `63e4329`

### Añadido

- Lote de retratos optimizados para 155 idols.

## 2026-10-20 — `3c1af7b`

### Añadido

- Clasificación y votos de idols por temporada, con persistencia y migración `004_idol_voting.sql`.

## 2026-10-19 — `e7f6ff8`

### Mejorado

- Carga de interfaz, reutilización de histórico y renderizado; añadidos skeletons de carga.

## 2026-10-19 — `89af4af`

### Añadido

- Confirmación de votos guardados y reloj para la siguiente votación diaria.

## 2026-10-19 — `f34b32f`

### Cambiado

- Presentación de fotos de artistas en color y selección de categoría del ranking.

## 2026-10-19 — `a27d7b0`

### Cambiado

- El contenedor de Railway sirve la interfaz compilada junto con la API.

## 2026-10-18 — `6ed81f9`

### Inicial

- Preparación del repositorio para GitHub y configuraciones de despliegue para Cloudflare Pages y Railway.
- Esquema inicial PostgreSQL, migraciones base, contrato de API y documentación de arquitectura y puntuación.

## Nota histórica

Los commits de merge y limpieza se omiten cuando no representan un cambio funcional. Los títulos y fechas se obtuvieron de `git log`; las descripciones se contrastaron con los archivos modificados en los commits citados.
