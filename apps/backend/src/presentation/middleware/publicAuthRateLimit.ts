import type { PublicAuthRateLimiter } from '../../db/connection';

type RateLimitOptions = {
    enabled: boolean;
    limiter?: PublicAuthRateLimiter;
    ip?: string;
    operation: 'login' | 'verify' | 'register';
};

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
    const unavailable = () => ({
        status: 503 as const,
        body: { error: '認証サービスを一時的に利用できません' },
    });
    if (!limiter || !ip) return unavailable();
    try {
        const { success } = await limiter.limit({ key: `${operation}:${ip}` });
        if (success) return null;
        return {
            status: 429,
            body: {
                error: '試行回数が多すぎます。しばらく待ってから再試行してください',
            },
            retryAfter: '60',
        };
    } catch {
        return unavailable();
    }
}
