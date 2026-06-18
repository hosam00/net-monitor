#!/usr/bin/env python3
"""
Optional external collector for per-process network attribution.
Used when GJS-only scanning is too slow or inaccurate.

This provides richer process attribution by reading /proc files
and correlating sockets to processes more thoroughly.
"""
import os
import json
import socket
import struct
import time
from collections import defaultdict


def read_proc_net(path):
    """Read and parse /proc/net/{tcp,tcp6} etc."""
    entries = []
    try:
        with open(path) as f:
            lines = f.readlines()
        for line in lines[1:]:
            parts = line.strip().split()
            if len(parts) < 12:
                continue
            local_addr, local_port = parts[1].split(':')
            rem_addr, rem_port = parts[2].split(':')
            state = int(parts[3], 16)
            uid = int(parts[7], 10)
            inode = int(parts[9])
            entries.append({
                'local_addr': local_addr,
                'local_port': int(local_port, 16),
                'rem_addr': rem_addr,
                'rem_port': int(rem_port, 16),
                'state': state,
                'uid': uid,
                'inode': inode,
            })
    except (OSError, ValueError):
        pass
    return entries


def get_pid_for_inode(target_inode):
    """Find the PID that owns a given socket inode."""
    for pid_str in os.listdir('/proc'):
        if not pid_str.isdigit():
            continue
        fd_dir = f'/proc/{pid_str}/fd'
        try:
            for fd in os.listdir(fd_dir):
                try:
                    link = os.readlink(f'{fd_dir}/{fd}')
                    if link.startswith('socket:') and f'[{target_inode}]' in link:
                        return int(pid_str)
                except (OSError, ValueError):
                    continue
        except PermissionError:
            continue
        except FileNotFoundError:
            continue
    return None


def get_process_info(pid):
    """Get process name and cmdline."""
    try:
        with open(f'/proc/{pid}/comm') as f:
            comm = f.read().strip()
    except OSError:
        comm = '?'

    try:
        with open(f'/proc/{pid}/cmdline', 'rb') as f:
            raw = f.read()
            cmdline = raw.decode('utf-8', errors='replace').replace('\0', ' ').strip()
    except OSError:
        cmdline = ''

    return comm, cmdline


def collect_process_traffic():
    """Collect TCP sockets and map them to processes."""
    tcp4 = read_proc_net('/proc/net/tcp')
    tcp6 = read_proc_net('/proc/net/tcp6')
    all_sockets = tcp4 + tcp6

    process_map = defaultdict(lambda: {
        'sockets': [], 'comm': None, 'cmdline': None
    })

    for sock in all_sockets:
        pid = get_pid_for_inode(sock['inode'])
        if pid is None:
            continue

        entry = process_map[pid]
        entry['sockets'].append(sock)
        if entry['comm'] is None:
            comm, cmdline = get_process_info(pid)
            entry['comm'] = comm
            entry['cmdline'] = cmdline

    result = {}
    for pid, info in process_map.items():
        result[pid] = {
            'pid': pid,
            'comm': info['comm'],
            'cmdline': info['cmdline'],
            'socket_count': len(info['sockets']),
        }

    return result


def main():
    """Run once and output JSON."""
    result = collect_process_traffic()
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
