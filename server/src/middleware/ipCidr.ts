// Minimal IPv4 CIDR match — no external dependency. IPv4-mapped IPv6
// addresses (::ffff:1.2.3.4) and the IPv6 loopback (::1) are normalised to
// IPv4; other IPv6 addresses never match an IPv4 CIDR.
function normalizeIp(ip: string): string {
  if (ip === "::1") return "127.0.0.1";
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  return mapped ? mapped[1] : ip;
}

export function isIPInCIDR(rawIp: string, cidr: string): boolean {
  const ip = normalizeIp(rawIp);
  const [range, bitsStr] = cidr.split("/");
  const bits = Number(bitsStr ?? 32);
  const ipToInt = (addr: string) =>
    addr.split(".").reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;

  if (!ip.includes(".") || !range.includes(".")) return false;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipToInt(ip) & mask) === (ipToInt(range) & mask);
}
