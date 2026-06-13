#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Adobe MyPortfolio -> Local Graphic Design Portfolio scraper & downloader.

Scrapes two MyPortfolio sites, downloads high-resolution graphic-design assets,
organizes them into category folders, and emits a `designs.js` data model that
the front-end (index.html / index.css / app.js) consumes directly.

Designed for a MINIMAL Python environment:
  - Uses only the standard library: urllib, ssl, re, os, json, html.
  - BeautifulSoup is used IF available; otherwise a regex parser kicks in.
    (Install optional, faster parsing with:  pip install beautifulsoup4 )

Verified against the live HTML (June 2026):
  - Project links:   <a class="project-cover ..." href="/2d-character">
  - Project title:   <h1|div class="title preserve-whitespace">Logos</...>
  - Description:     <div class="rich-text ... module-text"> ... </div>   (optional)
  - Hi-res images:   <div class="js-lightbox" data-src="https://cdn.myportfolio.com/...">
       fallback ->   <img ... data-src="..."> inside .project-module-image

Author: built for Harpreet Singh Uppal
"""

import os
import re
import ssl
import json
import html
import time
import urllib.request
import urllib.parse

# ----------------------------------------------------------------------------
# Optional BeautifulSoup (graceful fallback to regex if not installed)
# ----------------------------------------------------------------------------
try:
    from bs4 import BeautifulSoup  # type: ignore
    HAS_BS4 = True
except Exception:
    HAS_BS4 = False


# ============================================================================
# CONFIGURATION
# ============================================================================

# Base output directory (Windows). Change if you run on macOS/Linux.
BASE_DIR = r"D:\Portfolio\graphic-portfolio-assets"

# The two source sites and the project paths to pull from each.
SITES = {
    "site1": {
        "base_url": "https://harpreetsingh8.myportfolio.com",
        "projects": [
            "/2d-character",
            "/graphic-designing",
            "/logos",
            "/logo-animation",
            "/calander-designe",
            "/menu",
        ],
    },
    "site2": {
        "base_url": "https://happysinghgd.myportfolio.com",
        "projects": [
            "/logo",
            "/typography",
            "/cmyk-banner",
            "/banner",
        ],
    },
}

# Index pages to auto-discover project links (so new projects are picked up too).
INDEX_PAGES = [
    "https://harpreetsingh8.myportfolio.com/work",
    "https://happysinghgd.myportfolio.com/",
]

# Map each project path -> (category_key, friendly_category, nice_title).
#   category_key  -> folder name on disk
#   friendly_cat  -> label shown in the website filter tabs
PATH_CATEGORY = {
    # Branding / Logos
    "/logos":            ("branding",        "Branding",                 "Logo & Brand Identity"),
    "/logo":             ("branding",        "Branding",                 "Logo & Brand Identity"),
    # Typography
    "/typography":       ("typography",      "Typography",               "Typography"),
    # Banners / Posters
    "/graphic-designing":("posters_banners", "Posters",                  "Graphic Design"),
    "/cmyk-banner":      ("posters_banners", "Posters",                  "CMYK Banner"),
    "/banner":           ("posters_banners", "Posters",                  "Digital Banner"),
    "/calander-designe": ("posters_banners", "Posters",                  "Calendar Design"),
    # Motion Graphics / Animation
    "/logo-animation":   ("motion_graphics", "Motion Graphics",          "Logo Animation"),
    "/menu":             ("motion_graphics", "Motion Graphics",          "Motion Graphic"),
    # Character Design
    "/2d-character":     ("characters",      "Character Design",         "2D Character"),
}

# Folders to create under BASE_DIR.
CATEGORY_FOLDERS = ["branding", "typography", "posters_banners", "motion_graphics", "characters"]

# Sensible default descriptions per category (used when a page has no rich-text).
DEFAULT_DESCRIPTIONS = {
    "branding":        "A curated collection of logo and brand identity projects, each crafted to capture a brand's personality through distinctive marks, color, and typography.",
    "typography":      "Expressive typographic explorations and lettering studies focused on rhythm, hierarchy, and visual voice.",
    "posters_banners": "Bold poster and banner compositions built for print and digital, balancing strong hierarchy with striking color.",
    "motion_graphics": "Animated logo reveals and motion graphic pieces that bring brand systems to life through movement.",
    "characters":      "Original 2D character design work spanning concept, expression sheets, and finished illustration.",
}

USER_AGENT = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
              "(KHTML, like Gecko) Chrome/120.0 Safari/537.36")

# Unverified SSL context — keeps things working in minimal/locked-down envs.
SSL_CTX = ssl.create_default_context()
SSL_CTX.check_hostname = False
SSL_CTX.verify_mode = ssl.CERT_NONE


# ============================================================================
# HTTP HELPERS
# ============================================================================

def fetch(url, binary=False, retries=3, timeout=30):
    """Fetch a URL, returning text (decoded) or bytes. Retries on failure."""
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    last_err = None
    for attempt in range(1, retries + 1):
        try:
            with urllib.request.urlopen(req, timeout=timeout, context=SSL_CTX) as resp:
                data = resp.read()
                return data if binary else data.decode("utf-8", errors="ignore")
        except Exception as e:  # noqa: BLE001
            last_err = e
            print(f"    ! attempt {attempt}/{retries} failed for {url}: {e}")
            time.sleep(1.5 * attempt)
    print(f"    !! giving up on {url}: {last_err}")
    return None


# ============================================================================
# PARSING (BeautifulSoup with regex fallback)
# ============================================================================

def parse_index_links(html_text):
    """Return list of (href, title) project links from an index/work page."""
    links = []
    if HAS_BS4:
        soup = BeautifulSoup(html_text, "html.parser")
        for a in soup.select("a.project-cover"):
            href = a.get("href", "").strip()
            t = a.select_one(".title")
            title = t.get_text(strip=True) if t else ""
            if href:
                links.append((href, title))
    else:
        # Match <a ... class="...project-cover..." ... href="...">
        for m in re.finditer(r'<a\b[^>]*class="[^"]*project-cover[^"]*"[^>]*>', html_text, re.I):
            tag = m.group(0)
            hm = re.search(r'href="([^"]+)"', tag)
            if hm:
                links.append((hm.group(1).strip(), ""))
    # De-duplicate, keep order.
    seen, out = set(), []
    for href, title in links:
        if href not in seen:
            seen.add(href)
            out.append((href, title))
    return out


def parse_title(html_text):
    """Extract project title from .title.preserve-whitespace (h1 or div)."""
    if HAS_BS4:
        soup = BeautifulSoup(html_text, "html.parser")
        el = soup.select_one(".title.preserve-whitespace")
        if el:
            return el.get_text(strip=True)
    m = re.search(r'<[a-z0-9]+[^>]*class="title preserve-whitespace"[^>]*>(.*?)</',
                  html_text, re.I | re.S)
    if m:
        return html.unescape(re.sub(r"<[^>]+>", "", m.group(1)).strip())
    return ""


def parse_description(html_text):
    """Extract description text from .project-module-text .rich-text (optional)."""
    text = ""
    if HAS_BS4:
        soup = BeautifulSoup(html_text, "html.parser")
        block = soup.select_one(".project-module-text .rich-text") or soup.select_one(".rich-text")
        if block:
            text = block.get_text(" ", strip=True)
    else:
        m = re.search(r'class="rich-text[^"]*"[^>]*>(.*?)</div>', html_text, re.I | re.S)
        if m:
            text = html.unescape(re.sub(r"<[^>]+>", " ", m.group(1)))
            text = " ".join(text.split())
    return text.strip()


def parse_images(html_text):
    """Extract hi-res image URLs: js-lightbox data-src first, img data-src fallback."""
    urls = []
    if HAS_BS4:
        soup = BeautifulSoup(html_text, "html.parser")
        for div in soup.select(".js-lightbox[data-src]"):
            urls.append(div["data-src"].strip())
        if not urls:
            for img in soup.select(".project-module-image img[data-src]"):
                urls.append(img["data-src"].strip())
    else:
        # Primary: js-lightbox" data-src="..."
        for m in re.finditer(r'js-lightbox"[^>]*\bdata-src="([^"]+)"', html_text, re.I):
            urls.append(m.group(1).strip())
        if not urls:
            for m in re.finditer(r'<img[^>]*\bdata-src="([^"]+)"', html_text, re.I):
                urls.append(m.group(1).strip())
    # De-duplicate while preserving order.
    seen, out = set(), []
    for u in urls:
        key = u.split("?")[0]
        if key not in seen:
            seen.add(key)
            out.append(u)
    return out


# ============================================================================
# UTILITIES
# ============================================================================

def sanitize(name):
    """Lowercase, alnum + underscores only."""
    name = name.strip().lower()
    name = re.sub(r"[^a-z0-9]+", "_", name)
    return re.sub(r"_+", "_", name).strip("_") or "item"


def ext_from_url(url):
    path = urllib.parse.urlparse(url).path
    ext = os.path.splitext(path)[1].lower()
    return ext if ext in (".jpg", ".jpeg", ".png", ".gif", ".webp") else ".jpg"


def ensure_dirs():
    os.makedirs(BASE_DIR, exist_ok=True)
    for folder in CATEGORY_FOLDERS:
        os.makedirs(os.path.join(BASE_DIR, folder), exist_ok=True)


# ============================================================================
# MAIN PIPELINE
# ============================================================================

def main():
    print("=" * 70)
    print("  Graphic Design Portfolio Scraper")
    print("  Parser:", "BeautifulSoup" if HAS_BS4 else "regex (stdlib only)")
    print("=" * 70)

    ensure_dirs()

    # Step 1: discover links from index pages (informational; we still use the
    # explicit per-site project lists to guarantee coverage + categories).
    print("\n[1] Discovering project links from index pages...")
    for idx in INDEX_PAGES:
        page = fetch(idx)
        if page:
            found = parse_index_links(page)
            print(f"    {idx}\n        -> {len(found)} project-cover links: "
                  + ", ".join(h for h, _ in found))

    designs = []
    counters = {}  # per-category running counter for filenames

    # Step 2 + 3: visit each project, scrape, download.
    print("\n[2] Scraping project detail pages & downloading assets...")
    for site_key, site in SITES.items():
        base_url = site["base_url"]
        for path in site["projects"]:
            if path not in PATH_CATEGORY:
                print(f"    - skip (unmapped): {path}")
                continue
            cat_key, cat_label, nice_title = PATH_CATEGORY[path]
            url = base_url + path
            print(f"\n    > {url}  [{cat_label}]")

            page = fetch(url)
            if not page:
                continue

            title = parse_title(page) or nice_title
            desc = parse_description(page) or DEFAULT_DESCRIPTIONS.get(cat_key, "")
            img_urls = parse_images(page)
            print(f"      title='{title}'  images={len(img_urls)}  "
                  f"desc={'yes' if desc else 'default'}")

            if not img_urls:
                print("      (no images found, skipping)")
                continue

            counters.setdefault(cat_key, 0)
            counters[cat_key] += 1
            seq = counters[cat_key]
            slug = sanitize(title)
            local_images = []

            for i, img_url in enumerate(img_urls, start=1):
                ext = ext_from_url(img_url)
                fname = f"{cat_key}_{slug}_{seq:02d}_{i:02d}{ext}"
                disk_path = os.path.join(BASE_DIR, cat_key, fname)
                rel_path = f"graphic-portfolio-assets/{cat_key}/{fname}"

                data = fetch(img_url, binary=True)
                if data:
                    with open(disk_path, "wb") as fh:
                        fh.write(data)
                    local_images.append(rel_path)
                    print(f"        saved {fname} ({len(data)//1024} KB)")
                else:
                    print(f"        FAILED {img_url}")

            if not local_images:
                continue

            designs.append({
                "id": f"{cat_key}-{slug}-{seq:02d}".replace("_", "-"),
                "title": title,
                "category": cat_label,
                "description": desc,
                "source": url,
                "thumbnail": local_images[0],
                "images": local_images,
            })

    # Step 4: write designs.js
    print("\n[3] Writing designs.js ...")
    write_designs_js(designs)

    print("\n" + "=" * 70)
    print(f"  DONE. {len(designs)} projects, "
          f"{sum(len(d['images']) for d in designs)} images.")
    print(f"  Assets:    {BASE_DIR}")
    print(f"  Data file: {os.path.join(BASE_DIR, 'designs.js')}")
    print("=" * 70)


def write_designs_js(designs):
    """Emit designs.js as `const designs = [...]; export default designs;`"""
    body = json.dumps(designs, indent=2, ensure_ascii=False)
    out = "// Auto-generated by scraper.py — graphic design portfolio data model\n"
    out += "const designs = " + body + ";\n\nexport default designs;\n"
    with open(os.path.join(BASE_DIR, "designs.js"), "w", encoding="utf-8") as fh:
        fh.write(out)


if __name__ == "__main__":
    main()
