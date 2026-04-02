import {
  isDangerousHost,
  parseHostname,
  getAllowlist,
  IsAllowedTargetHostConstraint,
} from './target-host.validator';

describe('parseHostname', () => {
  it('returns hostname from host:port', () => {
    expect(parseHostname('example.com:50051')).toBe('example.com');
  });

  it('returns plain hostname without port', () => {
    expect(parseHostname('example.com')).toBe('example.com');
  });

  it('extracts IP from IPv6 bracket notation', () => {
    expect(parseHostname('[::1]:50051')).toBe('::1');
  });

  it('handles bare IPv4', () => {
    expect(parseHostname('192.168.1.1')).toBe('192.168.1.1');
  });
});

describe('isDangerousHost', () => {
  const dangerous = [
    'localhost',
    'LOCALHOST',
    'ip6-localhost',
    '127.0.0.1',
    '127.1.2.3',
    '10.0.0.1',
    '10.255.255.255',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.0.1',
    '192.168.255.255',
    '169.254.0.1',
    '169.254.169.254',
    '0.0.0.0',
    '::1',
    'service.localhost',
    'api.local',
    'internal.service.internal',
  ];

  const safe = [
    'example.com',
    '8.8.8.8',
    '1.1.1.1',
    'my-grpc-server.example.com',
    '203.0.113.1',
  ];

  it.each(dangerous)('blocks dangerous host: %s', (host) => {
    expect(isDangerousHost(host)).toBe(true);
  });

  it.each(safe)('allows safe host: %s', (host) => {
    expect(isDangerousHost(host)).toBe(false);
  });

  it('does not block 172.15.x (outside private range)', () => {
    expect(isDangerousHost('172.15.0.1')).toBe(false);
  });

  it('does not block 172.32.x (outside private range)', () => {
    expect(isDangerousHost('172.32.0.1')).toBe(false);
  });
});

describe('IsAllowedTargetHostConstraint (no allowlist)', () => {
  let constraint: IsAllowedTargetHostConstraint;

  beforeEach(() => {
    delete process.env.ALLOWED_GRPC_HOSTS;
    constraint = new IsAllowedTargetHostConstraint();
  });

  afterEach(() => {
    delete process.env.ALLOWED_GRPC_HOSTS;
  });

  it('rejects localhost:50051', () => {
    expect(constraint.validate('localhost:50051')).toBe(false);
  });

  it('rejects 127.0.0.1:50051', () => {
    expect(constraint.validate('127.0.0.1:50051')).toBe(false);
  });

  it('rejects private IP', () => {
    expect(constraint.validate('192.168.1.100:9000')).toBe(false);
  });

  it('accepts public host:port', () => {
    expect(constraint.validate('grpc.example.com:50051')).toBe(true);
  });

  it('accepts public IP', () => {
    expect(constraint.validate('203.0.113.42:50051')).toBe(true);
  });

  it('rejects empty string', () => {
    expect(constraint.validate('')).toBe(false);
  });

  it('rejects non-string', () => {
    expect(constraint.validate(123)).toBe(false);
  });
});

describe('IsAllowedTargetHostConstraint (with allowlist)', () => {
  let constraint: IsAllowedTargetHostConstraint;

  beforeEach(() => {
    process.env.ALLOWED_GRPC_HOSTS = 'localhost:50051,my-internal-service:9000';
    constraint = new IsAllowedTargetHostConstraint();
  });

  afterEach(() => {
    delete process.env.ALLOWED_GRPC_HOSTS;
  });

  it('accepts explicitly allowed host', () => {
    expect(constraint.validate('localhost:50051')).toBe(true);
  });

  it('accepts other explicitly allowed entry', () => {
    expect(constraint.validate('my-internal-service:9000')).toBe(true);
  });

  it('rejects host not in allowlist', () => {
    expect(constraint.validate('other-host:50051')).toBe(false);
  });
});

describe('getAllowlist', () => {
  afterEach(() => {
    delete process.env.ALLOWED_GRPC_HOSTS;
  });

  it('returns empty array when env var is unset', () => {
    delete process.env.ALLOWED_GRPC_HOSTS;
    expect(getAllowlist()).toEqual([]);
  });

  it('parses comma-separated values', () => {
    process.env.ALLOWED_GRPC_HOSTS = 'foo:1234, bar:5678 , baz';
    expect(getAllowlist()).toEqual(['foo:1234', 'bar:5678', 'baz']);
  });
});
