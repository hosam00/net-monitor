export function parseNetDev(content) {
    const lines = content.split('\n');
    const interfaces = [];

    for (const line of lines) {
        const colon = line.indexOf(':');
        if (colon < 0) continue;

        const name = line.substring(0, colon).trim();
        const parts = line.substring(colon + 1).trim().split(/\s+/);

        if (parts.length < 9) continue;

        const rxBytes = parseInt(parts[0], 10);
        const rxPackets = parseInt(parts[1], 10);
        const rxErrors = parseInt(parts[2], 10);
        const rxDrop = parseInt(parts[3], 10);
        const txBytes = parseInt(parts[8], 10);
        const txPackets = parseInt(parts[9], 10);
        const txErrors = parseInt(parts[10], 10);
        const txDrop = parseInt(parts[11], 10);

        if (isNaN(rxBytes) || isNaN(txBytes)) continue;

        interfaces.push({
            name,
            rxBytes,
            rxPackets,
            rxErrors,
            rxDrop,
            txBytes,
            txPackets,
            txErrors,
            txDrop
        });
    }

    return interfaces;
}

export function parseTcpTable(content) {
    const lines = content.split('\n');
    const sockets = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = line.split(/\s+/);
        if (parts.length < 8) continue;

        const localAddr = parts[1];
        const remAddr = parts[2];
        const state = parseInt(parts[3], 16);
        const uid = parseInt(parts[7], 10);

        const localParts = localAddr.split(':');
        const remParts = remAddr.split(':');

        sockets.push({
            localAddr: localParts[0],
            localPort: parseInt(localParts[1], 16),
            remAddr: remParts[0],
            remPort: parseInt(remParts[1], 16),
            state,
            uid
        });
    }

    return sockets;
}

export function isPhysicalInterface(name) {
    return /^(eth|enp|ens|enx|wlan|wlp|wlx|wwp|wwan)/.test(name);
}

export function isVirtualInterface(name) {
    return /^(docker|br-|veth|virbr|tun|tap|bond|dummy|gre|gretap|ip6tnl|ipip|lo)/.test(name)
        || name.startsWith('vnet');
}

export function isLoopback(name) {
    return name === 'lo';
}

export function isVpnInterface(name) {
    return /^(tun|tap)/.test(name);
}
