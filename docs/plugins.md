# Plugins

Plugins are first-class runtime modules that can register:
- Connectors
- Inference providers
- Tools
- Image generation providers

Each plugin implements `async load()` and `async unload()` and receives:
- Plugin config from `.scout/settings.json`
- Dedicated data directory `.scout/plugins/<id>`
- Auth store access

```mermaid
flowchart TD
  Settings[settings.json] --> PluginManager
  PluginManager --> Plugin[Plugin load()]
  Plugin --> Registrar[PluginRegistrar]
  Registrar --> Connectors
  Registrar --> Inference
  Registrar --> Tools
  Registrar --> Images
```

## Built-in plugins
- `telegram` (connector)
- `openai` (inference)
- `brave-search` (tool)
- `gpt-image` (image)
- `nanobanana` (image)
