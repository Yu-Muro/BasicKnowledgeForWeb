import { createDatabaseClient, type Env } from '@backend/src/db/connection';
import type { IUserRepository } from '@backend/src/infrastructure/repositories/user/IUserRepository';
import { UserRepository } from '@backend/src/infrastructure/repositories/user/UserRepository';
import {
    createUser,
    getUsers,
    updateUserRole,
} from '@backend/src/presentation/controllers/userController';
import { authMiddleware } from '@backend/src/presentation/middleware/authMiddleware';
import { roleGuard } from '@backend/src/presentation/middleware/roleGuard';
import { CreateUserUseCase } from '@backend/src/use-cases/user/CreateUserUseCase';
import { GetUsersUseCase } from '@backend/src/use-cases/user/GetUsersUseCase';
import { UpdateUserRoleUseCase } from '@backend/src/use-cases/user/UpdateUserRoleUseCase';
import { Hono } from 'hono';
import { checkPublicAuthRateLimit } from '../middleware/publicAuthRateLimit';

type UserRepositoryFactory = (env: Env) => IUserRepository;

export function createUserRoutes(
    repositoryFactory: UserRepositoryFactory = (env) =>
        new UserRepository(createDatabaseClient(env)),
) {
    return (
        new Hono<{ Bindings: Env }>()
            // GET /api/users - ユーザー一覧取得（admin のみ）
            .get('/users', authMiddleware, roleGuard(['admin']), async (c) => {
                const repository = repositoryFactory(c.env);
                const useCase = new GetUsersUseCase(repository);
                return getUsers(c, useCase);
            })
            // POST /api/users - ユーザー作成
            .post('/users', async (c) => {
                const limited = await checkPublicAuthRateLimit({
                    enabled: c.env?.PUBLIC_AUTH_RATE_LIMIT_ENABLED === 'true',
                    limiter: c.env?.PUBLIC_AUTH_RATE_LIMITER,
                    ip: c.req.header('CF-Connecting-IP'),
                    operation: 'register',
                });
                if (limited) {
                    c.header('Cache-Control', 'no-store');
                    if (limited.retryAfter)
                        c.header('Retry-After', limited.retryAfter);
                    return c.json(limited.body, limited.status);
                }
                const repository = repositoryFactory(c.env);
                const useCase = new CreateUserUseCase(repository);
                return createUser(c, useCase);
            })
            // PUT /api/users/:id/role - ロール変更（admin のみ）
            .put(
                '/users/:id/role',
                authMiddleware,
                roleGuard(['admin']),
                async (c) => {
                    const repository = repositoryFactory(c.env);
                    const useCase = new UpdateUserRoleUseCase(repository);
                    return updateUserRole(c, useCase);
                },
            )
    );
}
