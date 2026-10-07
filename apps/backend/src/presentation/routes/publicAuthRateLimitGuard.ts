import type { Context } from 'hono';
import type { Env } from '../../db/connection';
import {
    checkPublicAuthRateLimit,
    type RateLimitOptions,
} from '../middleware/publicAuthRateLimit';

/** Envはroute層で読み、Hono RPCに429/503の応答型を残す。 */
export async function publicAuthRateLimitGuard<E extends { Bindings: Env }>(
    c: Context<E>,
    operation: RateLimitOptions['operation'],
) {
    const limited = await checkPublicAuthRateLimit({
        enabled: c.env?.PUBLIC_AUTH_RATE_LIMIT_ENABLED === 'true',
        limiter: c.env?.PUBLIC_AUTH_RATE_LIMITER,
        ip: c.req.header('CF-Connecting-IP'),
        operation,
    });
    if (!limited) return null;
    c.header('Cache-Control', 'no-store');
    if (limited.retryAfter) c.header('Retry-After', limited.retryAfter);
    return c.json(limited.body, limited.status);
}
