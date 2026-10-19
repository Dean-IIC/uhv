// ── Navbar scroll effect ──
const navbar = document.querySelector('.navbar');
window.addEventListener('scroll', () => {
  navbar?.classList.toggle('scrolled', window.scrollY > 50);
  backToTop?.classList.toggle('visible', window.scrollY > 400);
});

// ── Mobile nav toggle ──
const navToggle = document.querySelector('.nav-toggle');
const navLinks  = document.querySelector('.nav-links');
navToggle?.addEventListener('click', () => {
  navLinks.classList.toggle('open');
  const spans = navToggle.querySelectorAll('span');
  navLinks.classList.contains('open')
    ? (spans[0].style.transform='rotate(45deg) translate(5px,5px)', spans[1].style.opacity='0', spans[2].style.transform='rotate(-45deg) translate(5px,-5px)')
    : (spans[0].style.transform='', spans[1].style.opacity='', spans[2].style.transform='');
});
document.querySelectorAll('.nav-links a').forEach(a => a.addEventListener('click', () => navLinks.classList.remove('open')));

// ── Back to top ──
const backToTop = document.querySelector('.back-to-top');
backToTop?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

// ── AOS (Animate On Scroll) ──
function initAOS() {
  const items = document.querySelectorAll('[data-aos]');
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('aos-animate'); obs.unobserve(e.target); } });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
  items.forEach((el, i) => {
    el.style.transitionDelay = (el.dataset.delay || 0) + 'ms';
    obs.observe(el);
  });
}

// ── Count-up animation ──
function countUp(el, target, duration = 1800) {
  const start = performance.now();
  const update = (time) => {
    const progress = Math.min((time - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.floor(eased * target);
    if (progress < 1) requestAnimationFrame(update);
    else el.textContent = target;
  };
  requestAnimationFrame(update);
}
function initCounters() {
  const counters = document.querySelectorAll('.count-up');
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        countUp(e.target, parseInt(e.target.dataset.target));
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.5 });
  counters.forEach(c => obs.observe(c));
}

// ── Activity filter ──
function initFilter() {
  const bar = document.querySelector('.filter-bar');
  if (!bar) return;
  bar.addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;
    bar.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    applyFilter(btn.dataset.filter);
  });
}
function applyFilter(year) {
  const grid = document.querySelector('.activity-grid');
  let shown = 0;
  document.querySelectorAll('.activity-grid [data-year]').forEach(card => {
    const show = year === 'all' || card.dataset.year === year;
    card.style.display = show ? '' : 'none';
    if (show) { shown++; card.style.animation = 'fadeIn 0.4s ease'; }
  });
  // A year with no activities yet shows "Coming soon"
  let empty = grid?.querySelector('.uhv-coming-soon');
  if (grid && !empty) {
    empty = document.createElement('div');
    empty.className = 'uhv-coming-soon';
    empty.innerHTML = '<i class="fas fa-hourglass-half"></i><strong>Coming soon</strong><span>Activities for this year will be added here.</span>';
    grid.prepend(empty);
  }
  empty?.classList.toggle('is-visible', !shown);
}

// ── Set active nav link ──
function setActiveNav() {
  const page = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(a => {
    a.classList.toggle('active', a.getAttribute('href') === page);
  });
}

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
  initAOS();
  initCounters();
  initFilter();
  setActiveNav();
});
