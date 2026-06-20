/* ============================================================================
   Harpreet Singh Uppal — Portfolio interactions
   Filtering · masonry rendering · lightbox modal · slideshow · keyboard/touch
   ========================================================================== */

import designs from "./web/designs.web.js";

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ---------- Build category list dynamically ---------- */
const CATEGORY_ORDER = ["All", "Branding", "Typography", "Posters Banners", "Motion Graphics", "Characters"];
const present = new Set(designs.map(d => d.category));
const categories = CATEGORY_ORDER.filter(c => c === "All" || present.has(c));

let activeFilter = "All";

/* ---------- Hero stats ---------- */
function renderStats() {
  const projects = designs.length;
  const images = designs.reduce((a, d) => a + d.images.length, 0);
  const cats = present.size;
  const stats = [
    { n: projects, l: "Projects" },
    { n: images + "+", l: "Designs" },
    { n: cats, l: "Disciplines" },
  ];
  $("#heroStats").innerHTML = stats.map(s =>
    `<div class="stat"><b>${s.n}</b><span>${s.l}</span></div>`).join("");
}

/* ---------- Filter tabs ---------- */
function renderFilters() {
  $("#filters").innerHTML = categories.map(c =>
    `<button class="filter-btn ${c === "All" ? "active" : ""}" data-cat="${c}" role="tab" aria-selected="${c === "All"}">${c}</button>`
  ).join("");

  $$(".filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      activeFilter = btn.dataset.cat;
      $$(".filter-btn").forEach(b => {
        const on = b === btn;
        b.classList.toggle("active", on);
        b.setAttribute("aria-selected", on);
      });
      renderGrid();
    });
  });
}

/* ---------- Grid (masonry via CSS columns) ---------- */
function visibleDesigns() {
  return activeFilter === "All" ? designs : designs.filter(d => d.category === activeFilter);
}

function renderGrid() {
  const list = visibleDesigns();
  const grid = $("#grid");
  grid.innerHTML = list.map((d, i) => `
    <article class="card" data-id="${d.id}" style="animation-delay:${Math.min(i * 60, 480)}ms" tabindex="0" role="button" aria-label="Open ${escapeAttr(d.title)}">
      <span class="corner-cat">${d.category}</span>
      <div class="thumb-wrap">
        <img class="thumb" src="${d.thumbnail}" alt="${escapeAttr(d.title)}" loading="lazy" />
      </div>
      <div class="overlay">
        <span class="cat">${d.category}</span>
        <h3>${escapeHtml(d.title)}</h3>
        <div class="meta">
          <span class="pill">${d.images.length} image${d.images.length > 1 ? "s" : ""}</span>
          <span>View project →</span>
        </div>
      </div>
    </article>`).join("");

  $("#resultCount").textContent = `${list.length} project${list.length !== 1 ? "s" : ""}`;
  $("#empty").hidden = list.length > 0;

  $$(".card").forEach(card => {
    const open = () => openModal(card.dataset.id);
    card.addEventListener("click", open);
    card.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
    });
  });
}

/* ============================================================================
   MODAL / LIGHTBOX
   ========================================================================== */
const modal = $("#modal");
let current = null;   // current design
let slide = 0;        // current image index

function openModal(id) {
  current = designs.find(d => d.id === id);
  if (!current) return;
  slide = 0;

  $("#modalCat").textContent = current.category;
  $("#modalTitle").textContent = current.title;
  $("#modalDesc").textContent = current.description || "";
  $("#modalSource").innerHTML = current.source
    ? `Originally published on <a href="${current.source}" target="_blank" rel="noopener">Adobe Portfolio ↗</a>`
    : "";

  // Build slides
  const stage = $("#stage");
  stage.querySelectorAll(".slide").forEach(s => s.remove());
  current.images.forEach((src, i) => {
    const div = document.createElement("div");
    div.className = "slide" + (i === 0 ? " active" : "");
    div.innerHTML = `<img src="${src}" alt="${escapeAttr(current.title)} — image ${i + 1}" loading="lazy" />`;
    div.querySelector("img").addEventListener("click", e => {
      e.target.classList.toggle("zoomed");
    });
    stage.insertBefore(div, $("#counter"));
  });

  // Thumbnail strip
  $("#modalThumbs").innerHTML = current.images.map((src, i) =>
    `<button class="thumb-btn ${i === 0 ? "active" : ""}" data-i="${i}" aria-label="Go to image ${i + 1}"><img src="${src}" alt="" loading="lazy"/></button>`
  ).join("");
  $$("#modalThumbs .thumb-btn").forEach(b =>
    b.addEventListener("click", () => goTo(+b.dataset.i)));

  // Multi-image controls
  const multi = current.images.length > 1;
  $("#prevBtn").hidden = !multi;
  $("#nextBtn").hidden = !multi;
  $("#counter").hidden = !multi;

  updateSlide();
  modal.classList.add("open");
  document.body.style.overflow = "hidden";
  $("#modalClose").focus();
}

function closeModal() {
  modal.classList.remove("open");
  document.body.style.overflow = "";
  current = null;
}

function updateSlide() {
  const slides = $$("#stage .slide");
  slides.forEach((s, i) => {
    s.classList.toggle("active", i === slide);
    if (i !== slide) s.querySelector("img")?.classList.remove("zoomed");
  });
  $$("#modalThumbs .thumb-btn").forEach((b, i) => b.classList.toggle("active", i === slide));
  if (current && current.images.length > 1) {
    $("#counter").textContent = `${slide + 1} / ${current.images.length}`;
    // keep active thumb in view
    $$("#modalThumbs .thumb-btn")[slide]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
}

function goTo(i) {
  if (!current) return;
  const n = current.images.length;
  slide = (i + n) % n;
  updateSlide();
}
const next = () => goTo(slide + 1);
const prev = () => goTo(slide - 1);

/* ---------- Modal events ---------- */
$("#modalClose").addEventListener("click", closeModal);
$("#nextBtn").addEventListener("click", next);
$("#prevBtn").addEventListener("click", prev);
modal.addEventListener("click", e => { if (e.target === modal) closeModal(); });

document.addEventListener("keydown", e => {
  if (!modal.classList.contains("open")) return;
  if (e.key === "Escape") closeModal();
  else if (e.key === "ArrowRight") next();
  else if (e.key === "ArrowLeft") prev();
});

/* ---------- Touch swipe ---------- */
let touchX = null;
$("#stage").addEventListener("touchstart", e => { touchX = e.changedTouches[0].clientX; }, { passive: true });
$("#stage").addEventListener("touchend", e => {
  if (touchX === null) return;
  const dx = e.changedTouches[0].clientX - touchX;
  if (Math.abs(dx) > 50) (dx < 0 ? next : prev)();
  touchX = null;
}, { passive: true });

/* ---------- Header scroll state + scroll-to-top ---------- */
const scrollTopBtn = $("#scrollTop");
addEventListener("scroll", () => {
  $(".site-header").style.background =
    scrollY > 20 ? "rgba(11,11,15,0.78)" : "rgba(11,11,15,0.6)";
  
  // Show/hide scroll-to-top button
  if (scrollTopBtn) {
    scrollTopBtn.classList.toggle("visible", scrollY > 400);
  }
}, { passive: true });

if (scrollTopBtn) {
  scrollTopBtn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

/* ---------- Scroll reveal (IntersectionObserver) ---------- */
function initScrollReveal() {
  const revealElements = $$(".about, .about-clients, .about-tools, .footer-cta, .socials");
  revealElements.forEach(el => el.classList.add("reveal"));

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("revealed");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });

  revealElements.forEach(el => observer.observe(el));
}

/* ---------- Image error fallback ---------- */
function initImageFallbacks() {
  document.addEventListener("error", (e) => {
    if (e.target.tagName === "IMG" && e.target.classList.contains("thumb")) {
      e.target.style.display = "none";
      const wrap = e.target.closest(".thumb-wrap");
      if (wrap && !wrap.querySelector(".img-fallback")) {
        const fallback = document.createElement("div");
        fallback.className = "img-fallback";
        fallback.style.cssText = "display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:var(--text-faint);font-size:13px;";
        fallback.textContent = "Image unavailable";
        wrap.appendChild(fallback);
      }
    }
  }, true);
}

/* ---------- Utils ---------- */
function escapeHtml(s = "") {
  return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
const escapeAttr = escapeHtml;

/* ---------- Init ---------- */
$("#year").textContent = new Date().getFullYear();
renderStats();
renderFilters();
renderGrid();
initScrollReveal();
initImageFallbacks();

