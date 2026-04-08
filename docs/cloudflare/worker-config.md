# Worker Config

Current Worker config lives in `wrangler.toml`.

## Main entrypoint

```toml
main = "worker/router.js"
```

## Build and assets

```toml
[build]
command = "npm run build"

[assets]
directory = "dist"
not_found_handling = "404-page"
```

## Route

```toml
[[routes]]
pattern = "wallabyfest.co.uk"
custom_domain = true
```

## D1 binding requirement

Worker code expects:

```toml
binding = "GUESTS_DB"
```

If this binding name does not match, guest endpoints will fail with database configuration errors.
