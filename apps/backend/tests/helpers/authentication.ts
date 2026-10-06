import { compare } from 'bcryptjs';
import { getCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import { verify } from 'hono/jwt';
import type { Env } from '../../src/db/connection';
import type { IAuthenticationRepository } from '../../src/infrastructure/repositories/auth/IAuthenticationRepository';
import type { IUserRepository } from '../../src/infrastructure/repositories/user/IUserRepository';
import type {
    AuthUser,
    AuthVariables,
} from '../../src/presentation/middleware/authMiddleware';

// Domain feature tests inject a session provider; only access_token is a JWT in production.
export const testSessionMiddleware = createMiddleware<{
    Bindings: Env;
    Variables: AuthVariables;
}>(async (c, next) => {
    const token = getCookie(c, 'auth_token');
    if (token) {
        try {
            c.set(
                'user',
                (await verify(token, c.env.JWT_SECRET, 'HS256')) as AuthUser,
            );
        } catch {
            /* invalid fixture */
        }
    }
    await next();
});

export function testAuthentication(
    env: Env,
    users?: IUserRepository,
): IAuthenticationRepository {
    return {
        async getSessionUserId(headers) {
            const token = /(?:^|;\s*)auth_token=([^;]+)/.exec(
                headers.get('Cookie') ?? '',
            )?.[1];
            if (!token) return null;
            try {
                return (await verify(token, env.JWT_SECRET, 'HS256'))
                    .id as string;
            } catch {
                return null;
            }
        },
        async signIn(email, password) {
            const user = await users?.findByEmail(email);
            if (
                !user ||
                user.deletedAt ||
                !(await compare(password, user.password))
            )
                return Response.json(
                    { message: 'invalid credentials' },
                    { status: 401 },
                );
            if (user.role !== 'admin' && !user.departmentId)
                return Response.json(
                    {
                        message:
                            '所属部署が未設定です。管理者に設定を依頼してください',
                    },
                    { status: 403 },
                );
            return Response.json(
                {},
                {
                    headers: {
                        'Set-Cookie':
                            'auth_token=opaque-session-fixture; HttpOnly; Path=/',
                    },
                },
            );
        },
        async signOut() {
            return Response.json(
                {},
                { headers: { 'Set-Cookie': 'auth_token=; Max-Age=0; Path=/' } },
            );
        },
    };
}
