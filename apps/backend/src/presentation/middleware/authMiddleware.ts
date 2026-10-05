import type { Env } from '@backend/src/db/connection';
import { getCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import { verify } from 'hono/jwt';

export type AuthUser = {
    id: string;
    name: string;
    email: string;
    role: string;
    departmentId?: string | null;
};

export type AuthVariables = {
    user: AuthUser;
};

export const authMiddleware = createMiddleware<{
    Bindings: Env;
    Variables: AuthVariables;
}>(async (c, next) => {
    const token = getCookie(c, 'auth_token');
    if (!token) {
        console.log('[auth] Unauthorized: auth_token cookie missing', {
            method: c.req.method,
            path: c.req.path,
        });
        return c.json({ error: 'Unauthorized' }, 401);
    }
    try {
        const payload = await verify(token, c.env.JWT_SECRET, 'HS256');
        if (!c.get('user')) c.set('user', payload as AuthUser);
        await next();
    } catch (err) {
        console.log('[auth] Unauthorized: token verification failed', {
            method: c.req.method,
            path: c.req.path,
            error: err instanceof Error ? err.message : String(err),
        });
        return c.json({ error: 'Unauthorized' }, 401);
    }
});
