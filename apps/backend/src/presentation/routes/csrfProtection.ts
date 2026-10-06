import { createMiddleware } from 'hono/factory';
import type { Env } from '../../db/connection';

export const csrfProtection = createMiddleware<{ Bindings: Env }>(
    async (c, next) => {
        if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(c.req.method))
            return next();
        const origin = c.req.header('Origin');
        const trusted = [c.env.BETTER_AUTH_URL];
        if (c.env.BETTER_AUTH_URL?.startsWith('http://localhost:'))
            trusted.push('http://localhost:8771');
        if (
            (origin && !trusted.includes(origin)) ||
            (!origin && c.req.header('Sec-Fetch-Site') === 'cross-site')
        ) {
            return c.json({ error: '許可されていない送信元です' }, 403);
        }
        await next();
    },
);
