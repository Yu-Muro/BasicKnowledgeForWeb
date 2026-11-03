import type { Env } from '@backend/src/db/connection';
import type { AuthVariables } from '@backend/src/presentation/middleware/authMiddleware';
import { createMiddleware } from 'hono/factory';
export const testAuthenticationContext = createMiddleware<{
    Bindings: Env;
    Variables: AuthVariables;
}>(async (c, next) => {
    c.set('jwtSecret', c.env?.JWT_SECRET ?? '');
    c.set('sessionValidator', {
        execute: async (claims) => ({ success: true, data: claims }),
    });
    c.set('departmentWriteCheck', { execute: async () => ({ success: true }) });
    await next();
});
