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
import { publicAuthRateLimitGuard } from './publicAuthRateLimitGuard';
import type { DatabaseProvider } from './requestDatabase';

type UserRepositoryFactory = (
    env: Env,
    database?: DatabaseProvider,
) => IUserRepository;

export function createAuthRoutes(
    repositoryFactory: UserRepositoryFactory = (env, database) =>
        new UserRepository(database?.() ?? createDatabaseClient(env)),
) {
    return (
        new Hono<{ Bindings: Env; Variables: AuthVariables }>()
            // POST /api/auth/login
            .post('/auth/login', async (c) => {
                const limited = await publicAuthRateLimitGuard(c, 'login');
                if (limited) return limited;
                const repository = repositoryFactory(
                    c.env,
                    c.get('databaseClient'),
                );
                const useCase = new LoginUseCase(repository);
                return login(c, useCase);
            })
            // POST /api/auth/logout
            .post('/auth/logout', (c) => logout(c))
            // GET /api/auth/me
            .get('/auth/me', authMiddleware, (c) => me(c))
            // PUT /api/auth/password
            .put('/auth/password', authMiddleware, async (c) => {
                const repository = repositoryFactory(
                    c.env,
                    c.get('databaseClient'),
                );
                const useCase = new ChangePasswordUseCase(repository);
                return changePassword(c, useCase);
            })
    );
}
