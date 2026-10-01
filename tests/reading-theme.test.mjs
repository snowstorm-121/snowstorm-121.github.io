import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../assets/reading-theme.js", import.meta.url), "utf8").catch(() => "");
const styles = await readFile(new URL("../assets/reading-theme.css", import.meta.url), "utf8").catch(() => "");
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

function runtime({ saved = null, dark = false, denied = false, home = false } = {}) {
  const documentEvents = {}, windowEvents = {}, mediaEvents = {}, buttonEvents = {};
  const writes = [];
  const button = { dataset: {}, attributes: {}, setAttribute(name, value) { this.attributes[name] = value; }, addEventListener(name, fn) { buttonEvents[name] = fn; } };
  const root = { dataset: {}, hasAttribute: (name) => home && name === "data-reading-home" };
  const meta = { content: "#07101c" };
  let ready = false;
  const media = { matches: dark, addEventListener(name, fn) { mediaEvents[name] = fn; } };
  vm.runInNewContext(source, {
    document: { documentElement: root, querySelector: () => meta, querySelectorAll: () => ready ? [button] : [], addEventListener(name, fn) { documentEvents[name] = fn; } },
    window: { addEventListener(name, fn) { windowEvents[name] = fn; } },
    matchMedia: () => media,
    localStorage: { getItem() { if (denied) throw Error("denied"); return saved; }, setItem(key, value) { if (denied) throw Error("denied"); writes.push([key, value]); } },
  });
  return { root, meta, button, writes, ready() { ready = true; documentEvents.DOMContentLoaded?.(); }, click() { buttonEvents.click?.(); }, system(value) { media.matches = value; mediaEvents.change?.(); }, storage(key, newValue) { windowEvents.storage?.({ key, newValue }); } };
}

test("theme follows OS before DOM ready without an override", () => {
  assert.equal(runtime({ dark: true }).root.dataset.readingTheme, "dark");
  assert.equal(runtime().root.dataset.readingTheme, "light");
});
test("saved light overrides a dark OS before DOM ready", () => {
  assert.equal(runtime({ saved: "light", dark: true }).root.dataset.readingTheme, "light");
});
test("native click persists mode and updates accessible state", () => {
  const page = runtime(); page.ready(); page.click();
  assert.equal(page.root.dataset.readingTheme, "dark");
  assert.deepEqual(page.writes, [["snowstorm-reading-theme", "dark"]]);
  assert.equal(page.button.dataset.mode, "dark");
  assert.equal(page.button.attributes["aria-pressed"], "true");
  assert.equal(page.button.attributes["aria-label"], "阅读模式：夜间，切换为日间");
  page.click();
  assert.equal(page.button.attributes["aria-pressed"], "false");
  assert.equal(page.button.attributes["aria-label"], "阅读模式：日间，切换为夜间");
});
test("storage denial still changes the current mode", () => {
  const page = runtime({ denied: true }); page.ready(); page.click(); page.system(false);
  assert.equal(page.root.dataset.readingTheme, "dark");
});
test("storage event updates another tab and clearing resumes OS mode", () => {
  const page = runtime(); page.ready();
  page.storage("other-key", "dark"); assert.equal(page.root.dataset.readingTheme, "light");
  page.storage("snowstorm-reading-theme", "dark"); assert.equal(page.root.dataset.readingTheme, "dark");
  page.storage("snowstorm-reading-theme", null); assert.equal(page.root.dataset.readingTheme, "light");
});
test("system changes update only when there is no override", () => {
  const page = runtime({ saved: "invalid" }); page.ready(); page.system(true);
  assert.equal(page.root.dataset.readingTheme, "dark");
  page.click(); page.system(false); page.system(true);
  assert.equal(page.root.dataset.readingTheme, "light");
});
test("homepage retains its night sea meta color in both reading modes", () => {
  const page = runtime({ home: true }); page.ready(); page.click();
  assert.equal(page.meta.content, "#07101c");
  assert.match(html, /name="theme-color" content="#07101c"/);
});
test("reading pages update theme color with current mode", () => {
  const page = runtime(); assert.equal(page.meta.content, "#f4f0e9");
  page.ready(); page.click(); assert.equal(page.meta.content, "#0a1623");
});
test("shared theme exposes reading tokens and an accessible tide pin", () => {
  for (const token of ["surface", "ink", "accent", "muted", "line"]) assert.match(styles, new RegExp(`--reading-${token}:`));
  assert.match(styles, /#0a1623/); assert.match(styles, /#f4f0e9/);
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /prefers-reduced-motion: reduce[\s\S]*?transition: none/);
  assert.doesNotMatch(styles, /cursor:\s*(?:url|none)|--ink:/);
});
test("homepage applies theme before styles and places one native toggle inside header", () => {
  assert.match(html, /reading-theme\.js"><\/script>[\s\S]*homepage\.css[\s\S]*reading-theme\.css/);
  assert.equal((html.match(/<button[^>]*data-reading-theme-toggle/g) ?? []).length, 1);
  assert.match(html, /<header class="site-header">[\s\S]*<button[^>]*data-reading-theme-toggle[\s\S]*阅读模式[\s\S]*昼[\s\S]*夜[\s\S]*<\/header>/);
});
