# Net Monitor

A GNOME Shell extension that monitors network usage directly from your top panel.

![GNOME Shell](https://img.shields.io/badge/GNOME-45--50-green)
![Version](https://img.shields.io/badge/version-2.0-blue)
![License](https://img.shields.io/badge/license-GPL--2.0--or--later-blue)

## Features

- **Live bandwidth** in the top panel (down/up rates)
- **Per-app traffic** — see which processes are using the network
- **Daily/monthly history** — track your data usage over time
- **Alerts** — configurable caps, spike detection, quiet hours
- **Preferences UI** — full settings via the Extensions app

## Compatibility

Tested on GNOME Shell 45 through 50, including Ubuntu 26.04 (GNOME Shell 50.1).

| GNOME Shell | Ubuntu |
| --- | --- |
| 45 – 50 | 24.04 LTS, 25.10, 26.04 LTS |

Per-process figures are **estimates**: the extension reads total interface
counters from `/proc/net/dev` and attributes them across tracked processes, since
per-socket attribution is not available to unprivileged extensions. The
interface totals and history numbers are exact.

## Installation

### From source

```bash
git clone https://github.com/hosam00/net-monitor.git
cd net-monitor
cp -r net-monitor@hosamgamal.dev ~/.local/share/gnome-shell/extensions/
glib-compile-schemas ~/.local/share/gnome-shell/extensions/net-monitor@hosamgamal.dev/schemas/
gnome-extensions enable net-monitor@hosamgamal.dev
```

GNOME Shell on Wayland cannot reload extensions in place — log out and back in to
activate the extension for the first time.

### From extensions.gnome.org

Pending review.

## Usage

- Click the network icon in the top panel to open the popup menu
- The popup shows per-interface rates, today/month totals, top apps, and alerts
- Use the popup "Preferences" button to open settings

The per-process scan only runs while the popup is open, so leaving it closed
costs nothing beyond the interface-level sample.

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
├── extension.js          # Entry point, sampling timer, lifecycle
├── panel.js              # Panel indicator button
├── menu.js               # Popup menu
├── prefs.js              # Preferences UI (Adw)
├── stylesheet.css
├── monitors/
│   ├── interfaceMonitor.js   # /proc/net/dev sampling and rate smoothing
│   ├── processMonitor.js     # Per-process tracking and app grouping
│   ├── historyStore.js       # Daily/monthly totals persisted to disk
│   └── alerts.js             # Caps, spike detection, notifications
├── utils/
│   ├── procfs.js
│   ├── parsing.js
│   ├── format.js
│   ├── time.js
│   └── debug.js
└── schemas/
    └── org.gnome.shell.extensions.net-monitor.gschema.xml
```

## License

GNU General Public License v2.0 or later. See [LICENSE](LICENSE).