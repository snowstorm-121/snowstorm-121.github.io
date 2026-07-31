import assert from "node:assert/strict";
import test from "node:test";

import { createVisitorCounter } from "../src/index.mjs";

const ALLOWED_ORIGIN = "https://snowstorm-121.github.io";
const PEPPER = "test-only-counter-pepper";

class InMemoryD1 {
  #visitors = new Map();

  prepare(query) {
    return new InMemoryStatement(this.#visitors, query);
  }

  values() {
    return [...this.#visitors.entries()].map(([visitorHash, visitor]) => ({ visitorHash, ...visitor }));
  }
}

class InMemoryStatement {
  #visitors;
  #query;
  #parameters = [];

  constructor(visitors, query) {
    this.#visitors = visitors;
    this.#query = query.replace(/\s+/g, " ").trim();
  }

  bind(...parameters) {
    this.#parameters = parameters;
    return this;
  }

  async run() {
    if (!this.#query.startsWith("INSERT INTO visitors")) {
      throw new Error(`Unexpected D1 write query: ${this.#query}`);
    }

    const [visitorHash, day] = this.#parameters;
    const previous = this.#visitors.get(visitorHash);
    this.#visitors.set(visitorHash, {
      firstSeenDay: previous?.firstSeenDay ?? day,
      lastSeenDay: day,
    });
    return { success: true };
  }

  async first() {
    if (this.#query === "SELECT COUNT(*) AS count FROM visitors") {
      return { count: this.#visitors.size };
    }

    if (this.#query === "SELECT COUNT(*) AS count FROM visitors WHERE last_seen_day = ?") {
      const [day] = this.#parameters;
      return {
        count: [...this.#visitors.values()].filter((visitor) => visitor.lastSeenDay === day).length,
      };
    }

    throw new Error(`Unexpected D1 read query: ${this.#query}`);
  }
}

function createRequest(visitorId, options = {}) {
  const method = options.method ?? "POST";
  return new Request(`https://counter.example${options.path ?? "/v1/visit"}`, {
    method,
    headers: { Origin: options.origin ?? ALLOWED_ORIGIN },
    body: method === "GET" || method === "HEAD" ? undefined : visitorId,
  });
}

function createHarness(day) {
  const database = new InMemoryD1();
  const worker = createVisitorCounter({ now: () => new Date(day) });
  return {
    database,
    fetch: (request) => worker.fetch(request, {
      ALLOWED_ORIGIN,
      COUNTER_PEPPER: PEPPER,
      VISITORS: database,
    }),
  };
}

test("counts first visits, same-day repeats, and a second anonymous visitor", async () => {
  const { database, fetch } = createHarness("2026-07-31T01:00:00.000Z");
  const firstVisitor = "a".repeat(32);
  const secondVisitor = "b".repeat(32);

  const first = await fetch(createRequest(firstVisitor));
  assert.equal(first.status, 200);
  assert.deepEqual(await first.json(), { totalVisitors: 1, todayVisitors: 1 });

  const repeat = await fetch(createRequest(firstVisitor));
  assert.deepEqual(await repeat.json(), { totalVisitors: 1, todayVisitors: 1 });

  const second = await fetch(createRequest(secondVisitor));
  assert.deepEqual(await second.json(), { totalVisitors: 2, todayVisitors: 2 });

  const storedVisitors = database.values();
  assert.equal(storedVisitors.length, 2);
  assert.ok(storedVisitors.every(({ visitorHash }) => /^[a-f0-9]{64}$/.test(visitorHash)));
  assert.ok(storedVisitors.every(({ visitorHash }) => visitorHash !== firstVisitor && visitorHash !== secondVisitor));
});

test("keeps cumulative count while a repeat visit after Beijing midnight starts a new today count", async () => {
  const database = new InMemoryD1();
  const visitor = "c".repeat(32);
  const env = { ALLOWED_ORIGIN, COUNTER_PEPPER: PEPPER, VISITORS: database };

  const beforeMidnight = createVisitorCounter({ now: () => new Date("2026-07-31T15:59:59.000Z") });
  const afterMidnight = createVisitorCounter({ now: () => new Date("2026-07-31T16:00:00.000Z") });

  assert.deepEqual(await (await beforeMidnight.fetch(createRequest(visitor), env)).json(), {
    totalVisitors: 1,
    todayVisitors: 1,
  });
  assert.deepEqual(await (await afterMidnight.fetch(createRequest(visitor), env)).json(), {
    totalVisitors: 1,
    todayVisitors: 1,
  });
});

test("rejects invalid methods, paths, Origins, and anonymous identifiers", async () => {
  const { fetch } = createHarness("2026-07-31T01:00:00.000Z");
  const visitor = "d".repeat(32);

  for (const request of [
    createRequest(visitor, { method: "GET" }),
    createRequest(visitor, { path: "/v1/other" }),
    createRequest(visitor, { origin: "https://example.com" }),
    createRequest("D".repeat(32)),
    createRequest("not-a-valid-visitor-id"),
  ]) {
    const response = await fetch(request);
    assert.notEqual(response.status, 200);
  }
});

test("returns exact no-store CORS headers and never exposes IP-related fields", async () => {
  const { fetch } = createHarness("2026-07-31T01:00:00.000Z");
  const response = await fetch(createRequest("e".repeat(32)));

  assert.equal(response.headers.get("Access-Control-Allow-Origin"), ALLOWED_ORIGIN);
  assert.equal(response.headers.get("Access-Control-Allow-Methods"), "POST");
  assert.equal(response.headers.get("Access-Control-Allow-Headers"), "Content-Type");
  assert.equal(response.headers.get("Vary"), "Origin");
  assert.equal(response.headers.get("Cache-Control"), "no-store");

  const payload = await response.json();
  assert.deepEqual(Object.keys(payload).sort(), ["todayVisitors", "totalVisitors"]);
  assert.equal(JSON.stringify(payload).match(/ip|user-agent|path|geo|fingerprint/i), null);
});
