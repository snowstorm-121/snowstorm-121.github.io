#!/usr/bin/env node

import { createHash } from 'node:crypto';
import {
  access,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import MarkdownIt from 'markdown-it';

const SITE_ROOT = '/learning/pytorch';
const MANIFEST_VERSION = 1;
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
    ['private key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
    ['AWS credential', /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/],
    ['GitHub credential', /\bgh[pousr]_[A-Za-z0-9]{30,}\b/],
    ['OpenAI credential', /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/],
    ['Slack credential', /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/],
  ];
  const findings = [];
  const sources = notes.map((note) => ({ sourcePath: note.sourcePath, content: note.content }));
  const textAttachments = allFiles.filter((file) => /\.(?:py|txt|json|ya?ml|toml|env|ini|cfg)$/i.test(file));
  for (const absolutePath of textAttachments) {
    sources.push({
      sourcePath: normalizePath(path.relative(sourceRoot, absolutePath)),
      content: await readFile(absolutePath, 'utf8'),
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
  return { target: targetWithPath.replace(/\.md$/i, ''), heading };
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

function remoteAssetPath(url) {
  const urlPath = new URL(url).pathname;
  const extension = path.extname(urlPath).toLowerCase();
  const safeExtension = /^\.(?:png|jpe?g|gif|webp|svg|avif)$/.test(extension) ? extension : '.img';
  const digest = createHash('sha256').update(url).digest('hex').slice(0, 20);
  return `assets/remote/${digest}${safeExtension}`;
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

async function defaultFetchAsset(url) {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) throw new Error(`Remote image download failed (${response.status}): ${url}`);
  return Buffer.from(await response.arrayBuffer());
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
  let inFence = false;
  const placeholders = [];
  const lines = markdown.split(/\r?\n/).map((line, lineIndex) => {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      return line;
    }
    if (inFence) return line;
    let transformed = line.replace(/^(\s*)- \[([ xX])\]\s+/, (_, indent, checked) => {
      const marker = checked.toLowerCase() === 'x' ? 'PYTORCH_TASK_CHECKED' : 'PYTORCH_TASK_UNCHECKED';
      return `${indent}- ${marker} `;
    });
    const segments = transformed.split(/(`+[^`]*`+)/g);
    transformed = segments.map((segment, index) => {
      if (index % 2) return segment;
      return segment.replace(/(!?)\[\[([^\]]+)\]\]/g, (_, embed, body) => {
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
    }).join('');
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
    return JSON.parse(await readFile(path.join(outputRoot, 'manifest.json'), 'utf8'));
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
      const existing = path.join(options.outputRoot, previous[url]);
      if (!(await fileExists(existing))) throw new Error(`Missing localized remote image: ${previous[url]}`);
      remoteAssets[url] = previous[url];
      downloaded.set(previous[url], await readFile(existing));
      continue;
    }
    if (!options.fetchRemoteAssets) throw new Error(`New remote image ${url}; run with --fetch-remote-assets`);
    const destination = remoteAssetPath(url);
    const fetcher = options.fetchAsset || defaultFetchAsset;
    remoteAssets[url] = destination;
    downloaded.set(destination, Buffer.from(await fetcher(url)));
  }
  return { remoteAssets, downloaded };
}

function safeManagedPath(outputRoot, relativePath) {
  const normalized = normalizePath(relativePath);
  if (!normalized || normalized.startsWith('/') || normalized.split('/').includes('..')) {
    throw new Error(`Unsafe generated manifest path: ${relativePath}`);
  }
  const absolute = path.resolve(outputRoot, normalized);
  if (!absolute.startsWith(`${path.resolve(outputRoot)}${path.sep}`)) throw new Error(`Unsafe generated manifest path: ${relativePath}`);
  return absolute;
}

async function writeOutputs(outputRoot, outputs, previousManifest) {
  const desired = new Set(outputs.keys());
  for (const oldPath of previousManifest.generatedFiles || []) {
    if (!desired.has(oldPath)) await rm(safeManagedPath(outputRoot, oldPath), { force: true });
  }
  for (const [relativePath, content] of outputs) {
    const destination = safeManagedPath(outputRoot, relativePath);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, content);
  }
}

async function checkOutputs(outputRoot, outputs, previousManifest) {
  const drift = [];
  for (const [relativePath, expected] of outputs) {
    try {
      const actual = await readFile(safeManagedPath(outputRoot, relativePath));
      if (!actual.equals(Buffer.from(expected))) drift.push(relativePath);
    } catch (error) {
      if (error.code === 'ENOENT') drift.push(relativePath);
      else throw error;
    }
  }
  const desired = new Set(outputs.keys());
  for (const oldPath of previousManifest.generatedFiles || []) {
    if (!desired.has(oldPath) && await fileExists(safeManagedPath(outputRoot, oldPath))) drift.push(oldPath);
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
