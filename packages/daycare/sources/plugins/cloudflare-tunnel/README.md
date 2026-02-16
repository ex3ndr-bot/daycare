# Cloudflare Tunnel plugin

## Overview
Registers a public expose tunnel provider backed by the local `cloudflared` CLI.

## Onboarding
- Prompts for a Cloudflare tunnel token
- Stores token in auth store under plugin instance id

## Behavior
- Ensures a managed `cloudflared tunnel --no-autoupdate run` process is running
  - Process is started via engine `Processes` as `keepAlive: true`
  - Process owner is bound to plugin instance id
  - Plugin-owned process is automatically removed on plugin unload/delete
- Resolves a base hostname/domain from `cloudflared tunnel info --output json`
- Registers provider capabilities `{ public: true, localNetwork: false }`
- Creates/removes DNS routing entries for generated endpoint domains
