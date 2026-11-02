# Rayeed Ashrafee: portfolio (final)

Vite + Three.js + Lenis. One page: glass-A intro, photo flight, case files, contact.

## Run
    npm install
    npm run dev        # local
    npm run build      # production build -> dist/
Deploy: push to GitHub; Vercel detects Vite (build `npm run build`, output `dist`).

## Before sharing the link
1. `.env` -> set `VITE_SITE_URL` to your real address (link previews, search tags). Redeploy.
2. Project popups: edit a project's `<a>` in index.html, e.g. `<a href="#" data-img="/projects/x.webp" data-live="https://..." data-code="https://..." data-role="Design + code" data-year="2026">`; put the image in public/projects/.
3. Read your own text (About, Process, Now, Beyond code) and fix anything untrue.
4. Test on a real phone, send a test message through the contact form, run Lighthouse.

## Where things live
- index.html: all text content. src/style.css: styling. src/main.js: behaviour (scroll colours, HUD, popups, form). src/scene.js: all WebGL (intro, black hole, photo flight, floating shape).
- src/photos.json: photo order, aspect, category `c`, year `y`, glow colour `g`. public/photos: the 49 images.

## Quick knobs
- Intro length: `MIN_SHOW` (src/main.js, ms). Intro palettes: `uPalU` hex lists (src/scene.js); palette speed `introT / .85`.
- Glass size: `1.3 * bk`. Glass bend: the `off =` line. Ripple strength: `.016` in `ripple()`. Glitch bursts: `dt * .9`.
- Wordmark text/height: `word` and `SY` in src/scene.js. Page colours: `STOPS` (src/main.js). Floating shape per section: `FLOATS`.
- Photo flight length: set automatically (15.5svh per photo).

## Behaviour notes
- Phones: every 2nd photo, lighter intro (no reflection pass), lower resolution; auto quality drop if frames are slow.
- No WebGL / reduced motion / no JS: content still shows; photo grid replaces the 3D flight.
- Font: Inter Tight (@fontsource-variable/inter-tight). If a build ever fails on it, delete its import in src/main.js and the line in package.json; the site falls back to system fonts.
- The live GitHub line calls api.github.com from visitors' browsers; delete the "live GitHub line" block in src/main.js to remove it.
- Keys: I = index, M = photo style, arrow keys = step through photos.
