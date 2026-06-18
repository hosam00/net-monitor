# External Collector Helper

## Purpose

This optional Python script provides richer per-process network traffic
attribution than the built-in GJS process monitor. It is used when:

- Pure GJS attribution causes shell stutter
- Process scanning is too slow at normal sample rates
- More accurate socket-to-PID mapping is needed

## Usage

```bash
python3 collector.py
```

The script outputs JSON with process-to-socket mappings.

## Integration

The extension will call this helper when the backend is set to 'helper'
in the advanced preferences. The helper must be executable and placed
in this directory.
