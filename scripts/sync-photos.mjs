#!/usr/bin/env node

import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import sharp from 'sharp';
import { contentPaths, nextcloud, sizes } from './photos.config.mjs';

const execFileAsync = promisify(execFile);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const IMAGES_DIR = path.join(ROOT, 'static/images');
const CACHE_DIR = path.join(ROOT, '.cache/nextcloud');
const MANIFEST_PATH = path.join(ROOT, 'src/lib/data/media.json');

const AUTH = Buffer.from(`${nextcloud.shareToken}:`).toString('base64');
const IMAGE_EXT = /\.(jpe?g|png|webp|gif|heic|heif)$/i;
const VIDEO_EXT = /\.(mp4|mov|webm|m4v|mkv|avi)$/i;

let skippedCount = 0;

function naturalCompare(a, b) {
	return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

function fullSrc(remotePath) {
	return `${nextcloud.publicFilesBase}/${remotePath
		.split('/')
		.map((s) => encodeURIComponent(s))
		.join('/')}`;
}

function slugify(remotePath) {
	return remotePath
		.toLowerCase()
		.replace(/^0-home\/grid\//, 'grid-')
		.replace(/^1-portfolio\//, '')
		.replace(/^\d+-/, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 96);
}

function folderName(name) {
	const parsed = nameFromNumberedPrefix(name);
	return (parsed ?? name).toLowerCase();
}

function altFromFilename(filename, context) {
	const base = filename.replace(/\.[^.]+$/, '').replace(/\s+copy(\s+\d+)?/gi, '');
	return `${context} - ${base}`;
}

/** e.g. "3-First dance" → "First dance"; "4" → undefined */
function nameFromNumberedPrefix(name) {
	const base = name.replace(/\.[^.]+$/i, '').replace(/\s+copy(\s+\d+)?/gi, '');
	const match = base.match(/^\d+-(.+)$/);
	if (!match) return undefined;

	const formatted = match[1].replace(/_/g, ' ').trim();
	return formatted || undefined;
}

function captionFromFilename(filename) {
	return nameFromNumberedPrefix(filename);
}

function isImage(name, contentType) {
	if (contentType?.startsWith('image/')) return true;
	return IMAGE_EXT.test(name);
}

function isVideo(name, contentType) {
	if (contentType?.startsWith('video/')) return true;
	return VIDEO_EXT.test(name);
}

function isMedia(name, contentType) {
	return isImage(name, contentType) || isVideo(name, contentType);
}

function warnSkip(remotePath, reason) {
	skippedCount += 1;
	console.warn(`\n  skip ${remotePath}: ${reason}`);
}

async function propfind(remotePath) {
	const segments = remotePath.replace(/\/$/, '').split('/').filter(Boolean);
	const url = `${nextcloud.webdavBase}${segments.map(encodeURIComponent).join('/')}/`;
	const res = await fetch(url, {
		method: 'PROPFIND',
		headers: { Authorization: `Basic ${AUTH}`, Depth: '1' }
	});
	if (!res.ok) throw new Error(`PROPFIND ${remotePath} failed (${res.status})`);
	return res.text();
}

function parseListing(xml, parentPath) {
	const entries = [];
	const normParent = parentPath.replace(/\/$/, '');
	for (const block of xml.match(/<d:response>[\s\S]*?<\/d:response>/g) ?? []) {
		const href = block.match(/<d:href>\/public.php\/webdav\/([^<]*)<\/d:href>/)?.[1];
		if (!href) continue;
		const rel = decodeURIComponent(href).replace(/\/$/, '');
		if (rel === normParent) continue;
		const isDir = /<d:collection\s*\/>/.test(block);
		const contentType = block.match(/<d:getcontenttype>([^<]+)<\/d:getcontenttype>/)?.[1] ?? null;
		let name = rel.slice(normParent.length).replace(/^\//, '');
		if (name.includes('/')) name = name.split('/')[0];
		entries.push({
			name,
			path: isDir ? `${rel}/` : rel,
			isDirectory: isDir,
			contentType
		});
	}
	const seen = new Set();
	return entries.filter((e) => {
		const key = `${e.isDirectory ? 'd' : 'f'}:${e.name}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

async function listDirectory(remotePath) {
	const xml = await propfind(remotePath);
	return parseListing(xml, remotePath.replace(/\/$/, ''));
}

async function collectMediaPaths(remotePath) {
	const entries = await listDirectory(remotePath);
	const dirs = entries.filter((e) => e.isDirectory).sort((a, b) => naturalCompare(a.name, b.name));
	const files = entries
		.filter((e) => !e.isDirectory && isMedia(e.name, e.contentType))
		.sort((a, b) => naturalCompare(a.name, b.name));
	const paths = files.map((f) => ({ path: f.path, contentType: f.contentType, name: f.name }));
	for (const dir of dirs) {
		paths.push(...(await collectMediaPaths(dir.path)));
	}
	return paths;
}

async function collectRootMediaPaths(remotePath) {
	const entries = await listDirectory(remotePath);
	return entries
		.filter((e) => !e.isDirectory && isMedia(e.name, e.contentType))
		.sort((a, b) => naturalCompare(a.name, b.name))
		.map((e) => ({ path: e.path, contentType: e.contentType, name: e.name }));
}

async function download(remotePath) {
	const url = `${nextcloud.webdavBase}${remotePath.split('/').map(encodeURIComponent).join('/')}`;
	const res = await fetch(url, { headers: { Authorization: `Basic ${AUTH}` } });
	if (!res.ok) throw new Error(`download failed (${res.status})`);
	return Buffer.from(await res.arrayBuffer());
}

function cachePath(remotePath) {
	const hash = createHash('sha1').update(remotePath).digest('hex').slice(0, 12);
	const ext = path.extname(remotePath);
	const safe = remotePath.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-80);
	return path.join(CACHE_DIR, `${hash}-${safe}${ext}`);
}

async function getOriginalFile(remotePath) {
	const cached = cachePath(remotePath);
	try {
		await readFile(cached);
		return cached;
	} catch {
		const data = await download(remotePath);
		await mkdir(path.dirname(cached), { recursive: true });
		await writeFile(cached, data);
		return cached;
	}
}

async function optimizeToJpeg(inputBuffer, outputPath, maxWidth) {
	await mkdir(path.dirname(outputPath), { recursive: true });
	const image = sharp(inputBuffer).rotate();
	const meta = await image.metadata();
	await image
		.resize(maxWidth, maxWidth, { fit: 'inside', withoutEnlargement: true })
		.jpeg({ quality: 82, mozjpeg: true })
		.toFile(outputPath);
	const outMeta = await sharp(outputPath).metadata();
	return {
		width: outMeta.width ?? meta.width ?? maxWidth,
		height: outMeta.height ?? meta.height ?? maxWidth
	};
}

async function videoPosterFromFile(inputPath, outputPath, maxWidth) {
	await mkdir(path.dirname(outputPath), { recursive: true });
	const scale = `scale='min(${maxWidth},iw)':-2`;
	await execFileAsync('ffmpeg', [
		'-hide_banner',
		'-loglevel',
		'error',
		'-y',
		'-ss',
		'00:00:01',
		'-i',
		inputPath,
		'-vframes',
		'1',
		'-vf',
		scale,
		'-q:v',
		'3',
		outputPath
	]);
	const outMeta = await sharp(outputPath).metadata();
	return {
		width: outMeta.width ?? maxWidth,
		height: outMeta.height ?? Math.round(maxWidth * 0.5625)
	};
}

function webPath(filesystemPath) {
	return `/${path.relative(path.join(ROOT, 'static'), filesystemPath).split(path.sep).join('/')}`;
}

async function syncImage(remotePath, outputPath, maxWidth, alt) {
	const cached = await getOriginalFile(remotePath);
	const buffer = await readFile(cached);
	const { width, height } = await optimizeToJpeg(buffer, outputPath, maxWidth);
	return {
		src: webPath(outputPath),
		fullSrc: fullSrc(remotePath),
		alt,
		width,
		height,
		kind: 'image'
	};
}

async function syncVideo(remotePath, outputPath, maxWidth, alt) {
	const cached = await getOriginalFile(remotePath);
	const { width, height } = await videoPosterFromFile(cached, outputPath, maxWidth);
	return {
		src: webPath(outputPath),
		fullSrc: fullSrc(remotePath),
		alt,
		width,
		height,
		kind: 'video'
	};
}

async function syncMedia(entry, outputPath, maxWidth, alt) {
	const { path: remotePath, contentType, name } = entry;
	try {
		let asset;
		if (isVideo(name, contentType)) {
			asset = await syncVideo(remotePath, outputPath, maxWidth, alt);
		} else if (isImage(name, contentType)) {
			asset = await syncImage(remotePath, outputPath, maxWidth, alt);
		} else {
			warnSkip(remotePath, 'unsupported type');
			return null;
		}
		return { ...asset, caption: captionFromFilename(name) };
	} catch (err) {
		warnSkip(remotePath, err instanceof Error ? err.message : String(err));
		return null;
	}
}

async function syncPageAsset(remotePath, outputName, maxWidth, alt) {
	const out = path.join(IMAGES_DIR, outputName);
	const name = path.basename(remotePath);
	const asset = await syncMedia({ path: remotePath, contentType: null, name }, out, maxWidth, alt);
	if (!asset) throw new Error(`page asset failed: ${remotePath}`);
	return asset;
}

async function syncMediaBatch(entries, outputDir, maxWidth, altContext, meta = {}) {
	const assets = [];
	for (const entry of entries) {
		const filename = entry.name ?? entry.path.split('/').pop();
		const slug = slugify(entry.path);
		const out = path.join(outputDir, `${slug}.jpg`);
		const asset = await syncMedia(
			entry,
			out,
			maxWidth,
			altFromFilename(filename, altContext)
		);
		if (asset) {
			assets.push({ ...asset, ...meta });
			process.stdout.write(isVideo(filename, entry.contentType) ? 'v' : '.');
		}
	}
	return assets;
}

function coupleLabel(folderName) {
	const name = nameFromNumberedPrefix(folderName);
	if (name) return name;

	const n = Number.parseInt(folderName, 10);
	if (!Number.isNaN(n)) return `Couple ${n + 1}`;

	return folderName;
}

async function syncCouplesCategory(catDir, idIndex, category) {
	const entries = await listDirectory(catDir.path);
	const coupleDirs = entries
		.filter((e) => e.isDirectory && e.name.toUpperCase() !== 'SLIDER')
		.sort((a, b) => naturalCompare(a.name, b.name));

	const couples = [];

	for (const coupleDir of coupleDirs) {
		const subEntries = await listDirectory(coupleDir.path);
		const sliderDir = subEntries.find(
			(e) => e.isDirectory && e.name.toUpperCase() === 'SLIDER'
		);

		const gridEntries = await collectRootMediaPaths(coupleDir.path);
		const label = coupleLabel(coupleDir.name);
		const gridMedia = [];

		for (const entry of gridEntries) {
			const filename = entry.name;
			const slug = slugify(entry.path);
			const out = path.join(IMAGES_DIR, 'portfolio', `${slug}.jpg`);
			const asset = await syncMedia(
				entry,
				out,
				sizes.thumb,
				altFromFilename(filename, label)
			);
			if (asset) {
				gridMedia.push({
					id: `g-${idIndex.start++}`,
					...asset,
					category
				});
				process.stdout.write(asset.kind === 'video' ? 'v' : '.');
			}
		}

		let slider;
		if (sliderDir) {
			const sliderEntries = await collectRootMediaPaths(sliderDir.path);
			slider = await syncMediaBatch(
				sliderEntries,
				path.join(IMAGES_DIR, 'portfolio', 'sliders', slugify(coupleDir.path)),
				sizes.slider,
				`${label} - slider`
			);
		}

		couples.push({
			id: `couple-${coupleDir.name}`,
			label,
			media: gridMedia,
			...(slider?.length ? { slider } : {})
		});
	}

	return couples;
}

async function syncPortfolio() {
	const rootEntries = await listDirectory(contentPaths.portfolio);
	const categoryDirs = rootEntries
		.filter((e) => e.isDirectory)
		.sort((a, b) => naturalCompare(a.name, b.name));

	const categories = categoryDirs.map((d) => folderName(d.name));

	const media = [];
	const couples = [];
	const idIndex = { start: 1 };

	for (const catDir of categoryDirs) {
		const category = folderName(catDir.name);

		if (category === 'couples') {
			couples.push(...(await syncCouplesCategory(catDir, idIndex, category)));
			continue;
		}

		const entries = await collectMediaPaths(catDir.path);

		for (const entry of entries) {
			const filename = entry.name;
			const slug = slugify(entry.path);
			const out = path.join(IMAGES_DIR, 'portfolio', `${slug}.jpg`);
			const asset = await syncMedia(
				entry,
				out,
				sizes.thumb,
				altFromFilename(filename, category)
			);
			if (asset) {
				media.push({
					id: `g-${idIndex.start++}`,
					...asset,
					category
				});
				process.stdout.write(asset.kind === 'video' ? 'v' : '.');
			}
		}
	}

	return { categories, media, couples };
}

async function cleanStaticImages() {
	await rm(IMAGES_DIR, { recursive: true, force: true });
	await mkdir(IMAGES_DIR, { recursive: true });
}

async function syncPageMedia() {
	const [hero, about, homeAbout, contact] = await Promise.all([
		syncPageAsset(contentPaths.hero, 'hero.jpg', sizes.hero, 'Hero'),
		syncPageAsset(contentPaths.about, 'about.jpg', sizes.hero, 'About Ilayda'),
		syncPageAsset(contentPaths.homeAbout, 'home-about.jpg', sizes.thumb, 'Ilayda Turkmen'),
		syncPageAsset(contentPaths.contact, 'contact.jpg', sizes.thumb, 'Contact')
	]);

	return { hero, about, homeAbout, contact };
}

async function main() {
	console.log('Syncing photos from Nextcloud…\n');
	skippedCount = 0;
	await cleanStaticImages();

	process.stdout.write('Page media… ');
	const { hero, about, homeAbout, contact } = await syncPageMedia();
	console.log('done');

	process.stdout.write('Home grid… ');
	const gridEntries = await collectMediaPaths(`${contentPaths.homeGrid}/`);
	const homeGrid = [];
	for (const entry of gridEntries) {
		const filename = entry.name;
		const slug = slugify(entry.path);
		const out = path.join(IMAGES_DIR, 'grid', `${slug}.jpg`);
		const asset = await syncMedia(
			entry,
			out,
			sizes.thumb,
			altFromFilename(filename, 'Portfolio preview')
		);
		if (asset) {
			homeGrid.push(asset);
			process.stdout.write(asset.kind === 'video' ? 'v' : '.');
		}
	}
	console.log(` ${homeGrid.length} items`);

	process.stdout.write('Portfolio');
	const portfolio = await syncPortfolio();
	console.log(
		`\n${portfolio.media.length} portfolio items, ${portfolio.couples.length} couple sections`
	);

	const manifest = {
		syncedAt: new Date().toISOString(),
		hero,
		about,
		homeAbout,
		contact,
		homeGrid,
		portfolio
	};

	await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, '\t')}\n`);
	console.log(`\nWrote ${MANIFEST_PATH}`);
	if (skippedCount > 0) console.log(`Skipped ${skippedCount} file(s) (unsupported or failed to parse)`);
	console.log('Optimized thumbnails in static/images/ (videos play from Nextcloud on click)');
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
