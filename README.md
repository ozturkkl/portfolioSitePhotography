# Photography Portfolio

A static photography portfolio. Galleries come from a Nextcloud share, get resized at sync time, then ship as a prerendered SvelteKit site. Lightbox with progressive full-resolution images and video, category grids, session pricing, and a contact form. GitHub Pages with a daily photo sync.

Live at [ilaydaturkmen.com](https://ilaydaturkmen.com).

<p align="center">
  <img width="800" alt="Photography portfolio home: black-and-white hero, cream layout, and masonry gallery" src="https://github.com/user-attachments/assets/316ed5f2-99b7-4bcc-be72-4c679b60b8fc" />
</p>

## Features

- **Home**: full-viewport hero (grayscale, slow drift), a short intro, then a masonry preview grid
- **Portfolio**: category filters with arrow-key movement; couples as labeled sections with an optional slider; other categories as a shared grid
- **Lightbox**: native dialog, swipe and keyboard, swipe-down to close. Thumbs paint first, then the original from Nextcloud. Videos use an ffmpeg poster and play the remote file
- **Masonry**: CSS grid row spans from each asset's aspect ratio, remeasured with ResizeObserver
- **Pricing**: peek carousel of session packages; Inquire deep-links to contact with `?package=`
- **Contact**: Web3Forms, localStorage draft, honeypot, comma-separated keys for more than one inbox
- **Chrome**: transparent header over the hero, cream after scroll, mobile menu

## Stack

SvelteKit 2 · Svelte 5 runes · TypeScript · Vite · Tailwind CSS v4 ·
`adapter-static` · Sharp · ffmpeg · Nextcloud WebDAV · GitHub Actions ·
GitHub Pages · Web3Forms

## How it is put together

```
Nextcloud public share
        │  WebDAV PROPFIND + download
        ▼
  npm run sync  (Sharp JPEGs, ffmpeg posters, media.json)
        │
        ▼
   SvelteKit static site
        ├─ grids / sliders use local thumbs (`src`)
        └─ lightbox uses Nextcloud originals (`fullSrc`)
               │
               ├─ Web3Forms  ◀── contact form
               └─ GitHub Pages  ◀── build/  (CI on main)
```

Copy and packages live in `src/lib/data/site.ts` and `src/lib/data/pricing.ts`.
Gallery structure is the Nextcloud folder layout in `scripts/photos.config.mjs`.
`npm run sync` wipes `static/images/`, writes optimized thumbs, and regenerates
`src/lib/data/media.json`. The site never talks to Nextcloud at request time.

Daily CI (`.github/workflows/sync-photos.yml`) runs the same sync, commits
changed images and the manifest, then dispatches deploy.

## Getting started

Node 22+. Copy `.env.example` to `.env`. Nextcloud values are only required
for `sync`. The contact form needs `PUBLIC_WEB3FORMS_ACCESS_KEY`.

```bash
npm install
cp .env.example .env
npm run dev
```

`npm run check` typechecks. `npm run build` writes a prerendered `build/`.
`npm run preview` serves that output.

## Scripts

| Command | What |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Static build → `build/` |
| `npm run preview` | Serve the production build |
| `npm run check` | `svelte-kit sync` + TypeScript |
| `npm run sync` | Nextcloud → `static/images/` + `media.json` |

## Photo sync

Needs `NEXTCLOUD_HOST` and `NEXTCLOUD_SHARE_TOKEN`. ffmpeg on `PATH` if the
share has video. Originals are cached under `.cache/nextcloud/`.

Expected share layout:

```
0-HOME/       HERO, ABOUT, HOME_ABOUT, CONTACT, GRID/
1-PORTFOLIO/  numbered category folders
              couples: one folder per story, optional SLIDER/
```

Folder names become category labels (`0-COUPLES` → `couples`). Numbered
prefixes on files become captions. After changing `scripts/photos.config.mjs`
or the share, run `npm run sync` locally or trigger the workflow.

## Deploy

Push to `main` runs `.github/workflows/deploy-pages.yml`: `npm ci`, `npm run
build`, upload `build/` to GitHub Pages. Pages source must be **GitHub
Actions**. `static/CNAME` holds the custom domain.

Sync CI needs repository secrets `NEXTCLOUD_HOST` and `NEXTCLOUD_SHARE_TOKEN`.
Deploy needs `PUBLIC_WEB3FORMS_ACCESS_KEY` (comma-separated for multiple
inboxes). Set them under **Settings → Secrets and variables → Actions**.

## TODO

- [x] **Contact form**: Web3Forms (`PUBLIC_WEB3FORMS_ACCESS_KEY` in `.env`, comma-separated for multiple inboxes; GitHub Actions secret for deploy)
- [ ] **About copy**: refresh home vs about page copy to reduce overlap
- [x] **Lightbox**: shared page-level lightbox, keyboard nav, carousel a11y
- [ ] **SEO**: per-page meta descriptions, Open Graph / Twitter Card tags
- [x] **media.json validation**: validate manifest shape at sync or build time
- [ ] **Sitemap**: generate `sitemap.xml` at build for static routes
- [ ] **Perandory font**: self-host with `font-display: swap` to reduce FOUT (fallback stack: Cormorant Garamond)
