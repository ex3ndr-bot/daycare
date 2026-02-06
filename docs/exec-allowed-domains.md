# Exec Allowed Domains

The `exec` tool can optionally allow outbound network access for specific domains.
The list is explicit: exact domains are allowed, and subdomain wildcards like
`*.example.com` are supported. A global wildcard (`*`) is not allowed.

`exec` and exec gates also support a typed package-manager preset list:
- `go` -> `proxy.golang.org`, `sum.golang.org`, `index.golang.org`, `golang.org`
- `node` -> `registry.npmjs.org`, `registry.yarnpkg.com`
- `python` -> `pypi.org`, `files.pythonhosted.org`, `pypi.python.org`

Presets are merged with explicit `allowedDomains`, deduped, then validated.

```mermaid
flowchart TD
  A[exec args] --> B[resolve allowedDomains]
  A --> C[expand packageManagers presets]
  B --> D[merge + dedupe]
  C --> D
  D --> E{contains "*"?}
  E -- yes --> F[error: wildcard not allowed]
  E -- no --> G{network permission enabled?}
  G -- no --> H[error: network permission required]
  G -- yes --> I[build sandbox config with resolved allowedDomains]
```
