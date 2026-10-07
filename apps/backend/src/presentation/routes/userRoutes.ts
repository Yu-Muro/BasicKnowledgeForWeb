import { createDatabaseClient, type Env } from '@backend/src/db/connection';
import { DepartmentRepository } from '@backend/src/infrastructure/repositories/departments/DepartmentRepository';
import type { IDepartmentRepository } from '@backend/src/infrastructure/repositories/departments/IDepartmentRepository';
import type { IUserRepository } from '@backend/src/infrastructure/repositories/user/IUserRepository';
import { UserRepository } from '@backend/src/infrastructure/repositories/user/UserRepository';
import {
    createUser,
    deleteUser,
    getUsers,
    restoreUser,
    updateUserDepartment,
    updateUserRole,
} from '@backend/src/presentation/controllers/userController';
import { authMiddleware } from '@backend/src/presentation/middleware/authMiddleware';
import { roleGuard } from '@backend/src/presentation/middleware/roleGuard';
import { CreateUserUseCase } from '@backend/src/use-cases/user/CreateUserUseCase';
import { DeleteUserUseCase } from '@backend/src/use-cases/user/DeleteUserUseCase';
import { GetUsersUseCase } from '@backend/src/use-cases/user/GetUsersUseCase';
import { RestoreUserUseCase } from '@backend/src/use-cases/user/RestoreUserUseCase';
import { UpdateUserDepartmentUseCase } from '@backend/src/use-cases/user/UpdateUserDepartmentUseCase';
import { UpdateUserRoleUseCase } from '@backend/src/use-cases/user/UpdateUserRoleUseCase';
import { Hono } from 'hono';
import { departmentWriteMiddleware } from '../middleware/departmentWriteMiddleware';

type UserRepositoryFactory = (env: Env) => IUserRepository;

export function createUserRoutes(
    repositoryFactory: UserRepositoryFactory = (env) =>
        new UserRepository(createDatabaseClient(env)),
    departmentFactory: (env: Env) => IDepartmentRepository = (env) =>
        new DepartmentRepository(createDatabaseClient(env)),
) {
    return (
        new Hono<{ Bindings: Env }>()
            // GET /api/users - ユーザー一覧取得（admin のみ）
            .get('/users', authMiddleware, roleGuard(['admin']), async (c) => {
                const repository = repositoryFactory(c.env);
                const useCase = new GetUsersUseCase(repository);
                return getUsers(c, useCase);
            })
            .get(
                '/users/deleted',
                authMiddleware,
                roleGuard(['admin']),
                async (c) =>
                    getUsers(
                        c,
                        new GetUsersUseCase(repositoryFactory(c.env)),
                        true,
                    ),
            )
            .post(
                '/users/:id/restore',
                authMiddleware,
                roleGuard(['admin']),
                departmentWriteMiddleware,
                async (c) =>
                    restoreUser(
                        c,
                        new RestoreUserUseCase(
                            repositoryFactory(c.env),
                            departmentFactory(c.env),
                        ),
                    ),
            )
            .delete(
                '/users/:id',
                authMiddleware,
                roleGuard(['admin']),
                departmentWriteMiddleware,
                async (c) =>
                    deleteUser(
                        c,
                        new DeleteUserUseCase(repositoryFactory(c.env)),
                    ),
            )
            .put(
                '/users/:id/department',
                authMiddleware,
                roleGuard(['admin']),
                departmentWriteMiddleware,
                async (c) =>
                    updateUserDepartment(
                        c,
                        new UpdateUserDepartmentUseCase(
                            repositoryFactory(c.env),
                            departmentFactory(c.env),
                        ),
                    ),
            )
            // POST /api/users - ユーザー作成
            .post('/users', departmentWriteMiddleware, async (c) => {
                const repository = repositoryFactory(c.env);
                const useCase = new CreateUserUseCase(
                    repository,
                    departmentFactory(c.env),
                );
                return createUser(c, useCase);
            })
            // PUT /api/users/:id/role - ロール変更（admin のみ）
            .put(
                '/users/:id/role',
                authMiddleware,
                roleGuard(['admin']),
                departmentWriteMiddleware,
                async (c) => {
                    const repository = repositoryFactory(c.env);
                    const useCase = new UpdateUserRoleUseCase(
                        repository,
                        departmentFactory(c.env),
                    );
                    return updateUserRole(c, useCase);
                },
            )
    );
}
