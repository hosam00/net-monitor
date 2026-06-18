# Net Monitor

A GNOME Shell extension that monitors network usage directly from your top panel.

![GNOME Shell 46](https://img.shields.io/badge/GNOME-46-green)
![Version](https://img.shields.io/badge/version-1.0-blue)

[extensions.gnome.org](https://extensions.gnome.org/extension/XXXX/net-monitor/)

## Features

- **Live bandwidth** in the top panel (down/up rates)
- **Per-app traffic** — see which processes are using the network
- **Daily/monthly history** — track your data usage over time
- **Alerts** — configurable caps, spike detection, quiet hours
- **Preferences UI** — full settings via the Extensions app

## Installation

### From source

```bash
git clone https://github.com/hosam00/net-monitor.git
cd net-monitor
cp -r net-monitor@hosamgamal.dev ~/.local/share/gnome-shell/extensions/
glib-compile-schemas ~/.local/share/gnome-shell/extensions/net-monitor@hosamgamal.dev/schemas/
gnome-extensions enable net-monitor@hosamgamal.dev
```

Restart GNOME Shell (Alt+F2, `r`, Enter).

### From EGO

Pending review — once approved, install from [extensions.gnome.org](https://extensions.gnome.org).

## Usage

- Click the network icon in the top panel to open the popup menu
- The popup shows per-interface rates, today/month totals, top apps, and alerts
- Right-click or use the popup "Preferences" button to open settings

## Preferences

Access via the Extensions app or by running:

```bash
gnome-extensions prefs net-monitor@hosamgamal.dev
```

## Development

The extension uses ES modules (`import`/`export`) and GJS with native GObject classes.

### Structure

```
net-monitor@hosamgamal.dev/
├── extension.js          # Entry point
├── panel.js              # Panel indicator button
├── menu.js               # Popup menu
├── prefs.js              # Preferences UI (Adw)
├── monitors/
│   ├── interfaceMonitor.js
│   ├── processMonitor.js
│   ├── historyStore.js
│   └── alerts.js
├── utils/
│   ├── procfs.js
│   ├── parsing.js
│   ├── format.js
│   ├── time.js
│   └── debug.js
├── schemas/
│   └── org.gnome.shell.extensions.net-monitor.gschema.xml
└── stylesheet.css
```

## License

GNU General Public License v2.0 or later
