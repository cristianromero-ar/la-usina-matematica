# La Usina Matemática

**Laboratorio de Situaciones Didácticas y Recursos para la Enseñanza de la Matemática**
Prof. Cristian Romero

Sitio web profesional para la difusión de recursos de Didáctica de la Matemática: juegos interactivos, propuestas didácticas, laboratorio de ideas, repositorio y producción académica.

---

## Cómo ver el sitio

Es un sitio estático (HTML + CSS + JS puro, sin backend). Para verlo:

1. Abrí `index.html` directamente en el navegador, **o**
2. Subilo a cualquier hosting estático (GitHub Pages, Netlify, Railway, Vercel)

No necesita `npm install` ni servidor — funciona con solo abrir el archivo.

---

## Estructura del proyecto

```
usina-matematica/
├── index.html              → Página principal con todas las secciones
├── escoba-del-uno.html     → Juego "La Escoba del Uno" (recurso interactivo)
├── assets/
│   ├── css/
│   │   ├── main.css        → Sistema de diseño: variables, navbar, hero, layout
│   │   └── components.css  → Tarjetas de juegos, laboratorio, propuestas, etc.
│   ├── js/
│   │   └── main.js         → Toda la lógica: navegación, modo oscuro, buscador,
│   │                          filtros, animaciones, formulario
│   └── img/                → (vacío) — agregar acá imágenes reales de los juegos
├── pages/                  → (vacío) — ver sección "Próximos pasos" abajo
└── README.md
```

---

## Características implementadas

- ✅ Diseño responsive (computadora, tablet, celular)
- ✅ Modo claro / modo oscuro (con persistencia en `localStorage` y detección de preferencia del sistema)
- ✅ Menú con scroll suave y resaltado de sección activa
- ✅ Buscador interno que indexa juegos, laboratorio, propuestas e investigación
- ✅ Sistema de filtros por nivel educativo (juegos) y tabs (propuestas)
- ✅ Animaciones de entrada al hacer scroll (Intersection Observer)
- ✅ Contador animado de estadísticas en el hero
- ✅ Formulario de contacto con validación (simulado — ver sección siguiente)
- ✅ Botón "volver arriba"
- ✅ Barra de anuncios descartable
- ✅ Accesibilidad básica: `aria-label`, navegación por teclado, respeto a `prefers-reduced-motion`

---

## Cómo modificar y agregar contenido

### Agregar un nuevo juego

En `index.html`, dentro de `<div class="games-grid">`, copiar un bloque `<article class="game-card">` existente y modificar:

```html
<article class="game-card" data-level="primario secundario" data-tags="tema1 tema2" data-search="palabras clave para buscador">
  <div class="game-img" style="--game-color:#TUCOLOR">
    <div class="game-icon-wrap"><span class="game-emoji">🎯</span></div>
    <div class="game-level-badge">Tu Nivel</div>
  </div>
  <div class="game-body">
    <h3 class="game-title">Nombre del juego</h3>
    <p class="game-desc">Descripción breve...</p>
    <div class="game-meta">
      <div class="meta-item"><strong>Contenidos:</strong> ...</div>
      <div class="meta-item"><strong>Intención didáctica:</strong> ...</div>
    </div>
    <div class="game-tags"><span class="tag">Tag1</span></div>
    <a href="archivo-del-juego.html" class="btn btn-primary btn-sm game-btn">Jugar</a>
  </div>
</article>
```

- `data-level`: usado por los filtros (valores: `primario`, `secundario`, `superior`, o combinaciones separadas por espacio)
- `data-search`: palabras que el buscador interno va a indexar

### Agregar una propuesta didáctica

Buscar el panel correspondiente al nivel (`data-panel="primario"`, etc.) dentro de `.proposals-container` y copiar un bloque `<article class="proposal-card">`.

### Cambiar colores / identidad visual

Todos los colores están centralizados como variables CSS en `assets/css/main.css`, sección **1. VARIABLES Y TOKENS**. Cambiar ahí se propaga a todo el sitio, incluido el modo oscuro (que tiene su propio set de variables bajo `[data-theme="dark"]`).

---

## Próximos pasos pendientes (no incluidos en esta entrega)

El sitio define 6 enlaces "Ver todos / Ver más" en las secciones de Juegos, Laboratorio, Propuestas, Repositorio e Investigación. **Por ahora estos enlaces redirigen a la misma sección dentro de `index.html`** (no rompen nada, pero tampoco llevan a contenido nuevo). Para expandir el sitio:

1. Crear `pages/juegos.html`, `pages/laboratorio.html`, `pages/propuestas.html`, `pages/repositorio.html`, `pages/investigacion.html` — páginas dedicadas con el listado completo de cada categoría
2. Actualizar los `href` correspondientes en `index.html` (están comentados con `<!-- Ver todos -->` para ubicarlos fácilmente)
3. Reusar `assets/css/main.css` y `assets/css/components.css` en esas páginas para mantener consistencia visual

El formulario de contacto actualmente **simula** el envío (no llega ningún email real). Para que funcione de verdad, conectar `assets/js/main.js` (función `ContactForm`) con un servicio como Formspree, EmailJS, o un backend propio.

Las imágenes de juegos hoy son emojis sobre fondos de color — se pueden reemplazar por capturas reales agregándolas a `assets/img/` y cambiando `<span class="game-emoji">` por `<img src="assets/img/nombre.jpg">`.

---

## Despliegue en GitHub + Railway

Este es un sitio estático, así que el despliegue es más simple que un proyecto con backend:

### GitHub Pages (más simple, gratis, sin Railway)
1. Subir esta carpeta a un repositorio de GitHub
2. Ir a **Settings → Pages**
3. En "Source" elegir la rama `main` y carpeta `/ (root)`
4. GitHub da una URL pública en 1-2 minutos

### Railway
1. Subir el repositorio a GitHub (igual que arriba)
2. En Railway: **New Project → Deploy from GitHub repo**
3. Como no hay `package.json` ni servidor, Railway puede pedir que se especifique un **Static Site** o se agregue un comando de inicio simple. Si pide un Start Command, usar cualquier servidor estático, por ejemplo agregando este `package.json` mínimo en la raíz:
   ```json
   {
     "scripts": { "start": "npx serve -s . -l $PORT" }
   }
   ```
4. Generar dominio público desde **Settings → Networking**

---

*Prof. Cristian Romero — La Usina Matemática*
