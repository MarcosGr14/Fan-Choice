# Fan Choice Awards

<p align="center">
  <img src="src/assets/images/fan-choice-banner-01.webp" alt="TWICE en el carrusel de Fan Choice Awards" width="100%" />
</p>

<p align="center"><strong>La música la eligen sus fans.</strong><br />Una plataforma de votación y rankings para artistas e idols de K-pop y J-pop.</p>

<p align="center">
  <a href="https://fan-choice-production.up.railway.app">Abrir Fan Choice Awards</a>
  · Panamá · K-pop · J-pop
</p>

---

## El producto

Fan Choice Awards convierte la participación de los fans en una competencia musical por temporadas. Reúne votos diarios y especiales, posiciones de ranking y reproducciones en una experiencia web adaptable a computadoras y celulares.

Cada temporada mantiene clasificaciones independientes para artistas hombres, artistas mujeres e idols. Los resultados de una temporada cerrada se conservan en el archivo para consultar sus ganadores y rankings.

## Qué ofrece

- **Votación diaria de artistas:** de 5 a 10 artistas por categoría. En idols, de 10 a 25.
- **Mega Voto semanal:** de 10 a 15 artistas y de 10 a 25 idols por categoría, con una puntuación especial para el primer lugar.
- **Favorito mensual:** un artista favorito por categoría y selecciones de bias y bias wrecker para idols.
- **Rankings de temporada:** Top 10 de hombres y mujeres, ranking independiente de idols y reconocimiento al campeón absoluto de artistas.
- **Estadísticas musicales:** reproducciones integradas en la puntuación de artistas y vistas de actividad e historial.
- **Archivo de temporadas:** resultados preservados al cierre, incluidos los rankings de idols.
- **Experiencia adaptable:** temas claro y oscuro, navegación responsive e instalación como aplicación web progresiva (PWA).

## Cómo se forman los rankings

### Artistas

Los votos diarios otorgan **5, 4, 3, 2 y 1 puntos** en los primeros cinco puestos. Los puestos del 6 al 10 suman **1 punto** cada uno. Las reproducciones sincronizadas también suman un bonus diario escalonado. Los votos especiales semanales y mensuales contribuyen a la clasificación de la temporada.

### Idols

Los rankings de idols se calculan por separado de los artistas y de Spotify. Las selecciones iniciales de favoritos, los votos diarios y las votaciones especiales semanales y mensuales aportan puntos a la clasificación de cada categoría. En el voto diario, los puestos del 1 al 10 reciben de **10 a 1 punto** y los puestos del 11 al 25 suman **1 punto** cada uno.

### Votaciones especiales

| Votación | Selección por categoría | Puntuación |
| --- | --- | --- |
| Mega Voto semanal · artistas | 10–15 | 25 al #1, 15 del #2 al #10 y 10 del #11 al #15 |
| Mega Voto semanal · idols | 10–25 | 50 al #1, 20 del #2 al #10 y 8 del #11 al #25 |
| Favorito mensual · artistas | 1 artista | 50 puntos |
| Bias del mes · idols | Bias y bias wrecker | 75 y 50 puntos, respectivamente |

Los periodos siguen el calendario de Panamá: los votos semanales comienzan los lunes y los mensuales el primer día de cada mes.

## Identidad

La interfaz conserva la marca Fan Choice con una dirección visual moderna y editorial, paleta **Tinta + Volt**, tipografías Onest y Unbounded, imágenes de artistas y microinteracciones discretas.

## Tecnologías

| Área | Tecnologías |
| --- | --- |
| Interfaz web | React 19, TypeScript, Vite 8, Tailwind CSS 4 |
| Componentes y movimiento | Motion, Lucide React |
| API y lógica de negocio | Node.js 24, Express 4, API REST |
| Persistencia | PostgreSQL en Supabase |
| Datos de reproducciones | Integración de Spotify mediante Duo Charts |
| Servicio web | Railway |
| Aplicación instalable | Web App Manifest y Service Worker |

---

<p align="center"><sub>Fan Choice Awards · Panamá · K-pop & J-pop</sub></p>
