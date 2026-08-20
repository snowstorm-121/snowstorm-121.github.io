#!/usr/bin/env node

import { createHash, randomUUID } from 'node:crypto';
import {
  access,
  cp,
  link,
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  rmdir,
  stat,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import MarkdownIt from 'markdown-it';

const SITE_ROOT = '/learning/pytorch';
const MANIFEST_VERSION = 1;
const MAX_REMOTE_ASSET_BYTES = 10 * 1024 * 1024;
const REMOTE_FETCH_TIMEOUT_MS = 15_000;
const MAX_REMOTE_REDIRECTS = 5;
const PUBLISH_OWNER_FILE = 'owner.json';
const PUBLISH_OWNER_KIND = 'snowstorm-pytorch-sync';
const CLI_HELP = `Usage: node scripts/sync-pytorch.mjs [--source PATH] [--fetch-remote-assets] [--check]

Concurrency contract:
  Run only in an exclusive worktree with no external writers to learning/pytorch.
  The owner sidecar excludes only another sync-pytorch process.
  Editors, deployers, or other processes must not modify manifest-managed output while synchronization runs.
  If this contract is violated, protection is not guaranteed.`;
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

function caseFoldPath(value) {
  return normalizePath(value).normalize('NFC').toLocaleLowerCase('en-US');
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
    entries.sort((a, b) => {
      const collated = COLLATOR.compare(a.name, b.name);
      if (collated) return collated;
      const left = a.name.normalize('NFC');
      const right = b.name.normalize('NFC');
      return left < right ? -1 : left > right ? 1 : 0;
    });
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
  const reservedLegacyRoutes = new Set();
  for (const absolutePath of files) {
    const sourcePath = normalizePath(path.relative(root, absolutePath));
    const title = sourceTitle(sourcePath);
    const stage = classifyNote(sourcePath);
    const legacySlug = legacy.get(`${stage.stageKey}\0${title}`);
    if (legacySlug) reservedLegacyRoutes.add(caseFoldPath(`${stage.stageKey}/${legacySlug}`));
  }
  const usedRoutes = new Set();
  for (const absolutePath of files) {
    const sourcePath = normalizePath(path.relative(root, absolutePath));
    const title = sourceTitle(sourcePath);
    const stage = classifyNote(sourcePath);
    const legacySlug = legacy.get(`${stage.stageKey}\0${title}`);
    const baseSlug = legacySlug || slugify(title);
    let slug = baseSlug;
    let suffix = 2;
    if (legacySlug) reservedLegacyRoutes.delete(caseFoldPath(`${stage.stageKey}/${legacySlug}`));
    while (
      usedRoutes.has(caseFoldPath(`${stage.stageKey}/${slug}`))
      || reservedLegacyRoutes.has(caseFoldPath(`${stage.stageKey}/${slug}`))
    ) slug = `${baseSlug}-${suffix++}`;
    usedRoutes.add(caseFoldPath(`${stage.stageKey}/${slug}`));
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

function createMarkdownParser() {
  const md = new MarkdownIt({ html: false, linkify: true, breaks: false });
  md.block.ruler.before('paragraph', 'pytorch_html_comment', (state, startLine, endLine, silent) => {
    const start = state.bMarks[startLine] + state.tShift[startLine];
    if (state.sCount[startLine] - state.blkIndent >= 4 || !state.src.startsWith('<!--', start)) return false;
    let nextLine = startLine;
    let closed = false;
    for (; nextLine < endLine; nextLine += 1) {
      const lineStart = state.bMarks[nextLine] + state.tShift[nextLine];
      const line = state.src.slice(lineStart, state.eMarks[nextLine]);
      if (line.includes('-->')) {
        nextLine += 1;
        closed = true;
        break;
      }
    }
    if (!closed) return false;
    if (silent) return true;
    const content = state.getLines(startLine, nextLine, state.blkIndent, true);
    const token = state.push('pytorch_comment', '', 0);
    token.block = true;
    token.map = [startLine, nextLine];
    token.meta = { alt: semanticOcrAlt(content.slice(4, content.indexOf('-->'))) };
    state.line = nextLine;
    return true;
  }, { alt: ['paragraph', 'reference', 'blockquote'] });
  md.inline.ruler.before('text', 'pytorch_safe_raw_html', (state, silent) => {
    const source = state.src.slice(state.pos);
    if (source.startsWith('<!--')) {
      const end = source.indexOf('-->');
      if (end < 0) return false;
      if (!silent) {
        const token = state.push('pytorch_comment', '', 0);
        token.meta = { alt: semanticOcrAlt(source.slice(4, end)) };
        state.pos += end + 3;
      }
      return true;
    }
    const safeBreak = /^<br\s*\/?>/i.exec(source);
    if (!safeBreak) return false;
    if (!silent) {
      state.push('safe_break', 'br', 0);
      state.pos += safeBreak[0].length;
    }
    return true;
  }, { alt: ['terminator'] });
  return md;
}

function markdownImageSources(markdown, md = createMarkdownParser()) {
  const sources = [];
  const visit = (tokens) => {
    for (const token of tokens) {
      if (token.type === 'image') sources.push(token.attrGet('src'));
      if (token.children) visit(token.children);
    }
  };
  visit(md.parse(markdown, {}));
  return sources.filter(Boolean);
}

export function findRemoteImageUrls(markdown) {
  const urls = new Set();
  for (const source of markdownImageSources(markdown)) {
    if (source.startsWith('//')) throw new Error(`Protocol-relative remote image is not allowed: ${source}`);
    if (isRemote(source)) urls.add(source);
  }
  return [...urls].sort();
}

async function scanSecrets(notes, sourceRoot, publishedAttachments) {
  const rules = [
    ['private key', /-----BEGIN (?:(?:RSA|EC|OPENSSH|DSA|ENCRYPTED|PGP) )?PRIVATE KEY(?: BLOCK)?-----/],
    ['AWS credential', /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/],
    ['GitHub credential', /\bgh[pousr]_[A-Za-z0-9]{30,}\b/],
    ['OpenAI credential', /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/],
    ['Slack credential', /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/],
  ];
  const findings = [];
  const sources = notes.map((note) => ({ sourcePath: note.sourcePath, content: note.content }));
  for (const absolutePath of publishedAttachments) {
    const buffer = await readFile(absolutePath);
    sources.push({
      sourcePath: normalizePath(path.relative(sourceRoot, absolutePath)),
      content: buffer.toString('latin1'),
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

function isLocalNoteReference(value) {
  const target = value.trim();
  return !target.startsWith('/') && !/^[A-Za-z][A-Za-z\d+.-]*:/.test(target);
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

function registerLocalAsset(localAssets, destination, source) {
  const existing = [...localAssets.entries()]
    .find(([registeredDestination]) => caseFoldPath(registeredDestination) === caseFoldPath(destination));
  if (existing && path.resolve(existing[1]) !== path.resolve(source)) {
    throw new Error(`Attachment destination collision at ${destination}: ${existing[1]} and ${source}`);
  }
  if (!existing) localAssets.set(destination, source);
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
      await cancelResponseBody(response);
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
      try {
        await reader.cancel();
      } catch {
        // Keep the size-limit error as the primary failure.
      }
      throw new Error(`Remote image is too large: ${url}`);
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, total);
}

async function cancelResponseBody(response) {
  try {
    await response.body?.cancel();
  } catch {
    // Cancellation is best-effort and must not replace the validation error.
  }
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
        await cancelResponseBody(response);
        if (redirects >= maxRedirects) throw new Error(`Remote image has too many redirects: ${url}`);
        const location = response.headers.get('location');
        if (!location) throw new Error(`Remote image redirect is missing Location: ${currentUrl.href}`);
        currentUrl = remoteHttpUrl(new URL(location, currentUrl).href);
        redirects += 1;
        continue;
      }
      if (!response.ok) {
        await cancelResponseBody(response);
        throw new Error(`Remote image download failed (${response.status}): ${currentUrl.href}`);
      }
      let finalUrl;
      try {
        finalUrl = remoteHttpUrl(response.url || currentUrl.href).href;
      } catch (error) {
        await cancelResponseBody(response);
        throw error;
      }
      const contentType = response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() || '';
      if (!['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif'].includes(contentType)) {
        await cancelResponseBody(response);
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
    if (!isLocalNoteReference(candidate.target)) continue;
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

function semanticOcrAlt(comment) {
  const match = comment.match(/ocr\s*内容为\s*[:：]\s*([\s\S]+)/i);
  if (!match) return null;
  const normalized = match[1].replace(/`+/g, '').replace(/\s+/g, ' ').trim();
  if (!normalized) return null;
  const summary = normalized.length > 120 ? `${normalized.slice(0, 119)}…` : normalized;
  return `图示：${summary}`;
}

function pageTemplate({ title, eyebrow, body, pageClass = 'pytorch-archive-page', reading = false }) {
  const readingProgress = reading ? '<div class="reading-progress" data-reading-progress aria-hidden="true"></div>\n' : '';
  const readingScript = reading ? '  <script src="/assets/pytorch-reading.js" defer></script>\n' : '';
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#07101c">
  <title>${escapeHtml(title)} · SNOWSTORM</title>
  <link rel="stylesheet" href="/assets/library.css">
  <link rel="stylesheet" href="/assets/pytorch-reading.css">
</head>
<body class="library-page ${pageClass}">
${readingProgress}  <main class="library-shell">
    <a class="library-brand" href="/">SNOWSTORM / ARCHIVE</a>
    <p class="library-eyebrow">${escapeHtml(eyebrow)}</p>
    ${body}
  </main>
${readingScript}</body>
</html>`;
}

function preprocessMarkdown(markdown, context, md) {
  const protectedLines = new Set();
  for (const token of md.parse(markdown, {})) {
    if (!['fence', 'code_block'].includes(token.type) || !token.map) continue;
    for (let line = token.map[0]; line < token.map[1]; line += 1) protectedLines.add(line);
  }
  const placeholders = [];
  const lines = markdown.split(/\r?\n/).map((line, lineIndex) => {
    if (protectedLines.has(lineIndex)) return line;
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
            registerLocalAsset(context.localAssets, destination, asset);
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

function collectPublicationInputs(notes, context) {
  const remoteUrls = new Set();
  for (const note of notes) {
    const md = createMarkdownParser();
    const { markdown } = preprocessMarkdown(note.content, {
      ...context,
      note,
      warnings: [],
    }, md);
    for (const source of markdownImageSources(markdown, md)) {
      if (source.startsWith('//')) throw new Error(`${note.sourcePath}: protocol-relative remote image is not allowed: ${source}`);
      if (isRemote(source)) {
        remoteUrls.add(source);
        continue;
      }
      if (source.startsWith('/')) continue;
      const asset = findAsset(source, note, context.assetFiles, context.sourceRoot);
      if (!asset) throw new Error(`${note.sourcePath}: missing image ${source}`);
      registerLocalAsset(context.localAssets, attachmentDestination(asset, note), asset);
    }
  }
  return [...remoteUrls].sort();
}

async function renderNote(note, context) {
  const md = createMarkdownParser();
  const { markdown, placeholders } = preprocessMarkdown(note.content, { ...context, note }, md);
  const hasTaskMarker = (tokens, index, closingType) => {
    for (let cursor = index + 1, depth = 0; cursor < tokens.length; cursor += 1) {
      const token = tokens[cursor];
      if (token.type === closingType && depth === 0) break;
      if (token.nesting === 1) depth += 1;
      else if (token.nesting === -1 && depth > 0) depth -= 1;
      if (token.content?.includes('PYTORCH_TASK_')) return true;
    }
    return false;
  };
  for (const listType of ['bullet_list', 'ordered_list']) {
    const openType = `${listType}_open`;
    const closeType = `${listType}_close`;
    const defaultListOpen = md.renderer.rules[openType] || ((tokens, index, options, env, self) => self.renderToken(tokens, index, options));
    md.renderer.rules[openType] = (tokens, index, options, env, self) => {
      if (hasTaskMarker(tokens, index, closeType)) tokens[index].attrJoin('class', 'task-list');
      return defaultListOpen(tokens, index, options, env, self);
    };
  }
  const defaultListItemOpen = md.renderer.rules.list_item_open || ((tokens, index, options, env, self) => self.renderToken(tokens, index, options));
  md.renderer.rules.list_item_open = (tokens, index, options, env, self) => {
    if (hasTaskMarker(tokens, index, 'list_item_close')) tokens[index].attrJoin('class', 'task-list-item');
    return defaultListItemOpen(tokens, index, options, env, self);
  };
  const defaultImage = md.renderer.rules.image;
  md.renderer.rules.safe_break = () => '<br>';
  md.renderer.rules.pytorch_comment = (tokens, index, options, env) => {
    if (tokens[index].meta.alt) env.pendingSemanticImageAlt = tokens[index].meta.alt;
    return '';
  };
  md.renderer.rules.image = (tokens, index, options, env, self) => {
    const token = tokens[index];
    const source = token.attrGet('src');
    if (source.startsWith('//')) {
      throw new Error(`${note.sourcePath}: protocol-relative remote image is not allowed: ${source}`);
    } else if (isRemote(source)) {
      const destination = context.remoteAssets[source];
      if (!destination) throw new Error(`${note.sourcePath}: new remote image ${source}; run with --fetch-remote-assets`);
      token.attrSet('src', `${SITE_ROOT}/${destination}`);
    } else if (!source.startsWith('/')) {
      const asset = findAsset(source, note, context.assetFiles, context.sourceRoot);
      if (!asset) throw new Error(`${note.sourcePath}: missing image ${source}`);
      const destination = attachmentDestination(asset, note);
      registerLocalAsset(context.localAssets, destination, asset);
      token.attrSet('src', `${SITE_ROOT}/${destination.split('/').map(encodeURIComponent).join('/')}`);
    }
    const semanticAlt = env.pendingSemanticImageAlt;
    env.pendingSemanticImageAlt = null;
    if (semanticAlt) {
      token.children = [{ type: 'text', content: semanticAlt }];
    } else if (!self.renderInlineAsText(token.children, options, env).trim()) {
      token.children = [{ type: 'text', content: `${note.title} 图示` }];
    }
    token.attrSet('loading', 'lazy');
    return defaultImage(tokens, index, options, env, self);
  };
  const defaultLinkOpen = md.renderer.rules.link_open || ((tokens, index, options, env, self) => self.renderToken(tokens, index, options));
  md.renderer.rules.link_open = (tokens, index, options, env, self) => {
    const token = tokens[index];
    const href = token.attrGet('href');
    if (href && isLocalNoteReference(href) && !href.startsWith('#')) {
      const resolved = resolveNoteTarget(href, note, context.noteIndex);
      if (resolved) token.attrSet('href', noteUrl(resolved.note, resolved.heading));
    }
    if (isRemote(href)) token.attrSet('rel', 'noreferrer');
    return defaultLinkOpen(tokens, index, options, env, self);
  };
  let html = md.render(markdown, {})
    .replaceAll('<p></p>\n', '')
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
  const stageCards = stages.map((stage, index) => {
    const count = notes.filter((note) => note.stageKey === stage.key).length;
    return `<li class="tide-stage" data-stage-key="${stage.key}"><span class="tide-marker" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span><a href="./${stage.key}/"><span>${escapeHtml(stage.label)}</span><small>${count} 篇</small><b>查看阶段 →</b></a></li>`;
  }).join('');
  return pageTemplate({
    title: 'PyTorch 学习笔记',
    eyebrow: 'LEARNING / PYTORCH',
    body: `<nav class="breadcrumbs"><a href="../">学习书架</a><span>/</span><span>PyTorch</span></nav><h1>PyTorch 学习笔记</h1><p class="library-intro">从基础语法到检索增强生成，保留完整学习轨迹。</p><section class="overview-links"><h2>路线图</h2><ul class="note-list">${overviewLinks}</ul></section><section class="pytorch-tide" aria-labelledby="pytorch-tide-title"><div><p class="tide-kicker">LEARNING TIDE / 07 STAGES</p><h2 id="pytorch-tide-title">沿着潮线，回看每一次推进</h2></div><ol class="pytorch-tide-timeline" data-stage-count="${stages.length}">${stageCards}</ol></section>`,
  });
}

function renderStageIndex(stage, notes, stages) {
  const stageIndex = stages.findIndex((candidate) => candidate.key === stage.key);
  const previous = stages[stageIndex - 1];
  const next = stages[stageIndex + 1];
  const links = notes.map((note, index) => `<li><a class="stage-note-link" href="${noteUrl(note)}"><small>第 ${String(index + 1).padStart(2, '0')} 篇</small><span>${escapeHtml(note.title)}</span><b>阅读 →</b></a></li>`).join('');
  const neighbors = `<nav class="stage-neighbors" aria-label="阶段导航">${previous ? `<a class="stage-neighbor previous" href="../${previous.key}/">← ${escapeHtml(previous.label)}</a>` : '<span class="stage-neighbor previous" aria-hidden="true"></span>'}${next ? `<a class="stage-neighbor next" href="../${next.key}/">${escapeHtml(next.label)} →</a>` : '<span class="stage-neighbor next" aria-hidden="true"></span>'}</nav>`;
  return pageTemplate({
    title: stage.label,
    eyebrow: `PYTORCH / ${stage.key.toUpperCase()}`,
    body: `<nav class="breadcrumbs"><a href="../../">学习</a><span>/</span><a href="../">PyTorch</a><span>/</span><span>${escapeHtml(stage.label)}</span></nav><header class="stage-heading"><p class="stage-note-count">${notes.length} 篇</p><h1>${escapeHtml(stage.label)}</h1><p class="library-intro">按学习顺序继续阅读本阶段笔记。</p></header><ol class="stage-note-list">${links}</ol>${neighbors}`,
  });
}

function readingHeadings(content) {
  const decodeHtmlEntities = createMarkdownParser().utils.unescapeAll;
  const usedIds = new Set();
  const items = [];
  const decorated = content.replace(/<h([23])>([\s\S]*?)<\/h\1>/g, (match, level, inner) => {
    const inlineText = decodeHtmlEntities(inner.replace(/<[^>]+>/g, '')).trim();
    const imageAlt = [...inner.matchAll(/<img\b[^>]*\balt="([^"]*)"[^>]*>/g)]
      .map((image) => decodeHtmlEntities(image[1]).trim())
      .find(Boolean);
    const text = inlineText || imageAlt || '';
    if (!text) return match;
    const base = slugify(text);
    let id = base;
    let suffix = 2;
    while (usedIds.has(id)) id = `${base}-${suffix++}`;
    usedIds.add(id);
    items.push({ level, id, text });
    return `<h${level} id="${id}">${inner}</h${level}>`;
  });
  return { content: decorated, items };
}

function startsWithMatchingH1(content, title) {
  const match = /^\s*<h1(?:\s[^>]*)?>([\s\S]*?)<\/h1>/.exec(content);
  if (!match) return false;
  const text = createMarkdownParser().utils.unescapeAll(match[1].replace(/<[^>]+>/g, '')).trim();
  return text.normalize('NFC') === title.trim().normalize('NFC');
}

function renderArticle(note, content, stageNotes) {
  const stageCrumb = note.isOverview
    ? `<span>${escapeHtml(note.stageLabel)}</span>`
    : `<a href="../../${note.stageKey}/">${escapeHtml(note.stageLabel)}</a>`;
  const { content: decoratedContent, items } = readingHeadings(content);
  const toc = items.map((item) => `<li class="toc-level-${item.level}"><a href="#${item.id}">${escapeHtml(item.text)}</a></li>`).join('');
  const current = stageNotes.findIndex((candidate) => candidate.stageKey === note.stageKey && candidate.slug === note.slug);
  const previous = current > 0 ? stageNotes[current - 1] : null;
  const next = current >= 0 && current < stageNotes.length - 1 ? stageNotes[current + 1] : null;
  const neighbors = `<nav class="article-neighbors" aria-label="相邻文章">${previous ? `<a class="article-neighbor previous" href="${noteUrl(previous)}">← <span>上一篇</span>${escapeHtml(previous.title)}</a>` : '<span class="article-neighbor previous" aria-hidden="true"></span>'}${next ? `<a class="article-neighbor next" href="${noteUrl(next)}"><span>下一篇</span>${escapeHtml(next.title)} →</a>` : '<span class="article-neighbor next" aria-hidden="true"></span>'}</nav>`;
  const title = startsWithMatchingH1(content, note.title) ? '' : `<h1>${escapeHtml(note.title)}</h1>`;
  return pageTemplate({
    title: note.title,
    eyebrow: note.stageLabel,
    pageClass: 'pytorch-reading-page',
    reading: true,
    body: `<a class="reading-return" href="/learning/">← 返回星图</a><nav class="breadcrumbs"><a href="../../../">学习</a><span>/</span><a href="../../">PyTorch</a><span>/</span>${stageCrumb}</nav><div class="reading-layout"><aside class="reading-toc"><details class="reading-toc-details"><summary>本页目录</summary><ol>${toc}</ol></details></aside><article class="note-article">${title}<div class="note-content">${decoratedContent}</div></article></div>${neighbors}`,
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

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validateManifest(manifest) {
  if (!isRecord(manifest)) throw new Error('Invalid PyTorch manifest: root must be an object');
  if (manifest.version !== MANIFEST_VERSION) {
    throw new Error(`Invalid PyTorch manifest version: expected ${MANIFEST_VERSION}`);
  }
  const allowedFields = new Set(['version', 'stages', 'notes', 'attachments', 'remoteAssets', 'warnings', 'generatedFiles']);
  for (const field of Object.keys(manifest)) {
    if (!allowedFields.has(field)) throw new Error(`Invalid PyTorch manifest field: ${field}`);
  }
  for (const field of ['stages', 'notes', 'attachments', 'warnings', 'generatedFiles']) {
    if (!Array.isArray(manifest[field])) throw new Error(`Invalid PyTorch manifest: ${field} must be an array`);
  }
  if (!isRecord(manifest.remoteAssets)) throw new Error('Invalid PyTorch manifest: remoteAssets must be an object');

  const requireStringFields = (entries, label, fields) => entries.forEach((entry, index) => {
    if (!isRecord(entry)) throw new Error(`Invalid PyTorch manifest: ${label}[${index}] must be an object`);
    for (const field of fields) {
      if (typeof entry[field] !== 'string' || !entry[field]) {
        throw new Error(`Invalid PyTorch manifest: ${label}[${index}].${field} must be a non-empty string`);
      }
    }
  });
  requireStringFields(manifest.stages, 'stages', ['key', 'label']);
  requireStringFields(manifest.notes, 'notes', ['stageKey', 'stageLabel', 'title', 'slug', 'sourcePath']);
  requireStringFields(manifest.attachments, 'attachments', ['sourcePath', 'path']);
  const noteRoutes = new Set();
  manifest.notes.forEach((note, index) => {
    if (note.slug !== note.slug.normalize('NFC') || !/^[\p{Letter}\p{Number}]+(?:-[\p{Letter}\p{Number}]+)*$/u.test(note.slug)) {
      throw new Error(`Invalid PyTorch manifest: notes[${index}].slug has an unsafe format`);
    }
    const route = caseFoldPath(`${note.stageKey}/${note.slug}`);
    if (noteRoutes.has(route)) throw new Error(`Invalid PyTorch manifest: duplicate note slug ${note.stageKey}/${note.slug}`);
    noteRoutes.add(route);
    if ('isOverview' in note && typeof note.isOverview !== 'boolean') {
      throw new Error(`Invalid PyTorch manifest: notes[${index}].isOverview must be a boolean`);
    }
  });
  manifest.warnings.forEach((warning, index) => {
    if (typeof warning !== 'string') throw new Error(`Invalid PyTorch manifest: warnings[${index}] must be a string`);
  });
  for (const [url, assetPath] of Object.entries(manifest.remoteAssets)) {
    if (!url || typeof assetPath !== 'string' || !assetPath) {
      throw new Error('Invalid PyTorch manifest: remoteAssets entries must map URLs to non-empty paths');
    }
  }
  manifest.generatedFiles.forEach((generatedPath, index) => {
    if (typeof generatedPath !== 'string' || !generatedPath) {
      throw new Error(`Invalid PyTorch manifest: generatedFiles[${index}] must be a non-empty string`);
    }
  });
  if (new Set(manifest.generatedFiles.map(caseFoldPath)).size !== manifest.generatedFiles.length) {
    throw new Error('Invalid PyTorch manifest: duplicate generated path');
  }
  if (!manifest.generatedFiles.includes('manifest.json')) {
    throw new Error('Invalid PyTorch manifest: generatedFiles must include manifest.json');
  }
  const generated = new Set(manifest.generatedFiles);
  for (const assetPath of [
    ...manifest.attachments.map((attachment) => attachment.path),
    ...Object.values(manifest.remoteAssets),
  ]) {
    if (!generated.has(assetPath)) throw new Error(`Invalid PyTorch manifest: unmanaged published path ${assetPath}`);
  }
}

async function readManifest(outputRoot) {
  try {
    const manifest = JSON.parse(await readFile(await safeManagedPath(outputRoot, 'manifest.json'), 'utf8'));
    validateManifest(manifest);
    return manifest;
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function buildRemoteAssets(urls, previousManifest, options) {
  const remoteAssets = {};
  const downloaded = new Map();
  const previous = previousManifest.remoteAssets || {};
  for (const url of urls) {
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

function publishTransactionRoot(outputRoot) {
  const resolvedRoot = path.resolve(outputRoot);
  return path.join(path.dirname(resolvedRoot), `.${path.basename(resolvedRoot)}-sync-transaction`);
}

function publishOwnerPath(outputRoot) {
  const resolvedRoot = path.resolve(outputRoot);
  return path.join(path.dirname(resolvedRoot), `.${path.basename(resolvedRoot)}-sync-owner.json`);
}

function publishPendingOwnerPath(outputRoot, transactionId) {
  const resolvedRoot = path.resolve(outputRoot);
  return path.join(
    path.dirname(resolvedRoot),
    `.${path.basename(resolvedRoot)}-sync-owner-${transactionId}.json.tmp`,
  );
}

function publishGarbagePrefix(outputRoot) {
  return `.${path.basename(path.resolve(outputRoot))}-sync-gc-`;
}

function publishGarbageRoot(outputRoot, transactionId) {
  return path.join(
    path.dirname(path.resolve(outputRoot)),
    `${publishGarbagePrefix(outputRoot)}${transactionId}`,
  );
}

function validatePublishOwner(owner, outputRoot) {
  if (!isRecord(owner) || owner.version !== 1 || owner.kind !== PUBLISH_OWNER_KIND) {
    throw new Error('Invalid PyTorch publish owner marker');
  }
  const allowedFields = new Set(['version', 'kind', 'outputRoot', 'transactionId', 'pid']);
  for (const field of Object.keys(owner)) {
    if (!allowedFields.has(field)) throw new Error(`Invalid PyTorch publish owner marker field: ${field}`);
  }
  if (owner.outputRoot !== path.resolve(outputRoot)) {
    throw new Error('Invalid PyTorch publish owner marker output root');
  }
  if (typeof owner.transactionId !== 'string' || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(owner.transactionId)) {
    throw new Error('Invalid PyTorch publish owner marker transaction id');
  }
  if (!Number.isSafeInteger(owner.pid) || owner.pid <= 0) {
    throw new Error('Invalid PyTorch publish owner marker pid');
  }
  return owner;
}

async function readPublishOwnerFile(markerPath, outputRoot) {
  let markerInfo;
  try {
    markerInfo = await lstat(markerPath);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
  if (markerInfo.isSymbolicLink() || !markerInfo.isFile()) {
    throw new Error('Invalid PyTorch publish owner marker file');
  }
  let owner;
  try {
    owner = JSON.parse(await readFile(markerPath, 'utf8'));
  } catch (error) {
    throw new Error(`Invalid PyTorch publish owner marker: ${error.message}`);
  }
  return validatePublishOwner(owner, outputRoot);
}

async function readPublishOwner(transactionRoot, outputRoot) {
  return readPublishOwnerFile(path.join(transactionRoot, PUBLISH_OWNER_FILE), outputRoot);
}

function samePublishOwner(left, right) {
  return left.transactionId === right.transactionId
    && left.outputRoot === right.outputRoot
    && left.pid === right.pid;
}

function publishOwnerIsActive(owner) {
  try {
    process.kill(owner.pid, 0);
    return true;
  } catch (error) {
    if (error.code === 'ESRCH') return false;
    if (error.code === 'EPERM') return true;
    throw error;
  }
}

async function removePublishOwnerMarker(outputRoot, owner) {
  const markerPath = publishOwnerPath(outputRoot);
  const pendingPath = publishPendingOwnerPath(outputRoot, owner.transactionId);
  if (await samePublishedFile(pendingPath, markerPath)) await rm(pendingPath, { force: true });
  const current = await readPublishOwnerFile(markerPath, outputRoot);
  if (!current || !samePublishOwner(current, owner)) {
    throw new Error('PyTorch publish owner changed during cleanup');
  }
  await rm(markerPath);
}

async function createOwnedPublishTransaction(outputRoot) {
  const transactionRoot = publishTransactionRoot(outputRoot);
  const owner = {
    version: 1,
    kind: PUBLISH_OWNER_KIND,
    outputRoot: path.resolve(outputRoot),
    transactionId: randomUUID(),
    pid: process.pid,
  };
  const ownerMarker = publishOwnerPath(outputRoot);
  const pendingMarker = publishPendingOwnerPath(outputRoot, owner.transactionId);
  await writeFile(pendingMarker, `${JSON.stringify(owner, null, 2)}\n`, { flag: 'wx' });
  try {
    await link(pendingMarker, ownerMarker);
  } catch (error) {
    await rm(pendingMarker, { force: true });
    if (error.code === 'EEXIST') throw new Error(`Unable to acquire PyTorch publish transaction: ${transactionRoot}`);
    throw error;
  }
  await rm(pendingMarker);
  let created = false;
  try {
    await mkdir(transactionRoot);
    created = true;
    await link(ownerMarker, path.join(transactionRoot, PUBLISH_OWNER_FILE));
  } catch (error) {
    if (created) {
      await rm(path.join(transactionRoot, PUBLISH_OWNER_FILE), { force: true });
      try {
        await rmdir(transactionRoot);
      } catch {}
    }
    await removePublishOwnerMarker(outputRoot, owner);
    if (error.code === 'EEXIST') throw new Error(`Unable to acquire PyTorch publish transaction: ${transactionRoot}`);
    throw error;
  }
  return { owner, transactionRoot };
}

async function removeOwnedPublishTree(root, outputRoot, expectedOwner) {
  const rootInfo = await lstat(root);
  if (rootInfo.isSymbolicLink() || !rootInfo.isDirectory()) {
    throw new Error(`Unsafe PyTorch publish cleanup root: ${root}`);
  }
  const owner = await readPublishOwner(root, outputRoot);
  if (!owner) {
    if (!(await readdir(root)).length) {
      await rmdir(root);
      return;
    }
    throw new Error(`Unowned PyTorch publish cleanup root: ${root}`);
  }
  if (!samePublishOwner(owner, expectedOwner)) {
    throw new Error(`Mismatched PyTorch publish cleanup owner: ${root}`);
  }
  const entries = await readdir(root);
  for (const entry of entries) {
    if (entry === PUBLISH_OWNER_FILE) continue;
    await rm(path.join(root, entry), { recursive: true, force: true });
  }
  await rm(path.join(root, PUBLISH_OWNER_FILE));
  await rmdir(root);
}

async function handoffPublishTransaction(outputRoot, transactionRoot, owner) {
  const gcRoot = publishGarbageRoot(outputRoot, owner.transactionId);
  try {
    await lstat(gcRoot);
    throw new Error(`PyTorch publish cleanup target already exists: ${gcRoot}`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  await rename(transactionRoot, gcRoot);
  await removeOwnedPublishTree(gcRoot, outputRoot, owner);
  await removePublishOwnerMarker(outputRoot, owner);
}

function validatePublishJournal(journal) {
  if (!isRecord(journal) || journal.version !== 1 || !['prepared', 'committed'].includes(journal.state)) {
    throw new Error('Invalid PyTorch publish journal');
  }
  const allowedFields = new Set(['version', 'state', 'previousFiles', 'nextFiles', 'createdFiles']);
  for (const field of Object.keys(journal)) {
    if (!allowedFields.has(field)) throw new Error(`Invalid PyTorch publish journal field: ${field}`);
  }
  for (const field of ['previousFiles', 'nextFiles']) {
    if (!Array.isArray(journal[field]) || journal[field].some((entry) => typeof entry !== 'string' || !entry)) {
      throw new Error(`Invalid PyTorch publish journal: ${field}`);
    }
    if (new Set(journal[field].map(caseFoldPath)).size !== journal[field].length) {
      throw new Error(`Invalid PyTorch publish journal: duplicate ${field} path`);
    }
  }
  if (journal.createdFiles !== undefined) {
    if (!Array.isArray(journal.createdFiles) || journal.createdFiles.some((entry) => typeof entry !== 'string' || !entry)) {
      throw new Error('Invalid PyTorch publish journal: createdFiles');
    }
    if (new Set(journal.createdFiles.map(caseFoldPath)).size !== journal.createdFiles.length) {
      throw new Error('Invalid PyTorch publish journal: duplicate createdFiles path');
    }
    if (journal.createdFiles.some((entry) => !journal.nextFiles.includes(entry))) {
      throw new Error('Invalid PyTorch publish journal: createdFiles must be nextFiles');
    }
  }
}

function samePathSet(left, right) {
  return left.length === right.length && new Set(left).size === left.length
    && left.every((entry) => right.includes(entry));
}

async function validateJournalManifests(transactionRoot, journal) {
  const nextManifestPath = path.join(transactionRoot, 'next-manifest.json');
  let nextManifestInfo;
  try {
    nextManifestInfo = await lstat(nextManifestPath);
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error('Invalid PyTorch publish journal: missing next manifest');
    throw error;
  }
  if (nextManifestInfo.isSymbolicLink() || !nextManifestInfo.isFile()) {
    throw new Error('Invalid PyTorch publish journal: unsafe next manifest');
  }
  const nextManifest = JSON.parse(await readFile(nextManifestPath, 'utf8'));
  validateManifest(nextManifest);
  if (!samePathSet(journal.nextFiles, nextManifest.generatedFiles)) {
    throw new Error('Invalid PyTorch publish journal: nextFiles do not match next manifest');
  }
  if (!journal.previousFiles.length) return;
  const previousManifest = JSON.parse(await readFile(
    await safeManagedPath(path.join(transactionRoot, 'previous'), 'manifest.json'),
    'utf8',
  ));
  validateManifest(previousManifest);
  if (!samePathSet(journal.previousFiles, previousManifest.generatedFiles)) {
    throw new Error('Invalid PyTorch publish journal: previousFiles do not match previous manifest');
  }
}

async function writePublishJournal(transactionRoot, journal) {
  const pendingPath = path.join(transactionRoot, 'journal.next.json');
  await writeFile(pendingPath, `${JSON.stringify(journal, null, 2)}\n`);
  await rename(pendingPath, path.join(transactionRoot, 'journal.json'));
}

async function publishedFileIdentity(file) {
  try {
    const info = await lstat(file, { bigint: true });
    return { dev: info.dev.toString(), ino: info.ino.toString() };
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function sameFileIdentity(left, right) {
  return Boolean(left && right && left.dev === right.dev && left.ino === right.ino);
}

async function samePublishedFile(left, right) {
  const [leftIdentity, rightIdentity] = await Promise.all([
    publishedFileIdentity(left),
    publishedFileIdentity(right),
  ]);
  return sameFileIdentity(leftIdentity, rightIdentity);
}

async function publicEntriesByCaseFold(outputRoot) {
  const entries = new Map();
  async function walk(directory, prefix = '') {
    let children;
    try {
      children = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT') return;
      throw error;
    }
    for (const child of children) {
      const relativePath = prefix ? `${prefix}/${child.name}` : child.name;
      const folded = caseFoldPath(relativePath);
      const aliases = entries.get(folded) || [];
      aliases.push(relativePath);
      entries.set(folded, aliases);
      if (child.isDirectory()) await walk(path.join(directory, child.name), relativePath);
    }
  }
  await walk(outputRoot);
  return entries;
}

async function preflightPublicOwnership(outputRoot, nextFiles, previousFiles) {
  const previousPaths = new Set(previousFiles);
  const publicEntries = await publicEntriesByCaseFold(outputRoot);
  const createdFiles = [];
  const previousIdentities = new Map();
  for (const relativePath of previousFiles) {
    const destination = await safeManagedPath(outputRoot, relativePath);
    const identity = await publishedFileIdentity(destination);
    if (identity) previousIdentities.set(relativePath, identity);
  }
  for (const relativePath of nextFiles) {
    const folded = caseFoldPath(relativePath);
    for (const existingPath of publicEntries.get(folded) || []) {
      if (!previousPaths.has(existingPath)) {
        throw new Error(`Unmanaged public target blocks PyTorch publication: ${existingPath}`);
      }
    }
    const destination = await safeManagedPath(outputRoot, relativePath);
    if (!await fileExists(destination)) createdFiles.push(relativePath);
  }
  return { createdFiles, previousIdentities };
}

async function assertPublicOwnershipUnchanged(outputRoot, relativePath, previousFiles, backupRoot, created) {
  const publicEntries = await publicEntriesByCaseFold(outputRoot);
  const previousPaths = new Set(previousFiles);
  const aliases = publicEntries.get(caseFoldPath(relativePath)) || [];
  for (const existingPath of aliases) {
    if (!previousPaths.has(existingPath)) {
      throw new Error(`Unmanaged public target blocks PyTorch publication: ${existingPath}`);
    }
    const existing = await safeManagedPath(outputRoot, existingPath);
    const backup = await safeManagedPath(backupRoot, existingPath);
    if (!await samePublishedFile(existing, backup)) {
      throw new Error(`Public target changed after ownership preflight: ${existingPath}`);
    }
  }
  const destination = await safeManagedPath(outputRoot, relativePath);
  if (!created) {
    const backup = await safeManagedPath(backupRoot, relativePath);
    if (!await samePublishedFile(destination, backup)) {
      throw new Error(`Public target changed after ownership preflight: ${relativePath}`);
    }
  }
}

async function readPublishJournal(transactionRoot) {
  const journalPath = path.join(transactionRoot, 'journal.json');
  const journal = JSON.parse(await readFile(journalPath, 'utf8'));
  validatePublishJournal(journal);
  await validateJournalManifests(transactionRoot, journal);
  return journal;
}

async function recoverPublishTransaction(outputRoot, expectedTransactionId) {
  const transactionRoot = publishTransactionRoot(outputRoot);
  const owner = await readPublishOwnerFile(publishOwnerPath(outputRoot), outputRoot);
  let transactionInfo;
  try {
    transactionInfo = await lstat(transactionRoot);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    transactionInfo = null;
  }
  if (!owner) {
    if (!transactionInfo) return;
    if (transactionInfo.isSymbolicLink() || !transactionInfo.isDirectory()) {
      throw new Error(`Unsafe PyTorch publish transaction: ${transactionRoot}`);
    }
    throw new Error(`Unowned PyTorch publish transaction directory: ${transactionRoot}`);
  }
  if (expectedTransactionId && owner.transactionId !== expectedTransactionId) {
    throw new Error('A different PyTorch publish transaction is active');
  }
  if (!expectedTransactionId && publishOwnerIsActive(owner)) {
    throw new Error(`A PyTorch publish transaction is already active (pid ${owner.pid})`);
  }

  const gcRoot = publishGarbageRoot(outputRoot, owner.transactionId);
  let gcInfo;
  try {
    gcInfo = await lstat(gcRoot);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    gcInfo = null;
  }
  if (transactionInfo && gcInfo) {
    throw new Error('Invalid PyTorch publish state: transaction and cleanup roots both exist');
  }
  if (gcInfo) {
    if (gcInfo.isSymbolicLink() || !gcInfo.isDirectory()) {
      throw new Error(`Unsafe PyTorch publish cleanup root: ${gcRoot}`);
    }
    await removeOwnedPublishTree(gcRoot, outputRoot, owner);
    await removePublishOwnerMarker(outputRoot, owner);
    return;
  }
  if (!transactionInfo) {
    await removePublishOwnerMarker(outputRoot, owner);
    return;
  }
  if (transactionInfo.isSymbolicLink() || !transactionInfo.isDirectory()) {
    throw new Error(`Unsafe PyTorch publish transaction: ${transactionRoot}`);
  }

  const innerOwner = await readPublishOwner(transactionRoot, outputRoot);
  if (!innerOwner) {
    if ((await readdir(transactionRoot)).length) {
      throw new Error(`Unowned PyTorch publish transaction directory: ${transactionRoot}`);
    }
    await rmdir(transactionRoot);
    await removePublishOwnerMarker(outputRoot, owner);
    return;
  }
  if (!samePublishOwner(innerOwner, owner)) {
    throw new Error(`Mismatched PyTorch publish transaction owner: ${transactionRoot}`);
  }

  const journalPath = path.join(transactionRoot, 'journal.json');
  let journalInfo;
  try {
    journalInfo = await lstat(journalPath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await handoffPublishTransaction(outputRoot, transactionRoot, owner);
    return;
  }
  if (journalInfo.isSymbolicLink() || !journalInfo.isFile()) {
    throw new Error('Invalid PyTorch publish journal file');
  }
  const journal = await readPublishJournal(transactionRoot);
  const previousRoot = path.join(transactionRoot, 'previous');
  const publishedRoot = path.join(transactionRoot, 'published');
  const recoveryRoot = path.join(transactionRoot, 'recovery');
  const nextByCaseFold = new Map(journal.nextFiles.map((entry) => [caseFoldPath(entry), entry]));

  if (journal.state === 'prepared') {
    await rm(recoveryRoot, { recursive: true, force: true });
    await mkdir(recoveryRoot, { recursive: true });
    for (const relativePath of journal.previousFiles) {
      const source = await safeManagedPath(previousRoot, relativePath);
      const recovery = await safeManagedPath(recoveryRoot, relativePath);
      const destination = await safeManagedPath(outputRoot, relativePath);
      const nextAlias = nextByCaseFold.get(caseFoldPath(relativePath));
      const published = nextAlias
        ? await safeManagedPath(publishedRoot, nextAlias)
        : null;
      const destinationIdentity = await publishedFileIdentity(destination);
      if (destinationIdentity && (!published || !await samePublishedFile(published, destination))) continue;
      await mkdir(path.dirname(recovery), { recursive: true });
      await cp(source, recovery, { preserveTimestamps: true, verbatimSymlinks: true });
      await mkdir(path.dirname(destination), { recursive: true });
      await rename(recovery, destination);
    }
    for (const relativePath of journal.createdFiles || []) {
      const destination = await safeManagedPath(outputRoot, relativePath);
      const published = await safeManagedPath(publishedRoot, relativePath);
      if (await samePublishedFile(published, destination)) await rm(destination, { force: true });
    }
  } else {
    for (const relativePath of journal.previousFiles) {
      const nextAlias = nextByCaseFold.get(caseFoldPath(relativePath));
      const destination = await safeManagedPath(outputRoot, relativePath);
      if (nextAlias) {
        const nextDestination = await safeManagedPath(outputRoot, nextAlias);
        if (await samePublishedFile(destination, nextDestination)) continue;
      }
      const backup = await safeManagedPath(previousRoot, relativePath);
      if (await samePublishedFile(destination, backup)) await rm(destination, { force: true });
    }
  }
  await handoffPublishTransaction(outputRoot, transactionRoot, owner);
}

async function writeOutputs(outputRoot, outputs, previousManifest, { writeFileImpl = writeFile } = {}) {
  const resolvedRoot = path.resolve(outputRoot);
  const parent = path.dirname(resolvedRoot);
  await mkdir(parent, { recursive: true });
  await recoverPublishTransaction(resolvedRoot);
  const nextFiles = [...outputs.keys()];
  const { createdFiles, previousIdentities } = await preflightPublicOwnership(
    resolvedRoot,
    nextFiles,
    previousManifest.generatedFiles || [],
  );
  const createdPaths = new Set(createdFiles);
  const { owner, transactionRoot } = await createOwnedPublishTransaction(resolvedRoot);
  const stagedRoot = path.join(transactionRoot, 'next');
  const backupRoot = path.join(transactionRoot, 'previous');
  const publishedRoot = path.join(transactionRoot, 'published');

  try {
    await mkdir(stagedRoot, { recursive: true });
    await mkdir(backupRoot, { recursive: true });
    for (const [relativePath, content] of outputs) {
      const destination = await safeManagedPath(stagedRoot, relativePath);
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFileImpl(destination, content);
    }
    await checkOutputs(stagedRoot, outputs, {});

    for (const relativePath of previousManifest.generatedFiles || []) {
      const source = await safeManagedPath(resolvedRoot, relativePath);
      const destination = await safeManagedPath(backupRoot, relativePath);
      const expectedIdentity = previousIdentities.get(relativePath);
      if (!expectedIdentity) {
        throw new Error(`Public target changed after ownership preflight: ${relativePath}`);
      }
      await mkdir(path.dirname(destination), { recursive: true });
      await link(source, destination);
      if (!sameFileIdentity(await publishedFileIdentity(destination), expectedIdentity)) {
        throw new Error(`Public target changed after ownership preflight: ${relativePath}`);
      }
    }
    const journal = {
      version: 1,
      state: 'prepared',
      previousFiles: previousManifest.generatedFiles || [],
      nextFiles,
      createdFiles,
    };
    validatePublishJournal(journal);
    await writeFile(path.join(transactionRoot, 'next-manifest.json'), outputs.get('manifest.json'));
    await validateJournalManifests(transactionRoot, journal);
    await writePublishJournal(transactionRoot, journal);

    const publishFiles = journal.nextFiles.filter((entry) => entry !== 'manifest.json');
    publishFiles.push('manifest.json');
    for (const relativePath of publishFiles) {
      const source = await safeManagedPath(stagedRoot, relativePath);
      const destination = await safeManagedPath(resolvedRoot, relativePath);
      const published = await safeManagedPath(publishedRoot, relativePath);
      await mkdir(path.dirname(destination), { recursive: true });
      await mkdir(path.dirname(published), { recursive: true });
      await link(source, published);
      await assertPublicOwnershipUnchanged(
        resolvedRoot,
        relativePath,
        journal.previousFiles,
        backupRoot,
        createdPaths.has(relativePath),
      );
      if (createdPaths.has(relativePath)) await link(source, destination);
      else await rename(source, destination);
    }
    await writePublishJournal(transactionRoot, { ...journal, state: 'committed' });
    const nextByCaseFold = new Map(journal.nextFiles.map((entry) => [caseFoldPath(entry), entry]));
    for (const relativePath of journal.previousFiles) {
      const destination = await safeManagedPath(resolvedRoot, relativePath);
      const nextAlias = nextByCaseFold.get(caseFoldPath(relativePath));
      if (nextAlias) {
        const nextDestination = await safeManagedPath(resolvedRoot, nextAlias);
        if (await samePublishedFile(destination, nextDestination)) continue;
      }
      const backup = await safeManagedPath(backupRoot, relativePath);
      if (await samePublishedFile(destination, backup)) await rm(destination, { force: true });
    }
    await handoffPublishTransaction(resolvedRoot, transactionRoot, owner);
  } catch (error) {
    await recoverPublishTransaction(resolvedRoot, owner.transactionId);
    throw error;
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
  writeFileImpl,
}) {
  if (!sourceRoot) throw new Error('Missing required --source directory');
  const resolvedSource = path.resolve(sourceRoot);
  const resolvedOutput = path.resolve(outputRoot);
  if (!(await stat(resolvedSource)).isDirectory()) throw new Error(`Source is not a directory: ${resolvedSource}`);
  await recoverPublishTransaction(resolvedOutput);
  const previousManifest = await readManifest(resolvedOutput) || {};
  for (const generatedPath of previousManifest.generatedFiles || []) {
    await safeManagedPath(resolvedOutput, generatedPath);
  }
  const notes = await collectSourceNotes(resolvedSource, previousManifest);
  const allFiles = await walkFiles(resolvedSource);
  const assetFiles = allFiles.filter((file) => path.extname(file).toLowerCase() !== '.md');
  const noteIndex = buildNoteIndex(notes);
  const warnings = [];
  const localAssets = new Map();
  const remoteUrls = collectPublicationInputs(notes, {
    sourceRoot: resolvedSource,
    noteIndex,
    assetFiles,
    localAssets,
  });
  await scanSecrets(notes, resolvedSource, [...new Set(localAssets.values())]);
  const remote = await buildRemoteAssets(remoteUrls, previousManifest, {
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
    const readingSequence = note.isOverview ? [note] : notes.filter((candidate) => !candidate.isOverview);
    outputs.set(`notes/${note.stageKey}/${note.slug}.html`, renderArticle(note, html, readingSequence));
    outputs.set(`markdown/${note.stageKey}/${note.slug}.md`, note.content);
  }
  for (const [destination, source] of localAssets) outputs.set(destination, await readFile(source));
  const stages = [...STAGES.values()];
  outputs.set('index.html', renderArchiveIndex(notes, stages));
  for (const stage of stages) {
    outputs.set(`${stage.key}/index.html`, renderStageIndex(stage, notes.filter((note) => note.stageKey === stage.key), stages));
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
  else await writeOutputs(resolvedOutput, outputs, previousManifest, { writeFileImpl });
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
    else if (argument === '--help') options.help = true;
    else throw new Error(`Unknown argument: ${argument}`);
  }
  return options;
}

async function main() {
  try {
    const options = parseArguments(process.argv.slice(2));
    if (options.help) {
      console.log(CLI_HELP);
      return;
    }
    const result = await synchronize(options);
    for (const warning of result.warnings) console.warn(`warning: ${warning}`);
    const mode = process.argv.includes('--check') ? 'checked' : 'synchronized';
    console.log(`PyTorch archive ${mode}: ${result.notes} notes, ${result.stages} stages, ${result.remoteAssets} remote images, ${result.warnings.length} warnings.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
