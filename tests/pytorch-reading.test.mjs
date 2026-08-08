import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const archiveRoot = path.join(repoRoot, 'learning', 'pytorch');
const manifest = JSON.parse(await readFile(path.join(archiveRoot, 'manifest.json'), 'utf8'));
const STAGE_KEYS = ['foundation', 'stage-1', 'stage-2', 'stage-3', 'stage-4', 'stage-5', 'stage-6'];

const readArchive = (relativePath) => readFile(path.join(archiveRoot, relativePath), 'utf8');
const notePath = (note) => path.join(archiveRoot, 'notes', note.stageKey, `${note.slug}.html`);
const noteUrl = (note) => `/learning/pytorch/notes/${note.stageKey}/${encodeURIComponent(note.slug)}.html`;

test('PyTorch archive presents its seven ordered stages as a tide timeline', async () => {
  const index = await readArchive('index.html');

  assert.match(index, /class="pytorch-tide-timeline"[^>]*data-stage-count="7"/);
  const stageKeys = [...index.matchAll(/class="tide-stage"[^>]*data-stage-key="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(manifest.stages.map((stage) => stage.key), STAGE_KEYS);
  assert.deepEqual(stageKeys, STAGE_KEYS);

  for (const stage of manifest.stages) {
    const count = manifest.notes.filter((note) => note.stageKey === stage.key).length;
    assert.match(index, new RegExp(`data-stage-key="${stage.key}"[\\s\\S]*?${count} 篇`));
    assert.match(index, new RegExp(`href="\\./${stage.key}\\/"`));
  }
});

test('stage pages retain manifest article order, counts, and adjacent-stage navigation', async () => {
  for (const [stageIndex, stage] of manifest.stages.entries()) {
    const page = await readArchive(`${stage.key}/index.html`);
    const notes = manifest.notes.filter((note) => note.stageKey === stage.key);

    assert.match(page, new RegExp(`class="stage-note-count"[^>]*>${notes.length} 篇`));
    const orderedUrls = [...page.matchAll(/class="stage-note-link"[^>]*href="([^"]+)"/g)].map((match) => match[1]);
    assert.deepEqual(orderedUrls, notes.map(noteUrl));
    if (stageIndex > 0) assert.match(page, new RegExp(`class="stage-neighbor previous"[\\s\\S]*?href="\\.\\./${manifest.stages[stageIndex - 1].key}\\/"`));
    if (stageIndex < manifest.stages.length - 1) assert.match(page, new RegExp(`class="stage-neighbor next"[\\s\\S]*?href="\\.\\./${manifest.stages[stageIndex + 1].key}\\/"`));
  }
});

test('generated archive shells do not add trailing whitespace', async () => {
  for (const relativePath of ['index.html', ...manifest.stages.map((stage) => `${stage.key}/index.html`)]) {
    assert.doesNotMatch(await readArchive(relativePath), /[ \t]+\n/);
  }
});

test('every manifest article has a readable shell, resolvable local targets, and non-empty table-of-contents links', async () => {
  assert.equal(manifest.notes.length, 32);
  for (const note of manifest.notes) {
    const article = await readFile(notePath(note), 'utf8');
    const stageNotes = manifest.notes.filter((candidate) => candidate.stageKey === note.stageKey);
    const noteIndex = stageNotes.findIndex((candidate) => candidate.slug === note.slug);
    const previous = noteIndex > 0 ? stageNotes[noteIndex - 1] : null;
    const next = noteIndex >= 0 && noteIndex < stageNotes.length - 1 ? stageNotes[noteIndex + 1] : null;

    assert.match(article, /class="[^"]*pytorch-reading-page(?:\s|\")/);
    assert.match(article, /class="reading-progress"[^>]*data-reading-progress/);
    assert.match(article, /class="reading-layout"/);
    assert.match(article, /class="reading-toc"/);
    assert.match(article, /<details class="reading-toc-details" open>/);
    assert.match(article, /href="\/learning\/"[^>]*>[^<]*返回星图</);
    const neighbors = article.match(/<nav class="article-neighbors"[\s\S]*?<\/nav>/)?.[0] ?? '';
    assert.match(neighbors, previous ? new RegExp(`href="${noteUrl(previous).replaceAll('/', '\\/')}"`) : /class="article-neighbor previous" aria-hidden="true"/);
    assert.match(neighbors, next ? new RegExp(`href="${noteUrl(next).replaceAll('/', '\\/')}"`) : /class="article-neighbor next" aria-hidden="true"/);

    for (const [, id, label] of article.matchAll(/<li class="toc-level-[23]"><a href="#([^"]+)">([\s\S]*?)<\/a><\/li>/g)) {
      assert.ok(label.replace(/<[^>]+>/g, '').trim(), `${note.slug}: empty TOC label for #${id}`);
      assert.match(article, new RegExp(`<h[23] id="${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}">`), `${note.slug}: missing TOC target #${id}`);
    }

    for (const [, href] of article.matchAll(/<a\b[^>]*\bhref="(\/learning\/[^"]+)"/g)) {
      const pathname = decodeURIComponent(new URL(href, 'https://archive.invalid').pathname);
      const destination = pathname === '/learning/'
        ? path.join(repoRoot, 'learning', 'index.html')
        : path.join(repoRoot, pathname.slice(1));
      await access(destination);
    }
  }

  const stageFive = manifest.notes.find((note) => note.stageKey === 'stage-5');
  const stageFiveArticle = await readFile(notePath(stageFive), 'utf8');
  const stageFiveMarkdown = await readArchive(`markdown/${stageFive.stageKey}/${stageFive.slug}.md`);
  const localPath = '/Users/yyy/code/pytorch_study/Stage_5_Projects/bert-full-vs-lora/';
  assert.match(stageFiveMarkdown, new RegExp(localPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(stageFiveArticle, new RegExp(localPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

  const taskArticle = await readFile(notePath(manifest.notes.find((note) => note.stageKey === 'stage-6')), 'utf8');
  assert.match(taskArticle, /<ul class="task-list">[\s\S]*?<li class="task-list-item"><input type="checkbox"/);
});

test('reading styles preserve a still, system-cursor long-form experience and glass treatment for note content', async () => {
  const css = await readFile(path.join(repoRoot, 'assets', 'pytorch-reading.css'), 'utf8');

  assert.match(css, /body\.pytorch-reading-page[\s\S]*?cursor:\s*auto/);
  assert.match(css, /\.reading-layout[\s\S]*?minmax\(0,\s*46rem\)/);
  assert.match(css, /\.note-content table[\s\S]*?backdrop-filter/);
  assert.match(css, /\.note-content pre[\s\S]*?background:/);
  assert.match(css, /\.note-content blockquote[\s\S]*?border-left:/);
  assert.match(css, /\.note-content \.task-list[\s\S]*?border:[\s\S]*?background:[\s\S]*?backdrop-filter/);
  assert.match(css, /\.note-content \.task-list-item[\s\S]*?border-bottom/);
  assert.match(css, /\.note-content input\[type="checkbox"\][\s\S]*?accent-color/);
  assert.match(css, /\.note-content img[\s\S]*?border:/);
  assert.match(css, /\.source-attachment[\s\S]*?backdrop-filter/);
  assert.match(css, /@media \(max-width: 720px\)[\s\S]*?\.reading-toc[\s\S]*?position:\s*static/);
  assert.match(css, /@media \(pointer: coarse\)[\s\S]*?\.reading-toc-details summary[\s\S]*?min-height:\s*44px/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?animation:\s*none[\s\S]*?transition:\s*none/);
});

test('reading progress handles missing elements, bounded positions, and zero scroll ranges without animation frames', async () => {
  const script = await readFile(path.join(repoRoot, 'assets', 'pytorch-reading.js'), 'utf8');
  function runProgress({ scrollHeight = 1200, clientHeight = 600, scrollTop = 0, hasProgress = true } = {}) {
    const progress = { style: { setProperty(name, value) { this[name] = value; } } };
    const document = {
      body: { scrollHeight, scrollTop },
      documentElement: { scrollHeight, clientHeight, scrollTop },
      querySelector(selector) { return selector === '[data-reading-progress]' && hasProgress ? progress : null; },
    };
    const window = { addEventListener() {}, document };
    vm.runInNewContext(script, { window, document });
    return { progress, window };
  }

  assert.doesNotThrow(() => runProgress({ hasProgress: false }));
  assert.equal(runProgress({ scrollTop: 0 }).progress.style['--reading-progress'], '0%');
  assert.equal(runProgress({ scrollTop: 600 }).progress.style['--reading-progress'], '100%');
  assert.equal(runProgress({ scrollTop: -30 }).progress.style['--reading-progress'], '0%');
  assert.equal(runProgress({ scrollTop: 900 }).progress.style['--reading-progress'], '100%');
  assert.equal(runProgress({ scrollHeight: 600, clientHeight: 600, scrollTop: 30 }).progress.style['--reading-progress'], '0%');
  assert.doesNotMatch(script, /requestAnimationFrame/);
});
