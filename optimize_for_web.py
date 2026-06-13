#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Create web-optimized display assets + thumbnails from the scraped originals,
and emit a web data model (web/designs.web.js) used by the live site.

Originals in graphic-portfolio-assets/ are NOT modified.
Outputs go to: web/assets/<category>/...  (full + thumb)
"""
import os, re, json
from PIL import Image, ImageOps

SRC_BASE = r"D:\Portfolio\graphic-portfolio-assets"
WEB_BASE = r"C:\Users\DEADHUNK\Downloads\Portfolio\web"
OUT_ASSETS = os.path.join(WEB_BASE, "assets")

MAX_FULL = 1600     # longest edge for full display
MAX_THUMB = 640     # longest edge for grid thumbnail
FULL_Q = 82
THUMB_Q = 78
MAX_IMAGES_PER_PROJECT = 24   # cap for performance / clean galleries

os.makedirs(OUT_ASSETS, exist_ok=True)

def load_designs():
    txt = open(os.path.join(SRC_BASE, "designs.js"), encoding="utf-8").read()
    return json.loads(re.search(r"const designs = (\[.*\]);", txt, re.S).group(1))

def resize_save(src_path, dst_path, max_edge, quality):
    try:
        im = Image.open(src_path)
    except Exception as e:
        print("   skip(bad):", os.path.basename(src_path), e)
        return False
    # Animated gif -> keep first frame as static preview (web is fine with that)
    im = ImageOps.exif_transpose(im)
    if im.mode in ("RGBA", "P", "LA"):
        im = im.convert("RGB")
    w, h = im.size
    # Never upscale — keep small source logos crisp at native resolution.
    scale = min(1.0, max_edge / max(w, h))
    if scale < 1.0:
        im = im.resize((max(1, int(w*scale)), max(1, int(h*scale))), Image.LANCZOS)
    # Pad onto a neutral canvas so tiny thumbs aren't blurrily stretched by CSS.
    im.save(dst_path, "JPEG", quality=quality, optimize=True, progressive=True)
    return True

def main():
    designs = load_designs()
    web = []
    for d in designs:
        cat_dir = os.path.join(OUT_ASSETS, _catkey(d["id"]))
        os.makedirs(cat_dir, exist_ok=True)
        imgs = d["images"][:MAX_IMAGES_PER_PROJECT]
        web_imgs = []
        best_idx, best_area, best_src = 0, -1, None
        for i, rel in enumerate(imgs, 1):
            src = os.path.join(SRC_BASE, rel.replace("graphic-portfolio-assets/", ""))
            if not os.path.exists(src):
                continue
            stem = f"{d['id']}_{i:02d}"
            full_rel = f"web/assets/{_catkey(d['id'])}/{stem}.jpg"
            full_dst = os.path.join(WEB_BASE, "assets", _catkey(d["id"]), f"{stem}.jpg")
            if resize_save(src, full_dst, MAX_FULL, FULL_Q):
                web_imgs.append(full_rel)
                # Track the highest-resolution image to use as the cover thumbnail.
                try:
                    sw, sh = Image.open(src).size
                    if sw * sh > best_area:
                        best_area, best_idx, best_src = sw * sh, len(web_imgs), src
                except Exception:
                    pass
        if not web_imgs:
            continue
        # Generate a crisp thumbnail from the best source image.
        thumb_stem = f"{d['id']}_cover"
        thumb_rel = f"web/assets/{_catkey(d['id'])}/{thumb_stem}_thumb.jpg"
        thumb_dst = os.path.join(WEB_BASE, "assets", _catkey(d["id"]), f"{thumb_stem}_thumb.jpg")
        resize_save(best_src, thumb_dst, MAX_THUMB, THUMB_Q)
        thumb = thumb_rel
        web.append({
            "id": d["id"], "title": d["title"], "category": d["category"],
            "description": d["description"], "source": d.get("source", ""),
            "thumbnail": thumb, "images": web_imgs,
            "count": len(d["images"]),
        })
        print(f"  {d['category']:16} {d['title']:22} -> {len(web_imgs)} web imgs")
    body = json.dumps(web, indent=2, ensure_ascii=False)
    out = "// Web-optimized data model (generated)\nconst designs = " + body + ";\nexport default designs;\n"
    open(os.path.join(WEB_BASE, "designs.web.js"), "w", encoding="utf-8").write(out)
    print("\nWrote", os.path.join(WEB_BASE, "designs.web.js"), "with", len(web), "projects")

def _catkey(_id):
    # id like 'branding-logos-01' -> category folder key
    if _id.startswith("posters-banners"): return "posters_banners"
    if _id.startswith("motion-graphics"): return "motion_graphics"
    return _id.split("-")[0]

if __name__ == "__main__":
    main()
