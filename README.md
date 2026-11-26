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

- **Votación diaria de artistas:** cada participante ordena un Top 5 para cada categoría.
- **Mega Voto semanal:** Top 10 de artistas y Top 10 de idols por categoría, con una puntuación especial para el primer lugar.
- **Favorito mensual:** un artista favorito por categoría y selecciones de bias y bias wrecker para idols.
- **Rankings de temporada:** Top 10 de hombres y mujeres, ranking independiente de idols y reconocimiento al campeón absoluto de artistas.
- **Estadísticas musicales:** reproducciones integradas en la puntuación de artistas y vistas de actividad e historial.
- **Archivo de temporadas:** resultados preservados al cierre, incluidos los rankings de idols.
- **Experiencia adaptable:** temas claro y oscuro, navegación responsive e instalación como aplicación web progresiva (PWA).

## Cómo se forman los rankings

### Artistas

Los votos diarios otorgan **5, 4, 3, 2 y 1 puntos** según la posición del Top 5. Las reproducciones sincronizadas también suman un bonus diario escalonado. Los votos especiales semanales y mensuales contribuyen a la clasificación de la temporada.

### Idols

Los rankings de idols se calculan por separado de los artistas y de Spotify. Las selecciones iniciales de favoritos, los votos diarios y las votaciones especiales semanales y mensuales aportan puntos al Top 10 de cada categoría.

### Votaciones especiales

| Votación | Selección por categoría | Puntuación |
| --- | --- | --- |
| Mega Voto semanal · artistas | Top 10 | 25 puntos al primer lugar; 15 a cada posición restante |
| Mega Voto semanal · idols | Top 10 | 50 puntos al primer lugar; 20 a cada posición restante |
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
