# ── Cloudflare zone ────────────────────────────────────────────────

resource "cloudflare_zone" "wallabyfest" {
  account = {
    id = var.cloudflare_account_id
  }
  name = local.my_domain
  type = "full"
}

# ── Worker script ──────────────────────────────────────────────────

resource "cloudflare_workers_script" "wallabyfest" {
  account_id         = var.cloudflare_account_id
  script_name        = "wallabyfest"
  content_file       = "${path.module}/../worker/index.js"
  content_sha256     = filesha256("${path.module}/../worker/index.js")
  main_module        = "index.js"
  compatibility_date = "2024-01-01"

  assets = {
    config = {
      not_found_handling = "404-page" # uses your public/404.html
      run_worker_first   = false      # static assets served directly; flip to path list for auth later
    }
    directory = "${path.module}/../public"
  }
}

# ── Attach Worker to the domain ────────────────────────────────────

resource "cloudflare_workers_custom_domain" "wallabyfest" {
  account_id = var.cloudflare_account_id
  hostname   = local.my_domain
  service    = cloudflare_workers_script.wallabyfest.script_name
  zone_id    = cloudflare_zone.wallabyfest.id
}
