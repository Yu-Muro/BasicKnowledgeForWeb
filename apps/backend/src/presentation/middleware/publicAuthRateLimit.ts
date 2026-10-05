import { isIP } from 'node:net';
import type { PublicAuthRateLimiter } from '../../db/connection';

type RateLimitOptions = {
    enabled: boolean;
    limiter?: PublicAuthRateLimiter;
    ip?: string;
    operation: 'login' | 'verify' | 'register';
};

/** IPv6の表記揺れを除き、同一/64内でアドレスを変える迂回を防ぐ。 */
export function toRateLimitSubject(ip: string): string | null {
    const version = isIP(ip);
    if (version === 4) return ip;
    if (version !== 6 || ip.includes('%')) return null;
    let address = ip;
    if (address.includes('.')) {
        const split = address.lastIndexOf(':');
        const octets = address
            .slice(split + 1)
            .split('.')
            .map(Number);
        address = `${address.slice(0, split)}:${((octets[0] << 8) | octets[1]).toString(16)}:${((octets[2] << 8) | octets[3]).toString(16)}`;
    }
    const [head, tail = ''] = address.split('::');
    const h = head ? head.split(':') : [];
    const t = tail ? tail.split(':') : [];
    const groups = address.includes('::')
        ? [...h, ...Array<string>(8 - h.length - t.length).fill('0'), ...t]
        : h;
    return `${groups
        .slice(0, 4)
        .map((group) => group.toLowerCase().padStart(4, '0'))
        .join(':')}::/64`;
}

/** DB接続・入力の検証より前に評価し、入力値を変える列挙も同じキーで数える。 */
export async function checkPublicAuthRateLimit({
    enabled,
    limiter,
    ip,
    operation,
}: RateLimitOptions): Promise<{
    status: 429 | 503;
    body: { error: string };
    retryAfter?: string;
} | null> {
    if (!enabled) return null;
    const unavailable = (reason: string) => {
        // IP・入力値・例外の詳細はログへ含めない。
        console.error('public_auth_rate_limit_unavailable', {
            operation,
            reason,
        });
        return {
            status: 503 as const,
            body: { error: '認証サービスを一時的に利用できません' },
        };
    };
    if (!limiter) return unavailable('missing-binding');
    if (!ip) return unavailable('missing-ip');
    const subject = toRateLimitSubject(ip);
    if (!subject) return unavailable('invalid-ip');
    try {
        const { success } = await limiter.limit({
            key: `${operation}:${subject}`,
        });
        if (success) return null;
        return {
            status: 429,
            body: {
                error: '試行回数が多すぎます。しばらく待ってから再試行してください',
            },
            retryAfter: '60',
        };
    } catch {
        return unavailable('limiter-error');
    }
}
