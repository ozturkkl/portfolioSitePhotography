# AGENTS.md

Photography portfolio for **Ilayda Turkmen**. Minimal layout - B&W hero, Perandory headline, lowercase brand. Deployed to **ilaydaturkmen.com** (GitHub Pages, custom domain).

## Stack

SvelteKit 2 · Svelte 5 runes · Tailwind v4 · `adapter-static` in `vite.config.ts` · `prerender = true` in `+layout.ts`

## Commands

```bash
npm run dev | build | preview | check | sync
```

`sync` needs `NEXTCLOUD_HOST` and `NEXTCLOUD_SHARE_TOKEN` in `.env` (sync only - not required for `dev`).

## Photos

1. Source: Nextcloud public share (`scripts/photos.config.mjs` paths; token in `.env`)
2. `npm run sync` - wipes `static/images/`, re-downloads, writes `media.json`
3. Site: `$lib/data/media` - grids use `src`, lightbox uses `fullSrc`
4. CI: `.github/workflows/sync-photos.yml` (daily + manual); secrets `NEXTCLOUD_HOST`, `NEXTCLOUD_SHARE_TOKEN`

### Nextcloud layout

```
0-HOME/     HERO.JPG, ABOUT.JPG, HOME_ABOUT.JPG, CONTACT.JPG, GRID/
1-PORTFOLIO/   → contentPaths.portfolio
  0-COUPLES/   numbered subfolders; optional SLIDER/ per couple
  1-STREET/  2-LIFE/  3-SELF_PORTRAIT/
```

Videos get ffmpeg poster frames; full video plays from Nextcloud in lightbox.

## Key paths

| Edit | File |
|------|------|
| Copy, nav, contact | `src/lib/data/site.ts` |
| Nextcloud paths | `scripts/photos.config.mjs` → `contentPaths` |
| Packages | `src/lib/data/pricing.ts` |

Manifest: `src/lib/data/media.json` (generated). Page assets: `media.hero`, `media.about`, `media.homeAbout`, `media.contact`.

## Svelte

Runes only (`$state`, `$derived`, `$props`, `$effect`). Validate: `npx @sveltejs/mcp svelte-autofixer <path>`.
