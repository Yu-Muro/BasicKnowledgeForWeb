import type { Env } from '@backend/src/db/connection';
import { getCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import { verify } from 'hono/jwt';
import { type AuthVariables, authMiddleware } from './authMiddleware';
// A valid event token is independent of the account cookie, including HEAD requests.
export const contentAccessMiddleware = createMiddleware<{
    Bindings: Env;
    Variables: AuthVariables;
}>(async (c, next) => {
    const token = getCookie(c, 'access_token');
    const eventId = c.req.header('x-event-id');
    if (token && eventId) {
        try {
            const payload = await verify(token, c.get('jwtSecret'), 'HS256');
            if (payload.event_id === eventId) return next();
        } catch {
            /* Try the account session. */
        }
    }
    return authMiddleware(c, async () => {
        if (c.get('user').role !== 'admin') {
            c.res = c.json({ error: 'Unauthorized' }, 401);
            return;
        }
        await next();
    });
});
