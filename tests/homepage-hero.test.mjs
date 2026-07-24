import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const readOptional = (path) => readFile(new URL(path, import.meta.url), "utf8").catch(() => "");
const [html, styles, script] = await Promise.all([
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readOptional("../assets/homepage/homepage.css"),
  readOptional("../assets/homepage/homepage.js"),
]);
const page = `${html}\n${styles}\n${script}`;

test("homepage uses a semantic four-act shell and one local runtime", () => {
  for (const id of ["origin", "identity", "archive", "connection"]) {
    assert.match(html, new RegExp(`<section[^>]+id="${id}"`));
  }
  assert.match(html, /href="\.\/assets\/homepage\/homepage\.css"/);
  assert.match(html, /src="\.\/assets\/homepage\/homepage\.js" defer/);
  assert.equal((html.match(/<audio\s+id="profileAudio"/g) ?? []).length, 1);
  assert.doesNotMatch(script, /new Audio\s*\(/);
  assert.doesNotMatch(html, /<style[\s>]/);
  assert.doesNotMatch(html, /<script>(?:.|\n)*?<\/script>/);
});
