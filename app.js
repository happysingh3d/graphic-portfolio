/* ============================================================================
   Happy Singh — Portfolio interactions
   Collage grid clicks · static showcase clicks · lightbox modal · navigation spy
   ========================================================================== */

import designs from "./web/designs.web.js";

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ---------- Showcase Clicks Setup ---------- */
function setupShowcaseClicks() {
  $$(".showcase-card").forEach(card => {
    const open = (e) => {
      if (card.tagName === "A" && card.getAttribute("href") && card.getAttribute("href").startsWith("#")) {
        e.preventDefault();
      }
      const img = $(".thumb", card) || $("img", card);
      const imgSrc = img ? img.getAttribute("src") : null;
      openModal(card.dataset.id, imgSrc);
    };

    card.addEventListener("click", open);
    card.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open(e);
      }
    });
  });
}

/* ---------- Hero collage clicks ---------- */
function setupHeroGridClicks() {
  $$(".hero-grid-item").forEach(item => {
    const open = () => {
      const img = $("img", item);
      const imgSrc = img ? img.getAttribute("src") : null;
      openModal(item.dataset.id, imgSrc);
    };
    item.addEventListener("click", open);
    item.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
    });
  });
}

/* ---------- Explore Grid Clicks ---------- */
function setupExploreGridClicks() {
  $$(".explore-item").forEach(item => {
    const open = () => openModal(item.dataset.id);
    item.addEventListener("click", open);
    item.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
    });
  });
}

/* ---------- Navigation Spy & Scroll Anchors ---------- */
function initNavObserver() {
  const sections = [$("#top"), $("#about"), $("#work"), $("#contact")];
  const navLinks = $$(".nav-link");
  
  // 1. Click handling: highlight immediately
  navLinks.forEach(link => {
    link.addEventListener("click", () => {
      navLinks.forEach(l => l.classList.remove("active"));
      link.classList.add("active");
    });
  });

  // 2. Intersection observer for scrolling spy
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.getAttribute("id");
        navLinks.forEach(link => {
          const href = link.getAttribute("href").substring(1);
          const isMatch = href === id || (href === "top" && id === "top");
          link.classList.toggle("active", isMatch);
        });
      }
    });
  }, { threshold: 0.2, rootMargin: "-25% 0px -55% 0px" });

  sections.forEach(sec => sec && observer.observe(sec));

  // 3. Scroll to bottom helper for contact link
  window.addEventListener("scroll", () => {
    const isAtBottom = (window.innerHeight + window.scrollY) >= document.documentElement.scrollHeight - 60;
    if (isAtBottom) {
      navLinks.forEach(l => l.classList.remove("active"));
      const contactLink = navLinks.find(l => l.getAttribute("href") === "#contact");
      if (contactLink) contactLink.classList.add("active");
    }
  }, { passive: true });
}

/* ============================================================================
   MODAL / LIGHTBOX
   ========================================================================== */
const modal = $("#modal");
let current = null;   // current design
let slide = 0;        // current image index

function openModal(id, imgSrc = null) {
  current = designs.find(d => d.id === id);
  if (!current) return;
  
  slide = 0;
  if (imgSrc) {
    const cleanImgSrc = imgSrc.replace(/^[a-zA-Z]+:\/\/[^\/]+\//, "");
    const index = current.images.findIndex(img => img === cleanImgSrc || cleanImgSrc.endsWith(img) || img.endsWith(cleanImgSrc));
    if (index !== -1) {
      slide = index;
    }
  }

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
    div.className = "slide" + (i === slide ? " active" : "");
    div.innerHTML = `<img src="${src}" alt="${escapeAttr(current.title)} — image ${i + 1}" loading="lazy" />`;
    div.querySelector("img").addEventListener("click", e => {
      e.target.classList.toggle("zoomed");
    });
    stage.insertBefore(div, $("#counter"));
  });

  // Thumbnail strip
  $("#modalThumbs").innerHTML = current.images.map((src, i) =>
    `<button class="thumb-btn ${i === slide ? "active" : ""}" data-i="${i}" aria-label="Go to image ${i + 1}"><img src="${src}" alt="" loading="lazy"/></button>`
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
if (modal) {
  $("#modalClose").addEventListener("click", closeModal);
  $("#nextBtn").addEventListener("click", next);
  $("#prevBtn").addEventListener("click", prev);
  modal.addEventListener("click", e => { if (e.target === modal) closeModal(); });
}

document.addEventListener("keydown", e => {
  if (!modal || !modal.classList.contains("open")) return;
  if (e.key === "Escape") closeModal();
  else if (e.key === "ArrowRight") next();
  else if (e.key === "ArrowLeft") prev();
});

/* ---------- Touch swipe ---------- */
const stage = $("#stage");
if (stage) {
  let touchX = null;
  stage.addEventListener("touchstart", e => { touchX = e.changedTouches[0].clientX; }, { passive: true });
  stage.addEventListener("touchend", e => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) (dx < 0 ? next : prev)();
    touchX = null;
  }, { passive: true });
}

/* ---------- Header background scroll listener ---------- */
const scrollTopBtn = $("#scrollTop");
addEventListener("scroll", () => {
  $(".site-header").style.background =
    window.scrollY > 20 ? "rgba(248, 247, 244, 0.95)" : "rgba(248, 247, 244, 0.85)";
  
  if (scrollTopBtn) {
    scrollTopBtn.classList.toggle("visible", window.scrollY > 400);
  }
}, { passive: true });

if (scrollTopBtn) {
  scrollTopBtn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

/* ---------- Scroll Reveal (IntersectionObserver) ---------- */
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
setupShowcaseClicks();
setupHeroGridClicks();
setupExploreGridClicks();
initNavObserver();
initScrollReveal();
initImageFallbacks();
