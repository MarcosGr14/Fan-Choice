# K-pop / J-pop Rankings League

## Uso local

```bash
npm install
npm run dev
```

Abre http://localhost:3000. Este comando sirve la interfaz y la API juntas y carga Supabase antes de aceptar peticiones. No necesitas iniciar la API por separado.

La interfaz usa datos reales: rankings, catálogo, votos, usuarios y archivo. Inicia sesión con `marcos` o `jackie` y la contraseña que configuraste. Los votos se guardan por usuario, categoría y día de America/Panama; puedes modificarlos hasta medianoche. Debes elegir cinco artistas distintos.

Marcos puede sincronizar reproducciones, añadir artistas, cerrar temporadas y crear la siguiente. El cierre requiere escribir `FREEZE_SEASON` y guarda los resultados históricos en una transacción. La siguiente temporada debe comenzar después del último día de la anterior para evitar contar las mismas reproducciones dos veces.

## Supabase y Railway

Configura `.env` a partir de `.env.example`:

- `DATABASE_URL`: conexión PostgreSQL de Supabase.
- `JWT_SECRET`: secreto propio de esta liga.
- `USE_MOCK_LISTENING_DATA=false`: usa la integración real.
- `SPOTIFY_DUO_CHARTS_API_URL`: origen del proyecto Spotify Duo Charts en Railway.
- `SPOTIFY_DUO_CHARTS_API_SECRET`: token de integración de ese proyecto.

La integración utiliza los SQL originales de `db/migrations` y `db/seeds`; esta actualización no requiere volver a ejecutarlos. Los resultados congelados se guardan en `season_results` y la copia completa del archivo en `audit_log`.

Al iniciar, el servidor importa los días pendientes desde el comienzo de la temporada activa. Cada 15 minutos recupera días pendientes y actualiza los últimos tres días por posibles reproducciones tardías. Repetir una importación reemplaza los conteos del día; no los suma. El proceso también actualiza las imágenes que entregue Railway. Los artistas sin imagen usan un marcador neutro.

Solo puntúan los artistas del catálogo aprobado. La sincronización manual informa qué artistas del proveedor quedaron fuera del catálogo. Un administrador puede añadirlos con su ID de Spotify y su clasificación; la elegibilidad empieza ese día.

Para reimportar todos los días de la temporada activa:

```bash
npm run import:history
```

La tarea automática requiere que este servidor permanezca encendido. Si se apaga, recupera los días pendientes al volver a arrancar. Para funcionar permanentemente debe desplegarse este proyecto en un servidor; tener Spotify Duo Charts en Railway no mantiene encendida esta aplicación local.

## Contraseñas

Ambos usuarios ya tienen contraseña configurada. Para cambiarlas después:

```bash
npx tsx src/scripts/setPassword.ts marcos
npx tsx src/scripts/setPassword.ts jackie
```

Los comandos solicitan la contraseña de forma interactiva. No escribas contraseñas en archivos del proyecto.

## Producción

```bash
npm run build
npm start
```

Sirve interfaz y API juntas, por defecto en el puerto 3001. Configura `PORT` en el alojamiento. `DATABASE_URL` y `JWT_SECRET` son obligatorios en producción. `npm run api` sirve solo la API en desarrollo; `npm run preview` solo sirve la interfaz compilada.

Si la interfaz y API están en dominios distintos, configura `VITE_API_BASE_URL=https://tu-api-de-la-liga.example/api/v1` antes de compilar. Esa URL corresponde a esta liga, no a Spotify Duo Charts. Nunca incluyas secretos en variables `VITE_`.

Las instancias actualizan su estado desde Postgres y serializan las operaciones mediante un bloqueo transaccional compartido. Esta estrategia está pensada para esta liga pequeña de dos participantes.

## Verificación

```bash
npm run lint
npm test
npm run build
```

Las pruebas habituales usan memoria y proveedor simulado. Para probar el ciclo completo con PostgreSQL local desechable:

```bash
docker run --rm -d --name league-functional-test -p 127.0.0.1:55439:5432 -e POSTGRES_HOST_AUTH_METHOD=trust -e POSTGRES_DB=league_test ankane/pgvector:latest
npx tsx src/scripts/testPostgres.ts
docker stop league-functional-test
```

`testPostgres.ts` fuerza esa conexión local y reconstruye su esquema de pruebas; nunca toma `DATABASE_URL` de `.env`. Comprueba usuarios, permisos, votos, imágenes, artistas, reinicios, cierre transaccional y temporadas nuevas.

## Histórico del año y catálogo aprobado

La pestaña **Histórico** muestra las reproducciones del año de los artistas aprobados del catálogo. Presenta totales del catálogo sin duplicar colaboraciones, desglose por cuenta y ranking por artista. Una colaboración acredita un stream a cada artista; la suma de filas puede superar el total de escuchas únicas.

Las consultas envían `artist_ids` al servidor de Duo Charts: no se descarga el catálogo completo de ese proyecto. La respuesta filtrada se conserva en `lifetime_listening_snapshot` y se renueva cada 15 minutos. Una respuesta fallida no elimina la copia anterior. El administrador puede pulsar **Actualizar histórico**.

Para una instalación nueva aplica `db/migrations/002_lifetime_listening.sql`; ya está aplicada en esta instalación. `npm run import:lifetime` actualiza el resumen anual filtrado. `npm run import:history` importa el desglose diario de la temporada y recalcula los rankings. Son dos vistas de las mismas escuchas: el resumen anual no se suma otra vez encima de los bonus diarios.

## Temporada inaugural e importación del año

La temporada 1 incluye las reproducciones registradas desde el **1 de enero de 2026**. Se importa el desglose diario y se aplica el bonus habitual a cada día (1–2 streams: 1 punto; 3–5: 2; 6–9: 3; 10–15: 4; 16+: 5). No se convierte cada stream en un punto ni se suma un total histórico encima de datos ya importados. Reimportar reemplaza los conteos del rango y no duplica puntos.

La migración `003_inaugural_year.sql` ajusta únicamente la temporada inaugural activa y la elegibilidad de sus 29 artistas originales. Las temporadas posteriores comienzan desde su propia fecha, con votos y puntajes en cero.

Duo Charts recibe los IDs del catálogo aprobado tanto en las consultas diarias como en las históricas. La pestaña Histórico muestra solo las escuchas del año de esos artistas; no se descargan ni se guardan los demás. Al añadir un artista desde Administración, las siguientes consultas lo incluyen. Su elegibilidad comienza en la fecha del alta.
