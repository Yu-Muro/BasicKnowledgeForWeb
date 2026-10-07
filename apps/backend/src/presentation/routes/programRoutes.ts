import { createDatabaseClient, type Env } from '@backend/src/db/connection';
import type { IProgramRepository } from '@backend/src/infrastructure/repositories/program/IProgramRepository';
import { ProgramRepository } from '@backend/src/infrastructure/repositories/program/ProgramRepository';
import {
    createProgram,
    deleteProgram,
    getPrograms,
    updateProgram,
    uploadProgramImage,
} from '@backend/src/presentation/controllers/programController';
import { contentAccessMiddleware } from '@backend/src/presentation/middleware/contentAccessMiddleware';
import { contentEditMiddleware } from '@backend/src/presentation/middleware/contentEditMiddleware';
import { roleGuard } from '@backend/src/presentation/middleware/roleGuard';
import { CreateProgramUseCase } from '@backend/src/use-cases/program/CreateProgramUseCase';
import { DeleteProgramUseCase } from '@backend/src/use-cases/program/DeleteProgramUseCase';
import { GetProgramsUseCase } from '@backend/src/use-cases/program/GetProgramsUseCase';
import { UpdateProgramUseCase } from '@backend/src/use-cases/program/UpdateProgramUseCase';
import { UploadProgramImageUseCase } from '@backend/src/use-cases/program/UploadProgramImageUseCase';
import { Hono } from 'hono';
import { authMiddleware } from '../middleware/authMiddleware';
import type { ContentEditVariables } from '../middleware/contentEditMiddleware';

type ProgramRepositoryFactory = (env: Env) => IProgramRepository;

export function createProgramRoutes(
    repositoryFactory: ProgramRepositoryFactory = (env) =>
        new ProgramRepository(createDatabaseClient(env)),
) {
    const app = new Hono<{ Bindings: Env; Variables: ContentEditVariables }>();
    const ADMIN_ROLES = ['admin'];

    app.get('/programs', contentAccessMiddleware, async (c) => {
        const repository = repositoryFactory(c.env);
        const useCase = new GetProgramsUseCase(repository);
        return getPrograms(c, useCase);
    });

    app.post(
        '/programs',
        authMiddleware,
        contentEditMiddleware,
        roleGuard(ADMIN_ROLES),
        async (c) => {
            const repository = repositoryFactory(c.env);
            const useCase = new CreateProgramUseCase(
                repository,
                c.env.SHOP_ITEM_ASSET_BASE_URL,
            );
            return createProgram(c, useCase);
        },
    );

    app.put(
        '/programs/:id',
        authMiddleware,
        contentEditMiddleware,
        roleGuard(ADMIN_ROLES),
        async (c) => {
            const repository = repositoryFactory(c.env);
            const useCase = new UpdateProgramUseCase(
                repository,
                c.env.SHOP_ITEM_ASSET_BASE_URL,
            );
            return updateProgram(c, useCase);
        },
    );

    app.delete(
        '/programs/:id',
        authMiddleware,
        contentEditMiddleware,
        roleGuard(ADMIN_ROLES),
        async (c) => {
            const repository = repositoryFactory(c.env);
            const useCase = new DeleteProgramUseCase(repository);
            return deleteProgram(c, useCase);
        },
    );

    app.post(
        '/programs/upload',
        authMiddleware,
        contentEditMiddleware,
        roleGuard(ADMIN_ROLES),
        async (c) => {
            const useCase = new UploadProgramImageUseCase(
                c.env.SHOP_ITEM_ASSET_BUCKET,
            );
            return uploadProgramImage(c, useCase);
        },
    );

    return app;
}
