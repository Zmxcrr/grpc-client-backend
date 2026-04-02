import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/**
 * Regex patterns for IP ranges that are blocked by default to prevent SSRF.
 * Covers loopback, private (RFC 1918), link-local, and IPv6 equivalents.
 */
const BLOCKED_IP_PATTERNS: RegExp[] = [
  // IPv4 loopback: 127.0.0.0/8
  /^127\.\d+\.\d+\.\d+$/,
  // IPv4 private: 10.0.0.0/8
  /^10\.\d+\.\d+\.\d+$/,
  // IPv4 private: 172.16.0.0/12
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
  // IPv4 private: 192.168.0.0/16
  /^192\.168\.\d+\.\d+$/,
  // IPv4 link-local: 169.254.0.0/16
  /^169\.254\.\d+\.\d+$/,
  // IPv4 any: 0.0.0.0
  /^0\.0\.0\.0$/,
  // IPv6 loopback: ::1
  /^::1$/,
  // IPv6 link-local: fe80::/10
  /^fe[89ab][0-9a-f]:/i,
  // IPv6 unique-local: fc00::/7
  /^f[cd][0-9a-f]{2}:/i,
];

/** Hostnames (lowercase) that are always blocked unless explicitly allowed. */
const BLOCKED_HOSTNAMES: Set<string> = new Set([
  'localhost',
  'ip6-localhost',
  'ip6-loopback',
]);

/**
 * Parses the hostname portion from a "host" or "host:port" string.
 * Handles IPv6 addresses enclosed in square brackets, e.g. [::1]:50051.
 */
export function parseHostname(target: string): string {
  if (target.startsWith('[')) {
    // IPv6 bracket notation
    const end = target.indexOf(']');
    return end !== -1 ? target.slice(1, end) : target;
  }
  const colonIdx = target.lastIndexOf(':');
  if (colonIdx !== -1) {
    const maybePort = target.slice(colonIdx + 1);
    if (/^\d+$/.test(maybePort)) {
      return target.slice(0, colonIdx);
    }
  }
  return target;
}

/**
 * Returns true if the given hostname/IP is considered dangerous and should
 * be blocked (SSRF risk).
 */
export function isDangerousHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(lower)) return true;
  if (lower.endsWith('.localhost') || lower.endsWith('.local') || lower.endsWith('.internal')) {
    // .localhost and .local are mDNS/Bonjour domains that resolve to local network
    // addresses; .internal is a common private-network convention.  All three are
    // blocked by default to prevent SSRF against intranet services.
    return true;
  }
  for (const pattern of BLOCKED_IP_PATTERNS) {
    if (pattern.test(lower)) return true;
  }
  return false;
}

/**
 * Reads the optional allowlist from the ALLOWED_GRPC_HOSTS environment variable
 * (comma-separated list of host or host:port patterns).
 * When set, only listed hosts are accepted and the danger check is skipped for them.
 */
export function getAllowlist(): string[] {
  const raw = process.env.ALLOWED_GRPC_HOSTS ?? '';
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

@ValidatorConstraint({ name: 'isAllowedTargetHost', async: false })
export class IsAllowedTargetHostConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string' || !value.trim()) return false;

    const hostname = parseHostname(value.trim());
    if (!hostname) return false;

    const allowlist = getAllowlist();

    if (allowlist.length > 0) {
      const lowerValue = value.trim().toLowerCase();
      const lowerHostname = hostname.toLowerCase();
      // Accept if the full value or just the hostname portion is in the allowlist
      return allowlist.includes(lowerValue) || allowlist.includes(lowerHostname);
    }

    // No allowlist configured: block known dangerous targets
    return !isDangerousHost(hostname);
  }

  defaultMessage(): string {
    const allowlist = getAllowlist();
    if (allowlist.length > 0) {
      return `targetHost must be one of the configured allowed hosts`;
    }
    return `targetHost must not point to a local or private address`;
  }
}

/**
 * Class-validator decorator that blocks dangerous/local/internal target hosts
 * (SSRF protection).  Configure an allowlist via the ALLOWED_GRPC_HOSTS
 * environment variable (comma-separated host or host:port patterns) to restrict
 * which remote hosts are accepted.
 */
export function IsAllowedTargetHost(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsAllowedTargetHostConstraint,
    });
  };
}
