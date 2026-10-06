import { createDatabaseClient, type Env } from '@backend/src/db/connection';
import type { IUserRepository } from '@backend/src/infrastructure/repositories/user/IUserRepository';
import { UserRepository } from '@backend/src/infrastructure/repositories/user/UserRepository';
import { getCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import { verify } from 'hono/jwt';
import type { AuthVariables } from '../middleware/authMiddleware';
import {
    type AuthenticationFactory,
    createAuthenticationRepository,
} from './authenticationFactory';

export function createSessionValidation(
    repositoryFactory: (env: Env) => IUserRepository = (env) =>
        new UserRepository(createDatabaseClient(env)),
    authenticationFactory: AuthenticationFactory = createAuthenticationRepository,
) {
    return createMiddleware<{ Bindings: Env; Variables: AuthVariables }>(
        async (c, next) => {
            c.header('Cache-Control', 'no-store');
            // Event access is independent of the account session for read-only content.
            const contentRead =
                c.req.method === 'GET' &&
                ([
                    '/api/timetable',
                    '/api/rooms',
                    '/api/programs',
                    '/api/shop-items',
                    '/api/others',
                    '/api/search',
                ].includes(c.req.path) ||
                    /^\/api\/access-codes\/[^/]+$/.test(c.req.path));
            const accessToken = getCookie(c, 'access_token');
            if (contentRead && accessToken && c.req.header('x-event-id')) {
                try {
                    const payload = await verify(
                        accessToken,
                        c.env.JWT_SECRET,
                        'HS256',
                    );
                    if (payload.event_id === c.req.header('x-event-id'))
                        return next();
                } catch {
                    // Fall through to account validation when event access is invalid.
                }
            }
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
                const sessionUserId = await (
                    await authenticationFactory(c.env)
                ).getSessionUserId(new Headers(c.req.raw.headers));
                if (!sessionUserId)
                    return c.json({ error: 'Unauthorized' }, 401);
                id = sessionUserId;
            } catch {
                return c.json({ error: '認証情報の確認に失敗しました' }, 503);
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
