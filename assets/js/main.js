/**
 * main.js — La Usina Matemática
 * Lógica completa del sitio: navegación, modo oscuro,
 * búsqueda, filtros, animaciones y formulario.
 * Prof. Cristian Romero
 */

'use strict';

/* ============================================================
   1. MODO OSCURO
============================================================ */
const ThemeManager = (() => {
  const html    = document.documentElement;
  const btn     = document.getElementById('themeToggle');
  const KEY     = 'usina-theme';

  function apply(theme) {
    html.setAttribute('data-theme', theme);
    localStorage.setItem(KEY, theme);
  }

  function init() {
    const saved = localStorage.getItem(KEY);
    const sys   = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    apply(saved || sys);

    btn?.addEventListener('click', () => {
      apply(html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    });

    // Seguir cambios del sistema si el usuario no eligió manualmente
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
      if (!localStorage.getItem(KEY)) apply(e.matches ? 'dark' : 'light');
    });
  }

  return { init };
})();

/* ============================================================
   2. NAVBAR: scroll, hamburguesa, active link
============================================================ */
const NavManager = (() => {
  const navbar    = document.getElementById('navbar');
  const hamburger = document.getElementById('hamburger');
  const navMenu   = document.getElementById('navMenu');
  const navLinks  = document.querySelectorAll('.nav-link');

  function onScroll() {
    navbar?.classList.toggle('scrolled', window.scrollY > 20);
    // Back to top
    const btt = document.getElementById('backToTop');
    btt?.classList.toggle('visible', window.scrollY > 400);
  }

  function updateActive() {
    const sections = document.querySelectorAll('section[id]');
    let current = '';
    sections.forEach(sec => {
      const top = sec.offsetTop - 100;
      if (window.scrollY >= top) current = sec.id;
    });
    navLinks.forEach(link => {
      const href = link.getAttribute('href')?.replace('#', '');
      link.classList.toggle('active', href === current);
    });
  }

  function init() {
    window.addEventListener('scroll', () => { onScroll(); updateActive(); }, { passive: true });
    onScroll();

    hamburger?.addEventListener('click', () => {
      const open = navMenu.classList.toggle('mobile-open');
      hamburger.classList.toggle('open', open);
      hamburger.setAttribute('aria-expanded', String(open));
    });

    // Cerrar menú al hacer clic en un link
    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('mobile-open');
        hamburger?.classList.remove('open');
        hamburger?.setAttribute('aria-expanded', 'false');
      });
    });

    // Cerrar con Escape
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        navMenu?.classList.remove('mobile-open');
        hamburger?.classList.remove('open');
      }
    });

    // Back to top
    document.getElementById('backToTop')?.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  return { init };
})();

/* ============================================================
   3. BÚSQUEDA
============================================================ */
const SearchManager = (() => {
  const toggle    = document.getElementById('searchToggle');
  const box       = document.getElementById('searchBox');
  const input     = document.getElementById('searchInput');
  const results   = document.getElementById('searchResults');

  // Índice de búsqueda: todas las tarjetas del sitio
  const buildIndex = () => {
    const items = [];

    // Juegos
    document.querySelectorAll('.game-card').forEach(card => {
      items.push({
        title:   card.querySelector('.game-title')?.textContent?.trim() || '',
        type:    'Juego',
        search:  card.dataset.search || card.textContent.toLowerCase(),
        tags:    card.dataset.tags || '',
        href:    card.querySelector('.game-btn')?.getAttribute('href') || '#juegos',
        section: 'juegos',
      });
    });

    // Laboratorio
    document.querySelectorAll('.lab-card').forEach(card => {
      items.push({
        title:   card.querySelector('h3')?.textContent?.trim() || '',
        type:    card.querySelector('.lab-type')?.textContent?.trim() || 'Laboratorio',
        search:  card.textContent.toLowerCase(),
        href:    '#laboratorio',
        section: 'laboratorio',
      });
    });

    // Propuestas
    document.querySelectorAll('.proposal-card').forEach(card => {
      items.push({
        title:   card.querySelector('h3')?.textContent?.trim() || '',
        type:    'Propuesta — ' + (card.querySelector('.proposal-level')?.textContent?.trim() || ''),
        search:  card.textContent.toLowerCase(),
        href:    '#propuestas',
        section: 'propuestas',
      });
    });

    // Investigación
    document.querySelectorAll('.research-card').forEach(card => {
      items.push({
        title:   card.querySelector('h3')?.textContent?.trim() || '',
        type:    card.querySelector('.research-type')?.textContent?.trim() || 'Investigación',
        search:  card.textContent.toLowerCase(),
        href:    '#investigacion',
        section: 'investigacion',
      });
    });

    return items;
  };

  let index = [];

  // Quita acentos/tildes para que la búsqueda funcione sin importar
  // si el usuario escribe "multiplicacion" o "multiplicación".
  function normalizar(str) {
    return (str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, ''); // elimina marcas diacríticas (tildes, diéresis)
  }

  function renderResults(query) {
    if (!query || query.length < 2) {
      results.innerHTML = '';
      return;
    }
    const q = normalizar(query);
    const found = index.filter(item =>
      normalizar(item.search).includes(q) ||
      normalizar(item.title).includes(q) ||
      normalizar(item.tags || '').includes(q)
    ).slice(0, 8);

    if (found.length === 0) {
      results.innerHTML = `<div class="search-empty">Sin resultados para "<strong>${query}</strong>"</div>`;
      return;
    }

    results.innerHTML = found.map(item => `
      <a href="${item.href}" class="search-result-item">
        <div class="res-title">${item.title}</div>
        <div class="res-type">${item.type}</div>
      </a>
    `).join('');

    // Cerrar al hacer clic en resultado
    results.querySelectorAll('.search-result-item').forEach(el => {
      el.addEventListener('click', () => closeSearch());
    });
  }

  function closeSearch() {
    box?.classList.remove('open');
    input && (input.value = '');
    results && (results.innerHTML = '');
  }

  function init() {
    // Construir índice una vez que el DOM está listo
    index = buildIndex();

    toggle?.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = box?.classList.toggle('open');
      if (isOpen) setTimeout(() => input?.focus(), 50);
    });

    input?.addEventListener('input', e => renderResults(e.target.value));
    input?.addEventListener('keydown', e => { if (e.key === 'Escape') closeSearch(); });

    document.addEventListener('click', e => {
      if (!e.target.closest('.search-wrap')) closeSearch();
    });
  }

  return { init };
})();

/* ============================================================
   4. FILTRO DE JUEGOS
============================================================ */
const GamesFilter = (() => {
  function init() {
    const btns  = document.querySelectorAll('.filter-btn');
    const cards = document.querySelectorAll('.game-card');

    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        btns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const filter = btn.dataset.filter;
        cards.forEach(card => {
          if (filter === 'all') {
            card.classList.remove('hidden');
          } else {
            const levels = card.dataset.level || '';
            card.classList.toggle('hidden', !levels.includes(filter));
          }
        });
      });
    });
  }

  return { init };
})();

/* ============================================================
   4.1 PROPUESTA DIDÁCTICA CURRICULAR (desplegable por tarjeta)
============================================================ */
const CurricularToggle = (() => {
  function init() {
    document.querySelectorAll('.btn-curricular-toggle').forEach(btn => {
      const panel = btn.nextElementSibling;
      if (!panel || !panel.classList.contains('curricular-panel')) return;

      btn.addEventListener('click', () => {
        const isOpen = panel.classList.toggle('open');
        btn.setAttribute('aria-expanded', String(isOpen));
        btn.querySelector('span').textContent = isOpen
          ? 'Ocultar propuesta didáctica curricular'
          : 'Ver propuesta didáctica curricular';
      });
    });
  }

  return { init };
})();

/* ============================================================
   5. TABS DE PROPUESTAS
============================================================ */
const ProposalsTabs = (() => {
  function init() {
    const tabs   = document.querySelectorAll('.level-tab');
    const panels = document.querySelectorAll('.proposals-panel');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        panels.forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        const target = document.querySelector(`.proposals-panel[data-panel="${tab.dataset.level}"]`);
        target?.classList.add('active');
      });
    });
  }

  return { init };
})();

/* ============================================================
   6. ANIMACIONES DE ENTRADA (Intersection Observer)
============================================================ */
const RevealAnimations = (() => {
  function init() {
    // Agregar clase reveal a los elementos a animar
    const selectors = [
      '.game-card', '.lab-card', '.proposal-card',
      '.repo-cat-card', '.research-card', '.profile-card',
      '.section-header', '.contact-info', '.contact-form',
      '.hero-badge', '.hero-stats',
    ];

    const elements = [];
    selectors.forEach(sel => {
      document.querySelectorAll(sel).forEach((el, i) => {
        el.classList.add('reveal');
        if (i % 4 === 1) el.classList.add('reveal-delay-1');
        if (i % 4 === 2) el.classList.add('reveal-delay-2');
        if (i % 4 === 3) el.classList.add('reveal-delay-3');
        elements.push(el);
      });
    });

    // rootMargin generoso: dispara apenas el elemento se acerca al viewport,
    // no solo cuando ya está bien adentro — evita que saltos de scroll
    // (anchor links, recargas con #hash) dejen elementos sin revelar.
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0, rootMargin: '200px 0px 200px 0px' });

    elements.forEach(el => observer.observe(el));

    // FAILSAFE: si por cualquier motivo (scroll instantáneo, hash en la URL,
    // error del observer) un elemento queda sin revelarse, forzarlo visible
    // a los 2.5s para que nunca quede contenido invisible de forma permanente.
    setTimeout(() => {
      elements.forEach(el => {
        if (!el.classList.contains('visible')) el.classList.add('visible');
      });
    }, 2500);
  }

  return { init };
})();

/* ============================================================
   7. CONTADOR ANIMADO DE ESTADÍSTICAS
============================================================ */
const StatsCounter = (() => {
  function animateNumber(el, target, duration = 1500) {
    const start = performance.now();
    const update = (time) => {
      const progress = Math.min((time - start) / duration, 1);
      // Easing out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(eased * target);
      if (progress < 1) requestAnimationFrame(update);
    };
    requestAnimationFrame(update);
  }

  function init() {
    const stats = document.querySelectorAll('.stat-num[data-target]');
    if (!stats.length) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target;
          animateNumber(el, parseInt(el.dataset.target));
          observer.unobserve(el);
        }
      });
    }, { threshold: 0.5 });

    stats.forEach(el => observer.observe(el));
  }

  return { init };
})();

/* ============================================================
   8. FORMULARIO DE CONTACTO
============================================================ */
const ContactForm = (() => {
  function init() {
    const form = document.getElementById('contactForm');
    const msg  = document.getElementById('formMsg');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = form.querySelector('button[type="submit"]');

      // Validación básica
      const nombre  = form.nombre?.value.trim();
      const email   = form.email?.value.trim();
      const mensaje = form.mensaje?.value.trim();

      if (!nombre || !email || !mensaje) {
        showMsg('Por favor completá todos los campos requeridos.', 'error');
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showMsg('Ingresá un email válido.', 'error');
        return;
      }

      // Simular envío (en producción conectar con backend o servicio como Formspree)
      btn.textContent = 'Enviando…';
      btn.disabled = true;

      await new Promise(r => setTimeout(r, 1200));

      showMsg('¡Mensaje enviado! Te responderé a la brevedad.', 'ok');
      form.reset();
      btn.textContent = 'Enviar mensaje';
      btn.disabled = false;
    });

    function showMsg(text, type) {
      msg.textContent = text;
      msg.className   = `form-msg ${type}`;
      setTimeout(() => { msg.textContent = ''; msg.className = 'form-msg'; }, 5000);
    }
  }

  return { init };
})();

/* ============================================================
   9. SMOOTH SCROLL para links internos
============================================================ */
const SmoothScroll = (() => {
  function init() {
    document.querySelectorAll('a[href^="#"]').forEach(link => {
      link.addEventListener('click', e => {
        const id  = link.getAttribute('href').slice(1);
        const target = document.getElementById(id);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  }
  return { init };
})();

/* ============================================================
   10. LAZY LOADING de imágenes (futuras)
============================================================ */
const LazyImages = (() => {
  function init() {
    if ('loading' in HTMLImageElement.prototype) return; // native support
    const imgs = document.querySelectorAll('img[loading="lazy"]');
    const observer = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          const img = e.target;
          img.src = img.dataset.src || img.src;
          observer.unobserve(img);
        }
      });
    });
    imgs.forEach(img => observer.observe(img));
  }
  return { init };
})();

/* ============================================================
   11. HIGHLIGHT DEL ENLACE ACTIVO al hacer scroll
============================================================ */
const ActiveSection = (() => {
  function init() {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-link[href^="#"]');

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          navLinks.forEach(link => {
            link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
          });
        }
      });
    }, { rootMargin: '-40% 0px -55% 0px' });

    sections.forEach(sec => observer.observe(sec));
  }
  return { init };
})();

/* ============================================================
   12. CATEGORÍAS DEL REPOSITORIO (clic → filtro futuro)
============================================================ */
const RepoCards = (() => {
  function init() {
    document.querySelectorAll('.repo-cat-card').forEach(card => {
      card.addEventListener('click', () => {
        // En versión completa navega a la página del repositorio con el filtro activado
        window.location.href = 'pages/repositorio.html';
      });
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') card.click();
      });
    });
  }
  return { init };
})();

/* ============================================================
   13. ACCESIBILIDAD: skip link, focus trap en móvil
============================================================ */
const A11y = (() => {
  function init() {
    // Reducir animaciones si el usuario lo prefiere
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.documentElement.style.setProperty('--t-fast', '0ms');
      document.documentElement.style.setProperty('--t-base', '0ms');
      document.documentElement.style.setProperty('--t-slow', '0ms');
    }
  }
  return { init };
})();

/* ============================================================
   14. ARRANQUE
============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  ThemeManager.init();
  NavManager.init();
  SearchManager.init();
  GamesFilter.init();
  CurricularToggle.init();
  ProposalsTabs.init();
  RevealAnimations.init();
  StatsCounter.init();
  ContactForm.init();
  SmoothScroll.init();
  LazyImages.init();
  ActiveSection.init();
  RepoCards.init();
  A11y.init();

  // Marcar primera sección activa
  const firstLink = document.querySelector('.nav-link[href="#inicio"]');
  if (firstLink && window.scrollY < 100) firstLink.classList.add('active');
});
