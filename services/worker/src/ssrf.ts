import dns from 'dns/promises';
import net from 'net';

export function isPrivateIp(ip: string): boolean {
  if (!net.isIP(ip)) return false;

  // IPv4 checks
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    // 127.0.0.0/8 (Loopback)
    if (parts[0] === 127) return true;
    // 10.0.0.0/8 (Private)
    if (parts[0] === 10) return true;
    // 172.16.0.0/12 (Private)
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.168.0.0/16 (Private)
    if (parts[0] === 192 && parts[1] === 168) return true;
    // 169.254.0.0/16 (Link local & Cloud Metadata)
    if (parts[0] === 169 && parts[1] === 254) return true;
    // 0.0.0.0/8
    if (parts[0] === 0) return true;
    return false;
  }

  // IPv6 checks
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === '::1' || lower === '0:0:0:0:0:0:0:1') return true;
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // Unique Local Address
    if (lower.startsWith('fe80')) return true; // Link Local
  }

  return false;
}

export async function validateTargetSSRF(targetUrl: string, allowLocalhost: boolean = false): Promise<{ valid: boolean; resolvedIp?: string; error?: string }> {
  try {
    let hostname: string;
    if (targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) {
      const url = new URL(targetUrl);
      hostname = url.hostname;
    } else {
      hostname = targetUrl.split(':')[0];
    }

    if (net.isIP(hostname)) {
      if (!allowLocalhost && isPrivateIp(hostname)) {
        return { valid: false, resolvedIp: hostname, error: `SSRF Blocked: IP ${hostname} is in a reserved/private range.` };
      }
      return { valid: true, resolvedIp: hostname };
    }

    const addresses = await dns.lookup(hostname, { all: true });
    if (!addresses || addresses.length === 0) {
      return { valid: false, error: `DNS lookup failed for hostname ${hostname}` };
    }

    for (const addr of addresses) {
      if (!allowLocalhost && isPrivateIp(addr.address)) {
        return { valid: false, resolvedIp: addr.address, error: `SSRF Blocked: Hostname ${hostname} resolved to private IP ${addr.address}` };
      }
    }

    return { valid: true, resolvedIp: addresses[0].address };
  } catch (err: any) {
    return { valid: false, error: `DNS resolution error: ${err.message}` };
  }
}
