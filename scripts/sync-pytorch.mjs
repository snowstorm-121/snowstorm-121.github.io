#!/usr/bin/env node

import { createHash } from 'node:crypto';
import {
  access,
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import MarkdownIt from 'markdown-it';

const SITE_ROOT = '/learning/pytorch';
const MANIFEST_VERSION = 1;
const MAX_TEXT_SCAN_BYTES = 1024 * 1024;
const MAX_REMOTE_ASSET_BYTES = 10 * 1024 * 1024;
const REMOTE_FETCH_TIMEOUT_MS = 15_000;
const MAX_REMOTE_REDIRECTS = 5;
const COLLATOR = new Intl.Collator('zh-CN', { numeric: true, sensitivity: 'base' });
const STAGES = new Map([
  ['foundation_stage', { key: 'foundation', label: '基础阶段' }],
  ['stage1', { key: 'stage-1', label: 'Tensor 与自动微分' }],
  ['stage2', { key: 'stage-2', label: '模型与训练闭环' }],
  ['stage3', { key: 'stage-3', label: '卷积网络' }],
  ['stage4', { key: 'stage-4', label: 'Transformer 与 BERT' }],
  ['stage5', { key: 'stage-5', label: '全量微调与 LoRA' }],
  ['stage6', { key: 'stage-6', label: 'RAG' }],
]);

function normalizePath(value) {
  return value.split(path.sep).join('/');
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeMarkdownLabel(value) {
  return value.replaceAll('\\', '\\\\').replaceAll('[', '\\[').replaceAll(']', '\\]');
}

function sourceTitle(relativePath) {
  return path.basename(relativePath, path.extname(relativePath)).trim();
}

export function slugify(value) {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('en-US')
    .replace(/[’'"“”‘’()（）【】\[\]{}]/g, '')
    .replace(/[：:·—–_+／/\\|，,。！？!?；;、\s]+/g, '-')
    .replace(/[^\p{Letter}\p{Number}-]+/gu, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '') || 'note';
}

async function walkFiles(root) {
  const files = [];
  async function walk(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => COLLATOR.compare(a.name, b.name));
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(absolute);
      else if (entry.isFile()) files.push(absolute);
    }
  }
  await walk(root);
  return files;
}

function legacySlugMap(manifest) {
  return new Map(
    (manifest?.notes || []).map((note) => [`${note.stageKey}\0${note.title}`, note.slug]),
  );
}

function classifyNote(relativePath) {
  const parts = normalizePath(relativePath).split('/');
  if (parts.length === 1) return { stageKey: 'overview', stageLabel: '学习路线', isOverview: true };
  const stage = STAGES.get(parts[0].toLocaleLowerCase('en-US'));
  if (!stage) throw new Error(`Unsupported PyTorch stage directory: ${parts[0]}`);
  return { stageKey: stage.key, stageLabel: stage.label, isOverview: false };
}

export async function collectSourceNotes(sourceRoot, previousManifest = {}) {
  const root = path.resolve(sourceRoot);
  const files = (await walkFiles(root)).filter((file) => path.extname(file).toLowerCase() === '.md');
  const legacy = legacySlugMap(previousManifest);
  const notes = [];
  const usedSlugs = new Set();
  for (const absolutePath of files) {
    const sourcePath = normalizePath(path.relative(root, absolutePath));
    const title = sourceTitle(sourcePath);
    const stage = classifyNote(sourcePath);
    const baseSlug = legacy.get(`${stage.stageKey}\0${title}`) || slugify(title);
    let slug = baseSlug;
    let suffix = 2;
    while (usedSlugs.has(`${stage.stageKey}/${slug}`)) slug = `${baseSlug}-${suffix++}`;
    usedSlugs.add(`${stage.stageKey}/${slug}`);
    notes.push({
      ...stage,
      title,
      slug,
      sourcePath,
      absolutePath,
      content: await readFile(absolutePath, 'utf8'),
    });
  }
  notes.sort((a, b) => {
    if (a.isOverview !== b.isOverview) return a.isOverview ? -1 : 1;
    if (a.stageKey !== b.stageKey) return COLLATOR.compare(a.stageKey, b.stageKey);
    return COLLATOR.compare(a.title, b.title);
  });
  return notes;
}

export function findRemoteImageUrls(markdown) {
  const urls = new Set();
  const markdownImage = /!\[[^\]]*\]\(\s*(https?:\/\/[^\s)]+)(?:\s+["'][^"']*["'])?\s*\)/gi;
  const htmlImage = /<img\b[^>]*\bsrc=["'](https?:\/\/[^"']+)["'][^>]*>/gi;
  for (const pattern of [markdownImage, htmlImage]) {
    for (const match of markdown.matchAll(pattern)) urls.add(match[1]);
  }
  return [...urls].sort();
}

async function scanSecrets(notes, sourceRoot, allFiles) {
  const rules = [
    ['private key', /-----BEGIN (?:(?:RSA|EC|OPENSSH|DSA|ENCRYPTED|PGP) )?PRIVATE KEY(?: BLOCK)?-----/],
    ['AWS credential', /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/],
    ['GitHub credential', /\bgh[pousr]_[A-Za-z0-9]{30,}\b/],
    ['OpenAI credential', /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/],
    ['Slack credential', /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/],
  ];
  const findings = [];
  const sources = notes.map((note) => ({ sourcePath: note.sourcePath, content: note.content }));
  const attachments = allFiles.filter((file) => path.extname(file).toLowerCase() !== '.md');
  for (const absolutePath of attachments) {
    const fileStat = await stat(absolutePath);
    const sensitiveExtension = /\.(?:pem|key)$/i.test(absolutePath);
    if (fileStat.size > MAX_TEXT_SCAN_BYTES) {
      if (sensitiveExtension) {
        throw new Error(`Credential scan stopped synchronization:\n${normalizePath(path.relative(sourceRoot, absolutePath))}: sensitive attachment is too large to scan`);
      }
      continue;
    }
    const buffer = await readFile(absolutePath);
    let content;
    try {
      content = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    } catch {
      if (sensitiveExtension) {
        throw new Error(`Credential scan stopped synchronization:\n${normalizePath(path.relative(sourceRoot, absolutePath))}: sensitive attachment is not UTF-8 text`);
      }
      continue;
    }
    if (content.includes('\0')) {
      if (sensitiveExtension) {
        throw new Error(`Credential scan stopped synchronization:\n${normalizePath(path.relative(sourceRoot, absolutePath))}: sensitive attachment is binary`);
      }
      continue;
    }
    sources.push({
      sourcePath: normalizePath(path.relative(sourceRoot, absolutePath)),
      content,
    });
  }
  for (const source of sources) {
    const lines = source.content.split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const [kind, pattern] of rules) {
        if (pattern.test(line)) findings.push(`${source.sourcePath}:${index + 1}: possible ${kind}`);
      }
    });
  }
  if (findings.length) throw new Error(`Credential scan stopped synchronization:\n${findings.join('\n')}`);
}

function buildNoteIndex(notes) {
  const byPath = new Map();
  const byBase = new Map();
  for (const note of notes) {
    const withoutExtension = note.sourcePath.replace(/\.md$/i, '');
    const variants = [withoutExtension, `Notes/Pytorch学习/${withoutExtension}`];
    for (const variant of variants) byPath.set(variant.toLocaleLowerCase('en-US'), note);
    const base = path.posix.basename(withoutExtension).toLocaleLowerCase('en-US');
    const matches = byBase.get(base) || [];
    matches.push(note);
    byBase.set(base, matches);
  }
  return { byPath, byBase };
}

function splitTarget(rawTarget) {
  const [targetWithPath, heading = ''] = rawTarget.trim().split('#', 2);
  let decodedTarget = targetWithPath;
  try {
    decodedTarget = decodeURIComponent(targetWithPath);
  } catch {
    // Keep malformed percent sequences literal so unresolved links remain plain text.
  }
  return { target: decodedTarget.replace(/\.md$/i, ''), heading };
}

function resolveNoteTarget(rawTarget, currentNote, index) {
  const { target, heading } = splitTarget(rawTarget);
  if (!target && heading) return { note: currentNote, heading };
  const cleaned = normalizePath(target).replace(/^\.\//, '').replace(/^\/+/, '');
  const currentDirectory = path.posix.dirname(currentNote.sourcePath);
  const candidates = [
    cleaned,
    path.posix.normalize(path.posix.join(currentDirectory, cleaned)),
    cleaned.replace(/^Notes\/Pytorch学习\//i, ''),
  ];
  for (const candidate of candidates) {
    const note = index.byPath.get(candidate.toLocaleLowerCase('en-US'));
    if (note) return { note, heading };
  }
  const basename = path.posix.basename(cleaned).toLocaleLowerCase('en-US');
  const matches = index.byBase.get(basename) || [];
  if (matches.length === 1) return { note: matches[0], heading };
  if (matches.length > 1) {
    const sameStage = matches.find((note) => note.stageKey === currentNote.stageKey);
    if (sameStage) return { note: sameStage, heading };
  }
  return null;
}

function noteUrl(note, heading = '') {
  const suffix = heading ? `#${encodeURIComponent(slugify(heading))}` : '';
  return `${SITE_ROOT}/notes/${note.stageKey}/${encodeURIComponent(note.slug)}.html${suffix}`;
}

function remoteAssetPath(url, extension) {
  const digest = createHash('sha256').update(url).digest('hex').slice(0, 20);
  return `assets/remote/${digest}${extension}`;
}

function isRemote(value) {
  return /^https?:\/\//i.test(value);
}

function findAsset(rawTarget, currentNote, assetFiles, sourceRoot) {
  const target = decodeURIComponent(rawTarget.split('|', 1)[0].trim()).replace(/^\.\//, '');
  const absoluteCandidates = [
    path.resolve(path.dirname(currentNote.absolutePath), target),
    path.resolve(path.dirname(currentNote.absolutePath), 'attachments', target),
    path.resolve(sourceRoot, target),
  ];
  for (const candidate of absoluteCandidates) {
    if (assetFiles.includes(candidate)) return candidate;
  }
  const basename = path.basename(target).toLocaleLowerCase('en-US');
  const matches = assetFiles.filter((file) => path.basename(file).toLocaleLowerCase('en-US') === basename);
  if (matches.length === 1) return matches[0];
  const sameDirectory = matches.find((file) => path.dirname(file).startsWith(path.dirname(currentNote.absolutePath)));
  return sameDirectory || null;
}

function attachmentDestination(file, currentNote) {
  const name = path.basename(file).normalize('NFC');
  return `assets/${currentNote.stageKey}/${name}`;
}

function remoteHttpUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Invalid remote image URL: ${value}`);
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`Unsupported remote image protocol ${url.protocol}: ${value}`);
  }
  return url;
}

function rasterFormat(buffer) {
  if (buffer.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) {
    return { name: 'PNG', extension: '.png', contentTypes: ['image/png'] };
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { name: 'JPEG', extension: '.jpg', contentTypes: ['image/jpeg'] };
  }
  const signature = buffer.subarray(0, 12).toString('ascii');
  if (signature.startsWith('GIF87a') || signature.startsWith('GIF89a')) {
    return { name: 'GIF', extension: '.gif', contentTypes: ['image/gif'] };
  }
  if (signature.startsWith('RIFF') && signature.slice(8, 12) === 'WEBP') {
    return { name: 'WebP', extension: '.webp', contentTypes: ['image/webp'] };
  }
  if (buffer.subarray(4, 8).toString('ascii') === 'ftyp' && /avif|avis/.test(buffer.subarray(8, 32).toString('ascii'))) {
    return { name: 'AVIF', extension: '.avif', contentTypes: ['image/avif'] };
  }
  return null;
}

function validateRasterAsset(data, { sourceUrl, finalUrl = sourceUrl, contentType = '', storedPath = '' }) {
  const buffer = Buffer.from(data);
  if (!buffer.length) throw new Error(`Remote image is empty: ${sourceUrl}`);
  if (buffer.length > MAX_REMOTE_ASSET_BYTES) throw new Error(`Remote image is too large: ${sourceUrl}`);
  const format = rasterFormat(buffer);
  if (!format) throw new Error(`Remote image has no supported raster signature: ${sourceUrl}`);
  const normalizedContentType = contentType.split(';', 1)[0].trim().toLowerCase();
  if (normalizedContentType && !format.contentTypes.includes(normalizedContentType)) {
    throw new Error(`Remote image Content-Type ${normalizedContentType} does not match ${format.name} signature: ${sourceUrl}`);
  }
  const extensionSource = storedPath || remoteHttpUrl(finalUrl).pathname;
  const extension = path.extname(extensionSource).toLowerCase();
  const expectedFormat = new Map([
    ['.png', 'PNG'],
    ['.jpg', 'JPEG'],
    ['.jpeg', 'JPEG'],
    ['.gif', 'GIF'],
    ['.webp', 'WebP'],
    ['.avif', 'AVIF'],
    ['.svg', 'SVG'],
  ]).get(extension);
  if (expectedFormat && expectedFormat !== format.name) {
    throw new Error(`Remote image extension ${extension} does not match ${format.name} signature: ${sourceUrl}`);
  }
  return { buffer, format };
}

async function readBoundedResponse(response, maxBytes, url) {
  const contentLength = response.headers.get('content-length');
  if (contentLength !== null) {
    const declaredBytes = Number(contentLength);
    if (!Number.isFinite(declaredBytes) || declaredBytes < 0 || declaredBytes > maxBytes) {
      throw new Error(`Remote image is too large: ${url}`);
    }
  }
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error(`Remote image is too large: ${url}`);
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, total);
}

export async function defaultFetchAsset(url, {
  fetchImpl = globalThis.fetch,
  timeoutMs = REMOTE_FETCH_TIMEOUT_MS,
  maxBytes = MAX_REMOTE_ASSET_BYTES,
  maxRedirects = MAX_REMOTE_REDIRECTS,
} = {}) {
  let currentUrl = remoteHttpUrl(url);
  const signal = AbortSignal.timeout(timeoutMs);
  let redirects = 0;
  try {
    while (true) {
      const response = await fetchImpl(currentUrl.href, { redirect: 'manual', signal });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        if (redirects >= maxRedirects) throw new Error(`Remote image has too many redirects: ${url}`);
        const location = response.headers.get('location');
        if (!location) throw new Error(`Remote image redirect is missing Location: ${currentUrl.href}`);
        currentUrl = remoteHttpUrl(new URL(location, currentUrl).href);
        redirects += 1;
        continue;
      }
      if (!response.ok) throw new Error(`Remote image download failed (${response.status}): ${currentUrl.href}`);
      const finalUrl = remoteHttpUrl(response.url || currentUrl.href).href;
      const contentType = response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() || '';
      if (!['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif'].includes(contentType)) {
        throw new Error(`Remote image Content-Type ${contentType || '(missing)'} is not allowed: ${url}`);
      }
      const data = await readBoundedResponse(response, maxBytes, url);
      const validated = validateRasterAsset(data, { sourceUrl: url, finalUrl, contentType });
      return { data: validated.buffer, contentType, finalUrl };
    }
  } catch (error) {
    if (signal.aborted && (error === signal.reason || ['AbortError', 'TimeoutError'].includes(error.name))) {
      throw new Error(`Remote image download timed out: ${url}`);
    }
    throw error;
  }
}

function isEscaped(value, index) {
  let backslashes = 0;
  for (let cursor = index - 1; cursor >= 0 && value[cursor] === '\\'; cursor -= 1) backslashes += 1;
  return backslashes % 2 === 1;
}

function findClosingDelimiter(value, start, open, close) {
  let depth = 0;
  for (let index = start; index < value.length; index += 1) {
    if (isEscaped(value, index)) continue;
    if (value[index] === open) depth += 1;
    else if (value[index] === close && --depth === 0) return index;
  }
  return -1;
}

function markdownLinkTarget(rawTarget, note, noteIndex) {
  const trimmed = rawTarget.trim();
  const candidates = [{ target: trimmed, title: '' }];
  const angled = trimmed.match(/^<([^>]*)>(\s+.*)?$/s);
  if (angled) candidates.unshift({ target: angled[1], title: angled[2] || '' });
  const titled = trimmed.match(/^(.+?)\s+("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\((?:[^()\\]|\\.)*\))$/s);
  if (titled) candidates.push({ target: titled[1], title: ` ${titled[2]}` });
  for (const candidate of candidates) {
    const resolved = resolveNoteTarget(candidate.target, note, noteIndex);
    if (resolved) return { url: noteUrl(resolved.note, resolved.heading), title: candidate.title };
  }
  return null;
}

function rewriteMarkdownNoteLinks(value, context) {
  let output = '';
  let cursor = 0;
  while (cursor < value.length) {
    if (value[cursor] !== '[' || isEscaped(value, cursor) || value[cursor - 1] === '!') {
      output += value[cursor++];
      continue;
    }
    const labelEnd = findClosingDelimiter(value, cursor, '[', ']');
    if (labelEnd < 0 || value[labelEnd + 1] !== '(') {
      output += value[cursor++];
      continue;
    }
    const destinationEnd = findClosingDelimiter(value, labelEnd + 1, '(', ')');
    if (destinationEnd < 0) {
      output += value[cursor++];
      continue;
    }
    const resolved = markdownLinkTarget(
      value.slice(labelEnd + 2, destinationEnd),
      context.note,
      context.noteIndex,
    );
    if (!resolved) {
      output += value.slice(cursor, destinationEnd + 1);
      cursor = destinationEnd + 1;
      continue;
    }
    output += `${value.slice(cursor, labelEnd + 1)}(${resolved.url}${resolved.title})`;
    cursor = destinationEnd + 1;
  }
  return output;
}

function transformOutsideInlineCode(value, transform) {
  let output = '';
  let plainStart = 0;
  let cursor = 0;
  while (cursor < value.length) {
    if (value[cursor] !== '`' || isEscaped(value, cursor)) {
      cursor += 1;
      continue;
    }
    const openerStart = cursor;
    while (value[cursor] === '`') cursor += 1;
    const openerLength = cursor - openerStart;
    let closerStart = -1;
    while (cursor < value.length) {
      if (value[cursor] !== '`') {
        cursor += 1;
        continue;
      }
      const runStart = cursor;
      while (value[cursor] === '`') cursor += 1;
      if (cursor - runStart === openerLength) {
        closerStart = runStart;
        break;
      }
    }
    if (closerStart < 0) continue;
    output += transform(value.slice(plainStart, openerStart));
    output += value.slice(openerStart, cursor);
    plainStart = cursor;
  }
  return output + transform(value.slice(plainStart));
}

function openingFence(line) {
  const match = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
  if (!match || (match[1][0] === '`' && match[2].includes('`'))) return null;
  return { marker: match[1][0], length: match[1].length };
}

function closesFence(line, fence) {
  const match = line.match(/^ {0,3}(`+|~+)[ \t]*$/);
  return Boolean(match && match[1][0] === fence.marker && match[1].length >= fence.length);
}

function pageTemplate({ title, eyebrow, body }) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#07101c">
  <title>${escapeHtml(title)} · SNOWSTORM</title>
  <link rel="stylesheet" href="/assets/library.css">
</head>
<body class="library-page">
  <main class="library-shell">
    <a class="library-brand" href="/">SNOWSTORM / ARCHIVE</a>
    <p class="library-eyebrow">${escapeHtml(eyebrow)}</p>
    ${body}
  </main>
</body>
</html>`;
}

function preprocessMarkdown(markdown, context) {
  let fence = null;
  const placeholders = [];
  const lines = markdown.split(/\r?\n/).map((line, lineIndex) => {
    if (fence) {
      if (closesFence(line, fence)) fence = null;
      return line;
    }
    const opener = openingFence(line);
    if (opener) {
      fence = opener;
      return line;
    }
    let transformed = line.replace(/^(\s*)- \[([ xX])\]\s+/, (_, indent, checked) => {
      const marker = checked.toLowerCase() === 'x' ? 'PYTORCH_TASK_CHECKED' : 'PYTORCH_TASK_UNCHECKED';
      return `${indent}- ${marker} `;
    });
    transformed = transformOutsideInlineCode(transformed, (segment) => {
      const withWikiLinks = segment.replace(/(!?)\[\[([^\]]+)\]\]/g, (_, embed, body) => {
        const [rawTarget, rawLabel] = body.split('|', 2);
        const label = rawLabel || path.basename(rawTarget);
        const extension = path.extname(rawTarget.split('#', 1)[0]).toLowerCase();
        if (embed || extension) {
          const asset = findAsset(rawTarget, context.note, context.assetFiles, context.sourceRoot);
          if (!asset) {
            if (/^\.(?:png|jpe?g|gif|webp|svg|avif)$/i.test(extension)) {
              throw new Error(`${context.note.sourcePath}:${lineIndex + 1}: missing image ${rawTarget}`);
            }
            if (embed) throw new Error(`${context.note.sourcePath}:${lineIndex + 1}: missing attachment ${rawTarget}`);
          } else {
            const destination = attachmentDestination(asset, context.note);
            context.localAssets.set(destination, asset);
            const url = `${SITE_ROOT}/${destination.split('/').map(encodeURIComponent).join('/')}`;
            if (extension === '.py' && embed) {
              const token = `PYTORCH_SOURCE_ATTACHMENT_${placeholders.length}`;
              placeholders.push({ token, asset, url, label });
              return token;
            }
            if (embed) return `![${escapeMarkdownLabel(label)}](${url})`;
            return `[${escapeMarkdownLabel(label)}](${url} "download")`;
          }
        }
        const resolved = resolveNoteTarget(rawTarget, context.note, context.noteIndex);
        if (!resolved) {
          context.warnings.push(`${context.note.sourcePath}:${lineIndex + 1}: unresolved wiki link ${rawTarget}`);
          return escapeMarkdownLabel(label);
        }
        return `[${escapeMarkdownLabel(label)}](${noteUrl(resolved.note, resolved.heading)})`;
      });
      return rewriteMarkdownNoteLinks(withWikiLinks, context);
    });
    return transformed;
  });
  return { markdown: lines.join('\n'), placeholders };
}

async function renderNote(note, context) {
  const { markdown, placeholders } = preprocessMarkdown(note.content, { ...context, note });
  const md = new MarkdownIt({ html: false, linkify: true, breaks: false });
  const defaultImage = md.renderer.rules.image;
  md.renderer.rules.image = (tokens, index, options, env, self) => {
    const token = tokens[index];
    const source = token.attrGet('src');
    if (isRemote(source)) {
      const destination = context.remoteAssets[source];
      if (!destination) throw new Error(`${note.sourcePath}: new remote image ${source}; run with --fetch-remote-assets`);
      token.attrSet('src', `${SITE_ROOT}/${destination}`);
    } else if (!source.startsWith('/')) {
      const asset = findAsset(source, note, context.assetFiles, context.sourceRoot);
      if (!asset) throw new Error(`${note.sourcePath}: missing image ${source}`);
      const destination = attachmentDestination(asset, note);
      context.localAssets.set(destination, asset);
      token.attrSet('src', `${SITE_ROOT}/${destination.split('/').map(encodeURIComponent).join('/')}`);
    }
    token.attrSet('loading', 'lazy');
    return defaultImage(tokens, index, options, env, self);
  };
  const defaultLinkOpen = md.renderer.rules.link_open || ((tokens, index, options, env, self) => self.renderToken(tokens, index, options));
  md.renderer.rules.link_open = (tokens, index, options, env, self) => {
    const token = tokens[index];
    const href = token.attrGet('href');
    if (href && !isRemote(href) && !href.startsWith('/') && !href.startsWith('#') && !/^mailto:/i.test(href)) {
      const resolved = resolveNoteTarget(href, note, context.noteIndex);
      if (resolved) token.attrSet('href', noteUrl(resolved.note, resolved.heading));
    }
    if (isRemote(href)) token.attrSet('rel', 'noreferrer');
    return defaultLinkOpen(tokens, index, options, env, self);
  };
  let html = md.render(markdown)
    .replaceAll('PYTORCH_TASK_UNCHECKED', '<input type="checkbox" disabled>')
    .replaceAll('PYTORCH_TASK_CHECKED', '<input type="checkbox" checked disabled>');
  for (const placeholder of placeholders) {
    const source = await readFile(placeholder.asset, 'utf8');
    const details = `<details class="source-attachment"><summary>${escapeHtml(placeholder.label)}</summary><a href="${placeholder.url}" download>Download source</a><pre><code class="language-python">${escapeHtml(source)}</code></pre></details>`;
    html = html.replace(`<p>${placeholder.token}</p>`, details).replaceAll(placeholder.token, details);
  }
  return html;
}

function notePublicData(note) {
  return {
    stageKey: note.stageKey,
    stageLabel: note.stageLabel,
    title: note.title,
    slug: note.slug,
    sourcePath: note.sourcePath,
    ...(note.isOverview ? { isOverview: true } : {}),
  };
}

function renderArchiveIndex(notes, stages) {
  const overview = notes.filter((note) => note.isOverview);
  const overviewLinks = overview.map((note) => `<li><a href="${noteUrl(note)}"><span>${escapeHtml(note.title)}</span><small>阅读笔记</small></a></li>`).join('');
  const stageCards = stages.map((stage) => {
    const count = notes.filter((note) => note.stageKey === stage.key).length;
    return `<a class="stage-card" href="./${stage.key}/"><span>${escapeHtml(stage.label)}</span><small>${count} 篇</small><b>→</b></a>`;
  }).join('');
  return pageTemplate({
    title: 'PyTorch 学习笔记',
    eyebrow: 'LEARNING / PYTORCH',
    body: `<nav class="breadcrumbs"><a href="../">学习书架</a><span>/</span><span>PyTorch</span></nav><h1>PyTorch 学习笔记</h1><p class="library-intro">从基础语法到检索增强生成，保留完整学习轨迹。</p><section class="overview-links"><h2>路线图</h2><ul class="note-list">${overviewLinks}</ul></section><section class="stage-grid">${stageCards}</section>`,
  });
}

function renderStageIndex(stage, notes) {
  const links = notes.map((note) => `<li><a href="${noteUrl(note)}"><span>${escapeHtml(note.title)}</span><small>阅读</small></a></li>`).join('');
  return pageTemplate({
    title: stage.label,
    eyebrow: `PYTORCH / ${stage.key.toUpperCase()}`,
    body: `<nav class="breadcrumbs"><a href="../../">学习</a><span>/</span><a href="../">PyTorch</a><span>/</span><span>${escapeHtml(stage.label)}</span></nav><h1>${escapeHtml(stage.label)}</h1><p class="library-intro">${notes.length} 篇学习笔记</p><ol class="note-list">${links}</ol>`,
  });
}

function renderArticle(note, content) {
  const stageCrumb = note.isOverview
    ? `<span>${escapeHtml(note.stageLabel)}</span>`
    : `<a href="../../${note.stageKey}/">${escapeHtml(note.stageLabel)}</a>`;
  return pageTemplate({
    title: note.title,
    eyebrow: note.stageLabel,
    body: `<nav class="breadcrumbs"><a href="../../../">学习</a><span>/</span><a href="../../">PyTorch</a><span>/</span>${stageCrumb}</nav><article class="note-article"><h1>${escapeHtml(note.title)}</h1><div class="note-content">${content}</div></article>`,
  });
}

async function fileExists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function readManifest(outputRoot) {
  try {
    return JSON.parse(await readFile(await safeManagedPath(outputRoot, 'manifest.json'), 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
}

async function buildRemoteAssets(notes, previousManifest, options) {
  const urls = new Set(notes.flatMap((note) => findRemoteImageUrls(note.content)));
  const remoteAssets = {};
  const downloaded = new Map();
  const previous = previousManifest.remoteAssets || {};
  for (const url of [...urls].sort()) {
    if (previous[url]) {
      const existing = await safeManagedPath(options.outputRoot, previous[url]);
      if (!(await fileExists(existing))) throw new Error(`Missing localized remote image: ${previous[url]}`);
      const data = await readFile(existing);
      validateRasterAsset(data, { sourceUrl: url, storedPath: previous[url] });
      remoteAssets[url] = previous[url];
      downloaded.set(previous[url], data);
      continue;
    }
    if (!options.fetchRemoteAssets) throw new Error(`New remote image ${url}; run with --fetch-remote-assets`);
    const fetcher = options.fetchAsset || defaultFetchAsset;
    const fetched = await fetcher(url);
    const result = Buffer.isBuffer(fetched) || ArrayBuffer.isView(fetched)
      ? { data: fetched, finalUrl: url, contentType: '' }
      : fetched;
    if (!result?.data) throw new Error(`Remote image fetcher returned no data: ${url}`);
    const validated = validateRasterAsset(result.data, {
      sourceUrl: url,
      finalUrl: result.finalUrl || url,
      contentType: result.contentType || '',
    });
    const destination = remoteAssetPath(url, validated.format.extension);
    remoteAssets[url] = destination;
    downloaded.set(destination, validated.buffer);
  }
  return { remoteAssets, downloaded };
}

async function safeManagedPath(outputRoot, relativePath) {
  if (typeof relativePath !== 'string') throw new Error(`Unsafe generated manifest path: ${relativePath}`);
  const normalized = normalizePath(relativePath);
  const parts = normalized.split('/');
  if (!normalized || path.isAbsolute(relativePath) || parts.some((part) => !part || part === '.' || part === '..')) {
    throw new Error(`Unsafe generated manifest path: ${relativePath}`);
  }
  const root = path.resolve(outputRoot);
  const absolute = path.resolve(root, normalized);
  const relative = path.relative(root, absolute);
  if (!relative || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`Unsafe generated manifest path: ${relativePath}`);
  }

  let rootRealPath = root;
  try {
    const rootInfo = await lstat(root);
    if (rootInfo.isSymbolicLink()) throw new Error(`Unsafe symlink in managed path: ${root}`);
    rootRealPath = await realpath(root);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  let current = root;
  for (const part of relative.split(path.sep)) {
    current = path.join(current, part);
    try {
      const info = await lstat(current);
      if (info.isSymbolicLink()) {
        throw new Error(`Unsafe symlink in managed path: ${normalizePath(path.relative(root, current))}`);
      }
      const currentRealPath = await realpath(current);
      if (currentRealPath !== rootRealPath && !currentRealPath.startsWith(`${rootRealPath}${path.sep}`)) {
        throw new Error(`Unsafe generated manifest path: ${relativePath}`);
      }
    } catch (error) {
      if (error.code === 'ENOENT') break;
      throw error;
    }
  }
  return absolute;
}

async function writeOutputs(outputRoot, outputs, previousManifest) {
  const desired = new Set(outputs.keys());
  const destinations = new Map();
  const managedPaths = new Set([
    ...outputs.keys(),
    ...(previousManifest.generatedFiles || []).filter((oldPath) => !desired.has(oldPath)),
  ]);
  for (const relativePath of managedPaths) {
    destinations.set(relativePath, await safeManagedPath(outputRoot, relativePath));
  }
  for (const oldPath of previousManifest.generatedFiles || []) {
    if (!desired.has(oldPath)) await rm(destinations.get(oldPath), { force: true });
  }
  for (const [relativePath, content] of outputs) {
    const destination = destinations.get(relativePath);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, content);
  }
}

async function checkOutputs(outputRoot, outputs, previousManifest) {
  const drift = [];
  const desired = new Set(outputs.keys());
  const destinations = new Map();
  const managedPaths = new Set([
    ...outputs.keys(),
    ...(previousManifest.generatedFiles || []).filter((oldPath) => !desired.has(oldPath)),
  ]);
  for (const relativePath of managedPaths) {
    destinations.set(relativePath, await safeManagedPath(outputRoot, relativePath));
  }
  for (const [relativePath, expected] of outputs) {
    try {
      const actual = await readFile(destinations.get(relativePath));
      if (!actual.equals(Buffer.from(expected))) drift.push(relativePath);
    } catch (error) {
      if (error.code === 'ENOENT') drift.push(relativePath);
      else throw error;
    }
  }
  for (const oldPath of previousManifest.generatedFiles || []) {
    if (!desired.has(oldPath) && await fileExists(destinations.get(oldPath))) drift.push(oldPath);
  }
  if (drift.length) throw new Error(`PyTorch archive is out of date (${drift.length} generated files differ)`);
}

export async function synchronize({
  sourceRoot,
  outputRoot = path.resolve('learning/pytorch'),
  fetchRemoteAssets = false,
  check = false,
  fetchAsset,
}) {
  if (!sourceRoot) throw new Error('Missing required --source directory');
  const resolvedSource = path.resolve(sourceRoot);
  const resolvedOutput = path.resolve(outputRoot);
  if (!(await stat(resolvedSource)).isDirectory()) throw new Error(`Source is not a directory: ${resolvedSource}`);
  const previousManifest = await readManifest(resolvedOutput);
  const notes = await collectSourceNotes(resolvedSource, previousManifest);
  const allFiles = await walkFiles(resolvedSource);
  await scanSecrets(notes, resolvedSource, allFiles);
  const assetFiles = allFiles.filter((file) => path.extname(file).toLowerCase() !== '.md');
  const noteIndex = buildNoteIndex(notes);
  const warnings = [];
  const localAssets = new Map();
  const remote = await buildRemoteAssets(notes, previousManifest, {
    outputRoot: resolvedOutput,
    fetchRemoteAssets,
    fetchAsset,
  });
  const outputs = new Map(remote.downloaded);
  for (const note of notes) {
    const html = await renderNote(note, {
      sourceRoot: resolvedSource,
      noteIndex,
      assetFiles,
      localAssets,
      remoteAssets: remote.remoteAssets,
      warnings,
    });
    outputs.set(`notes/${note.stageKey}/${note.slug}.html`, renderArticle(note, html));
    outputs.set(`markdown/${note.stageKey}/${note.slug}.md`, note.content);
  }
  for (const [destination, source] of localAssets) outputs.set(destination, await readFile(source));
  const stages = [...STAGES.values()];
  outputs.set('index.html', renderArchiveIndex(notes, stages));
  for (const stage of stages) {
    outputs.set(`${stage.key}/index.html`, renderStageIndex(stage, notes.filter((note) => note.stageKey === stage.key)));
  }
  const manifest = {
    version: MANIFEST_VERSION,
    stages,
    notes: notes.map(notePublicData),
    attachments: [...localAssets.entries()].map(([destination, source]) => ({
      sourcePath: normalizePath(path.relative(resolvedSource, source)),
      path: destination,
    })).sort((a, b) => COLLATOR.compare(a.path, b.path)),
    remoteAssets: remote.remoteAssets,
    warnings,
    generatedFiles: [...outputs.keys(), 'manifest.json'].sort(COLLATOR.compare),
  };
  outputs.set('manifest.json', `${JSON.stringify(manifest, null, 2)}\n`);
  if (check) await checkOutputs(resolvedOutput, outputs, previousManifest);
  else await writeOutputs(resolvedOutput, outputs, previousManifest);
  return {
    notes: notes.length,
    stages: stages.length,
    remoteAssets: Object.keys(remote.remoteAssets).length,
    warnings,
  };
}

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--source') options.sourceRoot = argv[++index];
    else if (argument === '--fetch-remote-assets') options.fetchRemoteAssets = true;
    else if (argument === '--check') options.check = true;
    else throw new Error(`Unknown argument: ${argument}`);
  }
  return options;
}

async function main() {
  try {
    const result = await synchronize(parseArguments(process.argv.slice(2)));
    for (const warning of result.warnings) console.warn(`warning: ${warning}`);
    const mode = process.argv.includes('--check') ? 'checked' : 'synchronized';
    console.log(`PyTorch archive ${mode}: ${result.notes} notes, ${result.stages} stages, ${result.remoteAssets} remote images, ${result.warnings.length} warnings.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
