# Ubuntu Network Monitor GNOME Extension — Detailed Project Plan

## Overview

This document defines a full implementation plan for a GNOME Shell extension for Ubuntu that monitors internet usage, shows live bandwidth in the top panel, identifies which applications are using the network, stores usage history, and exposes a preferences UI for tuning behavior. GNOME extensions are expected to follow the standard extension structure with a UUID-named directory and core files such as `metadata.json` and `extension.js`.[cite:48][cite:46]

The product goal is to combine the convenience of lightweight panel monitors with the diagnostic usefulness of per-process monitoring tools. Existing GNOME network panel extensions demonstrate that top-panel throughput display is practical, and process-aware Linux tools such as NetHogs demonstrate that bandwidth can be grouped by process using procfs-based socket inspection.[cite:33][cite:49]

## Product Goals

### Primary goals

- Show current download and upload speed in the GNOME top bar.
- Show a popup menu with current totals, interface details, and top network-using applications.
- Attribute traffic to applications or process groups as accurately as possible.
- Persist usage data for hourly, daily, and monthly reporting.
- Provide a native preferences UI inside the GNOME extension ecosystem.
- Remain lightweight enough to run continuously.
- Fail gracefully when a subsystem cannot provide complete data.

### Secondary goals

- Alerts for high usage or data-cap thresholds.
- Export usage data.
- Interface filters.
- Ignore lists for selected apps.
- Group browser subprocesses into one logical application row.
- Optional debug mode for development and troubleshooting.

## User Stories

### Core usage stories

- As a desktop user, there should be a small panel indicator that tells whether the network is currently active.
- As a user on a limited connection, there should be daily and monthly totals.
- As a troubleshooting user, clicking the indicator should reveal which apps are consuming data right now.
- As a power user, there should be controls for refresh interval, interface selection, grouping behavior, and alert thresholds.
- As a developer, the project should be structured cleanly so features can be added later without rewriting the whole extension.

### Advanced usage stories

- As a user downloading a large file, the popup should immediately show the responsible process.
- As a user using Docker, VPNs, VMs, or Flatpaks, the extension should try to avoid misleading totals.
- As a user on metered mobile internet, there should be visible warning states before data limits are exceeded.
- As a user comparing browsers or apps, there should be recent-session totals per application.

## Scope Definition

### Version 1 scope

Version 1 should focus on the features that make the extension genuinely useful on day one:

- Top bar live speed.
- Popup with interface totals.
- Popup with top processes or app groups.
- Session totals.
- Daily and monthly history.
- Preferences UI.
- Local-only storage.
- Alerts for daily and monthly caps.

### Version 2 scope

Version 2 can expand with higher complexity features:

- Export to CSV and JSON.
- Per-app historical charts.
- Destination or domain awareness.
- Better icon mapping.
- More advanced grouping rules.
- Optional helper service with richer attribution.
- Localization, including Arabic UI support.

## Platform and Packaging Constraints

GNOME Shell extensions are not regular Python tray applications. They are packaged as GNOME extensions with a UUID-based folder name and standard files. GNOME's JavaScript extension guide documents the starter workflow and the core file layout expected by the shell.[cite:48][cite:46]

Extensions should be packaged in a way that tools and upload flows can process them correctly, and community discussions around uploads show that archive structure matters when preparing a distributable extension package.[cite:43]

## Recommended Architecture

## Architecture Summary

Use a hybrid architecture:

1. GNOME Shell extension for all UI and shell integration.
2. Pure GJS data collectors where practical.
3. Optional external helper only if process attribution becomes too costly or fragile in pure extension code.
4. Local persistence layer for history and settings-related state.

This architecture keeps the shell-facing layer small and user-friendly while allowing deeper data collection to evolve independently.

### Why not a Python-only app

A Python AppIndicator app would be easier to prototype, but it would not integrate as a true GNOME Shell extension managed by the GNOME extension system. Since the product target is a native extension workflow, the core implementation should follow GNOME's JavaScript extension model.[cite:48]

### Why not extension-only at any cost

Throughput display is straightforward, but per-process attribution is significantly harder. NetHogs-style monitoring relies on procfs socket information and process correlation, which is a deeper monitoring problem than simply reading interface totals.[cite:49][cite:52]

## High-Level System Design

### Main subsystems

- Panel indicator subsystem.
- Popup menu subsystem.
- Interface monitor subsystem.
- Process monitor subsystem.
- History store subsystem.
- Alerts subsystem.
- Preferences subsystem.
- Diagnostics subsystem.

### Data flow

1. Read raw interface counters.
2. Compute deltas and rates.
3. Read process/socket information.
4. Build per-process rate estimates.
5. Aggregate rows into app groups when enabled.
6. Update in-memory state.
7. Refresh panel label.
8. Refresh popup if open.
9. Persist periodic rollups.
10. Evaluate alerts.

## Project Directory Layout

The extension directory should use the extension UUID as its folder name because GNOME extension layout depends on that convention.[cite:48][cite:46]

```text
net-monitor@hosamgamal.dev/
├── metadata.json
├── extension.js
├── prefs.js
├── stylesheet.css
├── panel.js
├── menu.js
├── monitors/
│   ├── interfaceMonitor.js
│   ├── processMonitor.js
│   ├── historyStore.js
│   ├── alerts.js
│   └── appGrouping.js
├── utils/
│   ├── format.js
│   ├── procfs.js
│   ├── parsing.js
│   ├── time.js
│   └── debug.js
├── schemas/
│   └── org.gnome.shell.extensions.net-monitor.gschema.xml
├── helper/
│   ├── collector.py
│   └── README.md
├── locale/
└── assets/
```

## File-by-File Plan

### `metadata.json`

Purpose:

- Defines UUID.
- Defines extension name.
- Defines description.
- Declares supported GNOME Shell versions.
- Declares settings schema linkage and metadata fields as needed.

Important notes:

- UUID must match folder name exactly.
- Shell version support should be explicit.
- Description should mention panel speed, app attribution, and history.

### `extension.js`

Purpose:

- Main entry point.
- Creates panel indicator.
- Starts monitors.
- Registers menu.
- Connects settings.
- Cleans up on disable.

Responsibilities:

- Initialize settings.
- Instantiate panel component.
- Instantiate monitors.
- Register timers.
- Wire signals between collectors and UI.
- Ensure disable path disconnects all listeners and intervals.

### `panel.js`

Purpose:

- Render top bar label or icon.
- Apply compact/detailed display modes.
- Update panel text efficiently.
- Reflect warning states or paused state.

### `menu.js`

Purpose:

- Build popup menu.
- Render summary blocks.
- Render interface rows.
- Render top apps table.
- Show alerts and actions.
- Refresh only when visible.

### `prefs.js`

Purpose:

- Provide user-facing configuration inside GNOME's extension preferences flow.
- Bind UI widgets to GSettings keys.
- Validate thresholds and list formats.

### `interfaceMonitor.js`

Purpose:

- Read `/proc/net/dev`.
- Parse byte counters per interface.
- Compute current rates and totals.

Top-panel throughput extensions have demonstrated the usefulness of `/proc/net/dev` as a source for panel network monitoring and usage display.[cite:33]

### `processMonitor.js`

Purpose:

- Gather process and socket information.
- Associate sockets to PIDs.
- Estimate current app bandwidth usage.
- Provide grouped and raw views.

This subsystem is the most complex, because Linux per-process traffic attribution depends on correlating process and procfs socket information rather than reading a single ready-made application counter.[cite:49][cite:52]

### `historyStore.js`

Purpose:

- Persist totals.
- Roll up samples into hourly, daily, and monthly aggregates.
- Support history queries and reset operations.

### `alerts.js`

Purpose:

- Evaluate thresholds.
- Maintain cooldown windows.
- Emit shell notifications.
- Avoid repeated noisy alerts.

### `appGrouping.js`

Purpose:

- Group related processes into one logical app row.
- Merge browser helpers into one browser row if enabled.
- Merge duplicate command names if desired.

### `procfs.js`

Purpose:

- Centralize low-level parsing helpers for `/proc` reads.
- Prevent parsing logic from being scattered across the codebase.

## Data Sources

### Interface totals

Primary source:

- `/proc/net/dev`

Why:

- Fast to read.
- Low overhead.
- Standard Linux source for per-interface counters.
- Proven useful in GNOME throughput extensions.[cite:33]

Data extracted:

- interface name
- receive bytes
- transmit bytes
- optional packet/error counters if later needed

### Per-process attribution

Likely sources:

- `/proc/net/tcp`
- `/proc/net/tcp6`
- UDP variants if included later
- `/proc/<pid>/fd`
- `/proc/<pid>/comm`
- `/proc/<pid>/cmdline`
- `/proc/<pid>/status`

Why:

Linux tools that report usage by process commonly derive their data from procfs socket/process information rather than a desktop API that directly exposes app bandwidth usage.[cite:49][cite:52]

### Interface naming support

The code should account for:

- `eth*`
- `enp*`
- `wlan*`
- `wlp*`
- `tun*`
- `tap*`
- `docker*`
- `br*`
- `virbr*`
- loopback `lo`

## Process Attribution Strategy

### Core challenge

The user-facing requirement is simple: "which app is using the internet?" The technical reality is harder because Linux networking visibility is socket-oriented, not application-oriented. NetHogs is useful as a conceptual reference because it demonstrates process-based grouping of network activity on Linux systems.[cite:49]

### Proposed attribution algorithm

1. Take interface byte snapshots at a fixed interval.
2. Read active socket tables from procfs.
3. Enumerate process file descriptors.
4. Match socket file descriptors to process ownership.
5. Build a process-to-socket map.
6. Sample at regular intervals and compute byte deltas where possible.
7. Rank processes by current observed activity.
8. Merge rows by logical app group when configured.

### Accuracy caveats

The plan should explicitly account for imperfect attribution:

- very short-lived processes may be missed
- helper subprocesses may hide the user-facing app name
- browser traffic may be split across multiple child processes
- VPNs and proxies may move visible traffic into tunnel processes
- containerized workloads may show different process identities than expected

### UI truthfulness rule

The extension should never imply more certainty than it has. Rows should be labeled according to confidence where needed:

- exact process
- grouped application
n- inferred activity
- unattributed remainder

## Application Grouping Plan

### Grouping modes

- Disabled: show raw processes only.
- Smart grouping: merge known subprocess patterns.
- Aggressive grouping: merge by app name and desktop file.

### Grouping heuristics

Possible grouping keys:

- desktop file name
- executable name
- parent process name
- command line prefix
- known browser helper patterns
- known Electron app patterns

### Special handling targets

- Firefox
- Chromium/Chrome
- Electron apps
- Flatpak apps
- Snap apps
- package managers
- cloud sync clients
- torrent clients

## History and Persistence Design

### Persistence options

Recommended order:

1. SQLite.
2. JSON fallback if rapid prototyping is preferred first.

### Why SQLite is preferred

- Better query support.
- Cleaner rollups.
- Easier pruning.
- Safer long-term growth.
- Better for exports and future analytics.

### Minimum retained data

- session totals per process or app group
- hourly total usage
- daily total usage
- monthly total usage
- interface-level totals
- alert events

### Suggested tables

#### `interface_samples`

Fields:

- id
- timestamp
- interface
- rx_bytes
- tx_bytes
- rx_rate
- tx_rate

#### `process_samples`

Fields:

- id
- timestamp
- pid
- process_name
- app_group
- user_name
- rx_delta
- tx_delta
- sample_ms
- confidence_level

#### `daily_totals`

Fields:

- day
- interface
- app_group
- rx_total
- tx_total

#### `monthly_totals`

Fields:

- month
- interface
- app_group
- rx_total
- tx_total

#### `alert_events`

Fields:

- id
- timestamp
- alert_type
- severity
- message
- related_app
- related_interface

## Sampling Strategy

### Recommended intervals

- panel update source: 1 second default
- interface sampling: 1 second default
- popup table refresh while open: 1 second default
- persistence rollup write: every 30 to 60 seconds
- alert evaluation: every sample tick or every second

### Why these intervals

- Faster than 1 second may cause unnecessary shell overhead.
- Slower than 1 second makes the panel feel laggy.
- Disk persistence should be batched instead of written every tick.

### Configurable range

- minimum: 500 ms
- default: 1000 ms
- maximum for normal UI: 5000 ms

## User Interface Specification

## Panel Indicator UI

### Visual modes

- text only
- icon + text
- compact arrows
- down only
- down + up separate
- total only

### Example label formats

- `↓ 1.2 MB/s ↑ 250 KB/s`
- `1.45 MB/s`
- `↓980K ↑120K`
- `Wi-Fi 1.2M / 0.2M`

### Panel states

- disconnected
- connected idle
- active traffic
- alert threshold reached
- paused
- per-app monitor unavailable

## Popup Menu Layout

### Section order

1. header summary
2. active interface card
3. current rates
4. session totals
5. today total
6. month total
7. top apps list
8. alerts section
9. quick actions
10. diagnostic footer

### Header summary content

- current primary interface
- connectivity state
- current sampling mode
- helper status if used

### Interface block content

For each included interface:

- interface name
- live down rate
- live up rate
- session total
- optional icon for Wi-Fi or Ethernet

### Top apps block content

Columns or row fields:

- app name
- pid or grouped count
- current down
- current up
- session total
- average over recent interval
- optional status badge

### Quick actions

- open preferences
- pause monitoring
- refresh now
- reset session totals
- export usage
- open debug info

## Preferences UI Specification

### Tab 1: General

Settings:

- enable monitoring
- start paused
- refresh interval
- auto unit selection
- decimal precision
- show combined or separate rates
- use compact panel mode

### Tab 2: Interfaces

Settings:

- auto-detect interfaces
- include selected interfaces only
- exclude selected interfaces
- ignore loopback
- ignore bridges
- ignore docker interfaces
- separate VPN traffic

### Tab 3: Per-App Monitoring

Settings:

- enable per-process tracking
- use smart grouping
- show raw pids
- ignore system daemons
- ignore specific app names
- keep ended processes visible for short time
- show only top N rows

### Tab 4: History

Settings:

- enable persistence
- retention days
- keep per-process history
- hourly rollups
- daily rollups
- monthly rollups
- reset all stored history

### Tab 5: Alerts

Settings:

- daily cap limit
- monthly cap limit
- per-app spike threshold
- notify only once per cooldown window
- quiet hours
- severity style

### Tab 6: Appearance

Settings:

- icon theme behavior
- row density
- highlight colors
- app icons on or off
- bold top talker
- timestamp display format

### Tab 7: Advanced

Settings:

- debug mode
- verbose logging
- collector backend selection
- helper enablement
- parser strictness
- diagnostic export

## Settings Schema Plan

Suggested GSettings keys:

```text
org.gnome.shell.extensions.net-monitor
  enabled
  start-paused
  refresh-interval-ms
  rate-unit-mode
  decimal-precision
  panel-display-mode
  auto-detect-interfaces
  included-interfaces
  excluded-interfaces
  ignore-loopback
  ignore-virtual
  separate-vpn
  enable-process-monitor
  process-grouping-mode
  ignored-processes
  top-process-count
  persistence-enabled
  retention-days
  daily-cap-bytes
  monthly-cap-bytes
  spike-threshold-bytes-per-sec
  notification-cooldown-sec
  quiet-hours-enabled
  quiet-hours-start
  quiet-hours-end
  debug-enabled
```

## Functional Specification by Feature

## Feature 1: Live total throughput

Behavior:

- Reads interface counters.
- Computes deltas.
- Displays current down/up speed.
- Refreshes at configured interval.

Acceptance criteria:

- Value updates every sample cycle.
- Changing traffic load reflects promptly.
- Numbers do not jump wildly under stable traffic.
- Panel survives interface disconnect/reconnect.

## Feature 2: Per-interface details

Behavior:

- Lists included interfaces.
- Shows current rates and totals per interface.
- Supports combining interfaces in the panel while still showing breakdown in popup.

Acceptance criteria:

- Multiple active interfaces are shown correctly.
- Excluded interfaces stay hidden.
- Virtual interfaces can be ignored when configured.

## Feature 3: Per-app usage table

Behavior:

- Updates current top network users.
- Sorts by highest combined rate by default.
- Supports download-only or upload-only sorting if added later.

Acceptance criteria:

- Starting a large download surfaces the correct app quickly.
- Stopping traffic removes or cools the row after a short decay period.
- Browser subprocess noise can be reduced via grouping.

## Feature 4: Daily and monthly totals

Behavior:

- Writes periodic rollups.
- Displays today and month totals in popup.
- Optionally breaks totals down per interface or app group.

Acceptance criteria:

- Totals survive reboot or shell restart.
- Reset operations affect only intended scopes.
- Data is still accessible after several days of use.

## Feature 5: Alerts

Behavior:

- Watches thresholds continuously.
- Shows shell notifications when thresholds are crossed.
- Uses cooldowns to avoid spam.

Acceptance criteria:

- Alert triggers once when threshold is crossed.
- Re-alert occurs only after cooldown and new qualifying event.
- Quiet hours suppress or reduce noise as configured.

## Error Handling and Degradation Strategy

### Graceful degradation levels

- Level A: everything available.
- Level B: only interface monitor available.
- Level C: panel alive, process attribution unavailable.
- Level D: panel temporarily paused due to collector error.

### Error categories

- procfs read failure
- parse failure
- missing process after discovery
- settings parse failure
- database write error
- helper not found
- helper crashed
- permission issue

### Required behavior on failure

- never crash GNOME Shell
- never block panel rendering
- retain last known-good display if possible
- surface error state in diagnostics section
- log enough context for debugging when debug mode is on

## Performance Plan

### Performance goals

- low CPU use when idle
- no visible panel lag
- no popup freeze on open
- controlled memory growth
- limited disk writes

### Optimization plan

- cache previous parsed interface data
- avoid rebuilding menu sections unnecessarily
- refresh popup contents only while visible
- batch history writes
- prune old history on schedule
- defer heavy attribution if panel update is due immediately

### Optional helper threshold

A helper should be introduced only if one of these is true:

- pure GJS attribution causes shell stutter
- process scanning becomes too slow at normal sample rates
- permissions or parsing complexity make separation cleaner
- testing shows better reliability with an external collector

## Privacy and Security Plan

Principles:

- local-only by default
- no telemetry
- no external uploads
- no domain inspection unless explicitly added later
- no command-line storage unless user enables advanced diagnostics
- clear reset and deletion actions for stored history

## Accessibility Plan

The UI should follow the expectations of GNOME desktop interaction patterns:

- readable labels
- keyboard navigation in preferences
- strong contrast in warning states
- icons not relied on alone for meaning
- concise labels for technical data
- screen-reader-friendly text where possible

## Logging and Diagnostics Plan

### Debug levels

- off
- errors only
- normal debug
- verbose tracing

### Diagnostic data to expose

- extension version
- shell version target
- monitoring backend mode
- active interfaces
- sample interval
- database status
- helper status
- last process monitor error

### Developer tools

- manual refresh action
- export debug snapshot
- clear cache action
- test-notification action

## Testing Strategy

GNOME's extension documentation covers creation and testing workflows, including starting from `gnome-extensions create`, enabling with `gnome-extensions enable`, and using a nested GNOME Shell session for safer testing on Wayland. The guide also notes that code changes require a reload cycle because loaded extension code is cached by the JavaScript engine.[cite:48]

### Unit-level parsing tests

Create repeatable test data for:

- `/proc/net/dev` parser
- tcp table parser
- fd-to-socket mapping
- rate formatting
- unit conversion
- grouping heuristics

### Manual behavior tests

- idle desktop
- browser download
- YouTube or streaming video
- apt update or package download
- cloud sync burst
- VPN enabled
- Docker traffic
- multiple interfaces active

### Cross-check tools

Compare outputs against:

- NetHogs for process-level expectations.[cite:49]
- Other Linux network monitoring approaches described in Linux process/network usage articles.[cite:52]
- Existing GNOME throughput extensions for panel throughput sanity.[cite:33]

### Stability tests

- disable and re-enable extension repeatedly
- suspend and resume system
- disconnect and reconnect Wi-Fi
- start and stop large downloads rapidly
- open and close popup repeatedly

## Release and Packaging Plan

### Local development workflow

1. create extension skeleton
2. implement minimal panel indicator
3. test in nested shell when needed
4. iterate on monitors
5. test preferences
6. package clean zip
7. install locally
8. validate enable/disable behavior

GNOME's JavaScript extension guide provides the starter path for creating a new extension and testing it in a development environment.[cite:48]

### Packaging checklist

- folder name matches UUID
- `metadata.json` present
- `extension.js` present
- preferences file included
- stylesheet included
- schema included
- temporary files removed
- archive structure verified

Community upload discussions show that packaging structure matters, so the build flow should verify the final archive layout before distribution.[cite:43]

### Optional publishing automation

If publishing later, tooling such as `gnome-extension-publisher` can help with build and publish workflows for GNOME extensions.[cite:45]

## Development Roadmap

## Phase 0: Research spike

Deliverables:

- starter extension skeleton
- panel hello-world indicator
- `/proc/net/dev` parser prototype
- process attribution feasibility notes

Exit criteria:

- panel can render and update
- interface counters parse correctly
- there is a clear decision on pure GJS vs optional helper for process attribution

## Phase 1: Minimal usable extension

Deliverables:

- live top-panel rates
- popup summary
- preferences shell
- session counters

Exit criteria:

- extension useful for current bandwidth awareness
- local install works cleanly

## Phase 2: Robust app attribution

Deliverables:

- process monitor
- grouped app rows
- row sorting
- ignore rules
- decay behavior for ended processes

Exit criteria:

- common traffic scenarios show believable app ownership
- UI remains responsive

## Phase 3: Persistence

Deliverables:

- SQLite or JSON persistence
- daily and monthly totals
- reset controls
- retention pruning

Exit criteria:

- totals survive shell restarts and reboots

## Phase 4: Alerts and polish

Deliverables:

- threshold notifications
- metered mode states
- diagnostics panel
- bug fixes
- performance tuning

Exit criteria:

- extension is stable enough for daily personal use

## Phase 5: Distribution-ready

Deliverables:

- packaging script
- install instructions
- screenshots
- version tagging
- changelog

Exit criteria:

- archive is clean and reproducible
- documentation is enough for future maintenance

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Per-process attribution is inaccurate | High | Start with best-effort labeling and clear UI messaging |
| GJS-only scanning is too slow | High | Move heavy attribution into optional helper |
| Browser subprocesses flood table | Medium | Add grouping heuristics and top-N display |
| Storage grows too much | Medium | Use retention pruning and rollups |
| GNOME version differences cause breakage | High | Target one main shell version first and isolate compatibility logic |
| Alerts become annoying | Medium | Add cooldowns and quiet hours |
| Interface names vary | Low | Use flexible include/exclude rules |

## Design Principles

- native GNOME feel
- minimal panel clutter
- truthful diagnostics over fake precision
- local-first privacy
- progressive enhancement
- strong defaults, deep configurability
- low overhead over flashy visuals

## Final Recommended Version 1 Feature Set

The most realistic and useful first release is:

- top-bar throughput monitor
- interface-aware popup
- top app/process list
- session totals
- daily and monthly totals
- basic alerts
- preferences UI
- local persistence

This feature set balances usefulness, implementation cost, and extension stability. It also matches the two strongest proven reference points: GNOME panel throughput extensions for interface-level display and Linux per-process monitoring tools for process-oriented diagnosis.[cite:33][cite:49]

## Immediate Next Build Tasks

1. Choose the final UUID.
2. Choose the primary Ubuntu and GNOME target version.
3. Generate the extension skeleton.
4. Implement `/proc/net/dev` parsing first.
5. Build panel indicator next.
6. Build popup shell next.
7. Prototype process attribution before committing to final backend design.
8. Add persistence only after live monitoring is trustworthy.
9. Add alerts after core monitoring is stable.
10. Document installation and test flow from the beginning.

## Suggested UUID and Naming Examples

Possible UUID options:

- `net-monitor@hosamgamal.dev`
- `traffic-watch@hosamgamal.dev`
- `bandwidth-monitor@hosamgamal.dev`
- `app-traffic-monitor@hosamgamal.dev`

Possible display names:

- Net Monitor
- Traffic Watch
- App Bandwidth Monitor
- Usage Lens

## Suggested Acceptance Checklist

- [ ] Extension installs locally.
- [ ] Enable and disable cycle is clean.
- [ ] Panel indicator updates correctly.
- [ ] Popup opens instantly.
- [ ] Interface totals are believable.
- [ ] Large downloads surface the correct app in common cases.
- [ ] Daily and monthly totals persist.
- [ ] Alerts respect cooldowns.
- [ ] Preferences save correctly.
- [ ] No shell crashes or visible lag.

## Closing Direction

The extension should be built in layers: first as a reliable throughput monitor, then as a process-aware diagnostic tool, and finally as a long-term usage tracker. GNOME's extension development model gives the shell integration needed for the user experience target, while Linux process monitoring references provide the conceptual path for the harder app-attribution problem.[cite:48][cite:33][cite:49]
