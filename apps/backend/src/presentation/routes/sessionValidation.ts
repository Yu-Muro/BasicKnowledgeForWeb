import { createDatabaseClient, type Env } from '@backend/src/db/connection';
import type { IUserRepository } from '@backend/src/infrastructure/repositories/user/IUserRepository';
import { UserRepository } from '@backend/src/infrastructure/repositories/user/UserRepository';
import { getCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import { verify } from 'hono/jwt';
import type { AuthVariables } from '../middleware/authMiddleware';

export function createSessionValidation(
    repositoryFactory: (env: Env) => IUserRepository = (env) =>
        new UserRepository(createDatabaseClient(env)),
) {
    return createMiddleware<{ Bindings: Env; Variables: AuthVariables }>(
        async (c, next) => {
            const token = getCookie(c, 'auth_token');
            // Login/logout must work even with an expired or deleted-account cookie.
            if (
                !token ||
                (c.req.method === 'GET' && c.req.path === '/api/departments') ||
                (c.req.method === 'POST' &&
                    ['/api/users', '/api/access-codes/verify'].includes(
                        c.req.path,
                    )) ||
                ['/api/auth/login', '/api/auth/logout', '/api/health'].includes(
                    c.req.path,
                )
            )
                return next();
            let id: string;
            try {
                const payload = await verify(token, c.env.JWT_SECRET, 'HS256');
                if (typeof payload.id !== 'string')
                    return c.json({ error: 'Unauthorized' }, 401);
                id = payload.id;
            } catch {
                return c.json({ error: 'Unauthorized' }, 401);
            }
            try {
                const user = await repositoryFactory(c.env).findById(id);
                if (!user || user.deletedAt)
                    return c.json({ error: 'Unauthorized' }, 401);
                if (user.role !== 'admin' && !user.departmentId)
                    return c.json(
                        {
                            error: '所属部署が未設定です。管理者に設定を依頼してください',
                        },
                        403,
                    );
                c.set('user', {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    departmentId: user.departmentId,
                });
            } catch {
                return c.json({ error: '認証情報の確認に失敗しました' }, 503);
            }
            return next();
        },
    );
}
