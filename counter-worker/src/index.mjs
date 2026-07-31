const DEFAULT_ALLOWED_ORIGIN = "https://snowstorm-121.github.io";
const VISITOR_ID_PATTERN = /^[a-f0-9]{32}$/;

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
    "Cache-Control": "no-store",
  };
}

function failure(status, message) {
  return new Response(message, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function shanghaiDay(date) {
  const values = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date).reduce((parts, part) => {
    parts[part.type] = part.value;
    return parts;
  }, {});

  return `${values.year}-${values.month}-${values.day}`;
}

async function hashVisitorId(visitorId, pepper) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pepper),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(visitorId));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function createVisitorCounter({ now = () => new Date() } = {}) {
  return {
    async fetch(request, env) {
      const allowedOrigin = env.ALLOWED_ORIGIN ?? DEFAULT_ALLOWED_ORIGIN;
      if (request.method !== "POST") {
        return failure(405, "Method Not Allowed");
      }
      if (new URL(request.url).pathname !== "/v1/visit") {
        return failure(404, "Not Found");
      }
      if (request.headers.get("Origin") !== allowedOrigin) {
        return failure(403, "Forbidden");
      }

      const visitorId = await request.text();
      if (!VISITOR_ID_PATTERN.test(visitorId)) {
        return failure(400, "Invalid visitor identifier");
      }

      const visitorHash = await hashVisitorId(visitorId, env.COUNTER_PEPPER);
      const day = shanghaiDay(now());
      await env.VISITORS.prepare(
        `INSERT INTO visitors (visitor_hash, first_seen_day, last_seen_day)
         VALUES (?, ?, ?)
         ON CONFLICT(visitor_hash) DO UPDATE SET last_seen_day = excluded.last_seen_day`,
      ).bind(visitorHash, day, day).run();

      const total = await env.VISITORS.prepare("SELECT COUNT(*) AS count FROM visitors").first();
      const today = await env.VISITORS.prepare(
        "SELECT COUNT(*) AS count FROM visitors WHERE last_seen_day = ?",
      ).bind(day).first();

      return new Response(JSON.stringify({
        totalVisitors: Number(total.count),
        todayVisitors: Number(today.count),
      }), {
        headers: {
          ...corsHeaders(allowedOrigin),
          "Content-Type": "application/json; charset=UTF-8",
        },
      });
    },
  };
}

export default createVisitorCounter();
