import type { Env } from '@backend/src/db/connection';
import { createMiddleware } from 'hono/factory';

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
    if (!c.get('user')) return c.json({ error: 'Unauthorized' }, 401);
    await next();
});
