import { createDatabaseClient, type Env } from '@backend/src/db/connection';
import type { IUserRepository } from '@backend/src/infrastructure/repositories/user/IUserRepository';
import { UserRepository } from '@backend/src/infrastructure/repositories/user/UserRepository';
import {
    changePassword,
    login,
    logout,
    me,
} from '@backend/src/presentation/controllers/authController';
import { ChangePasswordUseCase } from '@backend/src/use-cases/auth/ChangePasswordUseCase';
import { LoginUseCase } from '@backend/src/use-cases/auth/LoginUseCase';
import { Hono } from 'hono';
import {
    type AuthVariables,
    authMiddleware,
} from '../middleware/authMiddleware';
import { checkPublicAuthRateLimit } from '../middleware/publicAuthRateLimit';

type UserRepositoryFactory = (env: Env) => IUserRepository;

export function createAuthRoutes(
    repositoryFactory: UserRepositoryFactory = (env) =>
        new UserRepository(createDatabaseClient(env)),
) {
    return (
        new Hono<{ Bindings: Env; Variables: AuthVariables }>()
            // POST /api/auth/login
            .post('/auth/login', async (c) => {
                const limited = await checkPublicAuthRateLimit({
                    enabled: c.env?.PUBLIC_AUTH_RATE_LIMIT_ENABLED === 'true',
                    limiter: c.env?.PUBLIC_AUTH_RATE_LIMITER,
                    ip: c.req.header('CF-Connecting-IP'),
                    operation: 'login',
                });
                if (limited) {
                    c.header('Cache-Control', 'no-store');
                    if (limited.retryAfter)
                        c.header('Retry-After', limited.retryAfter);
                    return c.json(limited.body, limited.status);
                }
                const repository = repositoryFactory(c.env);
                const useCase = new LoginUseCase(repository);
                return login(c, useCase);
            })
            // POST /api/auth/logout
            .post('/auth/logout', (c) => logout(c))
            // GET /api/auth/me
            .get('/auth/me', authMiddleware, (c) => me(c))
            // PUT /api/auth/password
            .put('/auth/password', authMiddleware, async (c) => {
                const repository = repositoryFactory(c.env);
                const useCase = new ChangePasswordUseCase(repository);
                return changePassword(c, useCase);
            })
    );
}
