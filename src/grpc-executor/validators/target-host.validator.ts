import {
    registerDecorator,
    ValidationOptions,
    ValidatorConstraint,
    ValidatorConstraintInterface,
} from 'class-validator';
import {Injectable} from "@nestjs/common";
import {ConfigService} from "@nestjs/config";


const BLOCKED_IP_PATTERNS: RegExp[] = [
    /^127\.\d+\.\d+\.\d+$/,
    /^10\.\d+\.\d+\.\d+$/,
    /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
    /^192\.168\.\d+\.\d+$/,
    /^169\.254\.\d+\.\d+$/,
    /^0\.0\.0\.0$/,
    /^::1$/,
    /^fe[89ab][0-9a-f]:/i,
    /^f[cd][0-9a-f]{2}:/i,
];

const BLOCKED_HOSTNAMES: Set<string> = new Set([
    'localhost',
    'ip6-localhost',
    'ip6-loopback',
]);


export function parseHostname(target: string): string {
    if (target.startsWith('[')) {
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


export function isDangerousHost(hostname: string): boolean {
    const lower = hostname.toLowerCase();
    if (BLOCKED_HOSTNAMES.has(lower)) return true;
    if (lower.endsWith('.localhost') || lower.endsWith('.local') || lower.endsWith('.internal')) {
        return true;
    }
    for (const pattern of BLOCKED_IP_PATTERNS) {
        if (pattern.test(lower)) return true;
    }
    return false;
}


@ValidatorConstraint({ name: 'isAllowedTargetHost', async: false })
@Injectable()
export class IsAllowedTargetHostConstraint implements ValidatorConstraintInterface {
    constructor(private configService: ConfigService) {}

    validate(value: unknown): boolean {
        if (typeof value !== 'string' || !value.trim()) return false;

        const hostname = parseHostname(value.trim());
        if (!hostname) return false;

        const allowlist = this.getAllowlist();

        if (allowlist.length > 0) {
            const lowerValue = value.trim().toLowerCase();
            const lowerHostname = hostname.toLowerCase();
            return allowlist.includes(lowerValue) || allowlist.includes(lowerHostname);
        }

        return !isDangerousHost(hostname);
    }

    defaultMessage(): string {
        const allowlist = this.getAllowlist();
        if (allowlist.length > 0) {
            return `targetHost must be one of the configured allowed hosts`;
        }
        return `targetHost must not point to a local or private address`;
    }

    private getAllowlist(): string[] {
        const raw = this.configService.get<string>('ALLOWED_GRPC_HOSTS') ?? '';
        return raw
            .split(',')
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean);
    }
}

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