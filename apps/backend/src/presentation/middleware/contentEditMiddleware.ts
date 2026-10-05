import type { Env } from '@backend/src/db/connection';
import { eventIdHeaderSchema } from '@backend/src/infrastructure/validators/eventIdValidator';
import { getCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import { verify } from 'hono/jwt';
import type { AuthUser, AuthVariables } from './authMiddleware';

export type ContentEditVariables = AuthVariables & {
    eventId: string;
};

export const contentEditMiddleware = createMiddleware<{
    Bindings: Env;
    Variables: ContentEditVariables;
}>(async (c, next) => {
    const headerResult = eventIdHeaderSchema.safeParse(c.req.header());
    if (!headerResult.success) {
        return c.json(
            {
                error: 'バリデーションエラー',
                details: headerResult.error.issues,
            },
            400,
        );
    }

    const token = getCookie(c, 'auth_token');
    if (!token) {
        console.log('[contentEdit] Unauthorized: auth_token cookie missing', {
            method: c.req.method,
            path: c.req.path,
        });
        return c.json({ error: 'Unauthorized' }, 401);
    }

    try {
        const payload = (await verify(
            token,
            c.env.JWT_SECRET,
            'HS256',
        )) as AuthUser & { role?: string };
        const role = c.get('user')?.role ?? payload.role;
        if (role !== 'admin') {
            console.log('[contentEdit] Forbidden: role is not admin', {
                method: c.req.method,
                path: c.req.path,
                role,
            });
            return c.json({ error: 'Forbidden' }, 403);
        }

        const user: AuthUser = {
            id: payload.id,
            departmentId: c.get('user')?.departmentId,
            name: payload.name,
            email: payload.email,
            role,
        };
        c.set('user', user);
        c.set('eventId', headerResult.data['x-event-id']);
        await next();
    } catch (err) {
        console.log('[contentEdit] Unauthorized: token verification failed', {
            method: c.req.method,
            path: c.req.path,
            error: err instanceof Error ? err.message : String(err),
        });
        return c.json({ error: 'Unauthorized' }, 401);
    }
});
