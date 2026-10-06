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
import { LogoutUseCase } from '../../use-cases/auth/LogoutUseCase';
import {
    type AuthVariables,
    authMiddleware,
} from '../middleware/authMiddleware';
import {
    type AuthenticationFactory,
    createAuthenticationRepository,
} from './authenticationFactory';

type UserRepositoryFactory = (env: Env) => IUserRepository;

export function createAuthRoutes(
    repositoryFactory: UserRepositoryFactory = (env) =>
        new UserRepository(createDatabaseClient(env)),
    authenticationFactory: AuthenticationFactory = createAuthenticationRepository,
) {
    return (
        new Hono<{ Bindings: Env; Variables: AuthVariables }>()
            // POST /api/auth/login
            .post('/auth/login', async (c) => {
                const useCase = new LoginUseCase(
                    await authenticationFactory(c.env),
                );
                return login(c, useCase);
            })
            // POST /api/auth/logout
            .post('/auth/logout', async (c) =>
                logout(
                    c,
                    new LogoutUseCase(await authenticationFactory(c.env)),
                ),
            )
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
