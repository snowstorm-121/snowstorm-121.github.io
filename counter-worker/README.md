# Anonymous visitor counter

This Worker records only an HMAC hash of the homepage's anonymous browser identifier plus first/last visit days. It does not store IP addresses, User-Agent values, page paths, or other visitor profiles.

## Deploy

Run the following commands from this directory after logging in with Wrangler:

```sh
wrangler d1 migrations apply snowstorm-homepage-visitors --remote
wrangler secret put COUNTER_PEPPER
wrangler deploy
```

`COUNTER_PEPPER` is an opaque, high-entropy secret. Enter it only at Wrangler's prompt; never add it to this repository or a configuration file. To rotate it, run `wrangler secret put COUNTER_PEPPER` again. Rotation intentionally makes existing anonymous identifiers appear new, because their stored HMAC values can no longer match.

## Local-origin development

Do not edit the committed production `wrangler.toml`. Create an untracked `wrangler.local.toml` with the same Worker and D1 binding configuration, then set:

```toml
[vars]
ALLOWED_ORIGIN = "http://127.0.0.1:4173"
```

Use that untracked file only for local development:

```sh
wrangler dev --config wrangler.local.toml
```
