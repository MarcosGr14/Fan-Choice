# Estado funcional — 18 de octubre de 2026

Los faltantes identificados en la primera auditoría se implementaron:

- La interfaz consume la API real y ya no importa datos de demostración.
- Inicio/cierre de sesión, restauración de sesión y controles por rol.
- Top 5 por usuario y categoría, validación de duplicados, fecha de Panamá, persistencia y recálculo inmediato.
- Rankings, catálogo e historial leídos de Supabase.
- Alta de artistas y temporadas con UUID y validación de campos.
- Cierre transaccional: estado de temporada, bloqueo de votos, resultados por artista y copia histórica completa. Un fallo intermedio revierte la operación.
- Archivo histórico restaurado desde Postgres tras reiniciar.
- Importación inicial y manual del historial de la temporada activa; recuperación automática de días pendientes y actualización cada 15 minutos.
- Imágenes de artistas actualizadas desde la integración; se retiraron los retratos ficticios de respaldo.
- Recarga y bloqueo compartido por instancia para evitar que una copia de memoria obsoleta sobrescriba otra.
- La producción exige base de datos y secreto propios; no cae silenciosamente en una liga demo.

## Datos reales verificados

Supabase contiene 29 artistas y los usuarios Marcos y Jackie, ambos con hash de contraseña configurado. La temporada comienza el 18 de octubre de 2026. La importación de ese día guardó inicialmente 8 artistas con 16 reproducciones; los conteos pueden seguir cambiando conforme se escucha música.

Railway también devolvió a DeVita y Soulja Boy, que no están en el catálogo aprobado. No se añadieron automáticamente ni se inventó su clasificación. El panel administrativo permite incorporar artistas y la sincronización informa las exclusiones. La importación del historial se limita a la temporada activa; las reproducciones anteriores no cuentan en sus rankings.

No se crearon votos de prueba ni se cerró la temporada real. Las pruebas de escritura y cierre se hicieron en una base PostgreSQL local independiente. Las únicas escrituras reales de esta tarea son estadísticas, imágenes aportadas por el proveedor y registros de sincronización.

## Validación

- Suite general: 71 aserciones, además de pruebas de regresión de persistencia y proveedor.
- Pruebas PostgreSQL: autenticación, permisos, guardado y recuperación tras reiniciar, sincronización idempotente, imágenes, alta de artistas, cierre y restauración del archivo, nueva temporada y rollback ante fallo de cierre.
- Navegador: login administrativo, Top 5 guardado, papeleta recuperada tras recarga, panel administrativo y logout en la base local de pruebas.
- Interfaz real revisada con catálogo y puntos de Supabase.
- TypeScript y compilación de producción.

## Operación

Usa `npm run dev` y http://localhost:3000. La sincronización automática funciona mientras el servidor está encendido y recupera los días pendientes al arrancar. El despliegue permanente de esta aplicación es independiente del proyecto Spotify Duo Charts ya alojado en Railway.

Los rankings activos se calculan a partir de votos y estadísticas persistidas; `daily_scores` no es su fuente de lectura. Los resultados de temporadas cerradas se conservan como snapshots, sin recalcularlos cuando cambia el catálogo.

## Histórico integrado — actualización final

Se publicó el endpoint histórico protegido en Duo Charts (commit `96935c7`) y Railway confirmó despliegue correcto. La consulta remota devuelve HTTP 200. La migración 002 se aplicó a Supabase y se guardó el snapshot histórico: 5.736 reproducciones, 350 artistas, primera reproducción registrada el 12 de agosto de 2026 (cifras de la comprobación, seguirán cambiando).

La pestaña Histórico presenta totales del dúo sin duplicar colaboraciones, desglose por cuenta, búsqueda, paginación y filtro del catálogo. El histórico se actualiza automáticamente y no participa en los puntos de temporada. La copia previa se conserva si falla el proveedor. Se validó la persistencia tras reinicio y la independencia de los rankings.

Validación: 46 pruebas de Duo Charts; 71 de la liga y regresiones adicionales; 36 comprobaciones de ciclo completo PostgreSQL. TypeScript y compilación correctos. También se corrigió el bloqueo de una petición que se desconecta mientras espera su turno de acceso al estado compartido.

## Temporada 1 con el año completo y filtro obligatorio de la liga

Se aplicó la política solicitada: la temporada inaugural activa comienza el 1 de enero de 2026 y sus 29 artistas originales son elegibles desde esa fecha. Se importó el desglose diario completo y se calcularon los bonus por día; no se sumó dos veces el snapshot histórico. Las siguientes temporadas conservan su fecha de inicio propia y comienzan en cero.

Duo Charts filtra en SQL por los IDs enviados desde el catálogo aprobado. El nuevo endpoint de rango permite descargar únicamente las filas necesarias en una petición. Los conteos del rango y sus marcas de sincronización se reemplazan transaccionalmente. Las consultas históricas se filtran también por año y catálogo, incluidos sus totales globales: no se transfieren ni guardan artistas externos. La interfaz ya no ofrece ver el catálogo completo de Duo Charts.

Comprobación inicial: 29 artistas, 60 días con registros, 4.507 escuchas únicas del catálogo y 4.541 créditos por artista (una colaboración acredita a más de uno). Los bonus diarios suman 1.807 puntos. Estos números pueden aumentar con nuevas escuchas.

Despliegue de origen: `dd57c29`, confirmado en Railway. Migración local: `003_inaugural_year.sql`, aplicada en Supabase. Pruebas: 47 en Duo Charts, 71 generales en la liga y 39 comprobaciones PostgreSQL, incluyendo backfill idempotente, bonus diarios y temporada siguiente con cero puntos. TypeScript y build correctos.
