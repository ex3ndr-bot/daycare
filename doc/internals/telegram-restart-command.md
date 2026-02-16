# Telegram restart command

This note documents the `/restart` command flow exposed by the Upgrade plugin.

```mermaid
sequenceDiagram
  participant U as User
  participant T as TelegramConnector
  participant E as Engine
  participant P as Upgrade Plugin
  participant R as upgradeRestartRun
  participant M as PM2

  U->>T: /restart
  T->>E: onCommand("/restart", context, descriptor)
  E->>P: plugin command handler
  P->>T: sendMessage("Restarting Daycare...")
  P->>R: upgradeRestartRun(settings)
  R->>M: pm2 restart <processName>
  R->>T: sendMessage("Restart complete...")
```

- `/restart` is registered only when the Upgrade plugin is enabled.
- Restart uses the plugin's configured PM2 process name.
- The command does not run `npm install`; it performs restart only.
