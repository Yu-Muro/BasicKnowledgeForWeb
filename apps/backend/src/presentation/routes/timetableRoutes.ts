import { createDatabaseClient, type Env } from '@backend/src/db/connection';
import type { ITimetableRepository } from '@backend/src/infrastructure/repositories/timetable/ITimetableRepository';
import { TimetableRepository } from '@backend/src/infrastructure/repositories/timetable/TimetableRepository';
import {
    createTimetableItem,
    deleteTimetableItem,
    getTimetableItems,
    updateTimetableItem,
} from '@backend/src/presentation/controllers/timetableController';
import { contentAccessMiddleware } from '@backend/src/presentation/middleware/contentAccessMiddleware';
import { contentEditMiddleware } from '@backend/src/presentation/middleware/contentEditMiddleware';
import { roleGuard } from '@backend/src/presentation/middleware/roleGuard';
import { CreateTimetableItemUseCase } from '@backend/src/use-cases/timetable/CreateTimetableItemUseCase';
import { DeleteTimetableItemUseCase } from '@backend/src/use-cases/timetable/DeleteTimetableItemUseCase';
import { GetTimetableItemsUseCase } from '@backend/src/use-cases/timetable/GetTimetableItemsUseCase';
import { UpdateTimetableItemUseCase } from '@backend/src/use-cases/timetable/UpdateTimetableItemUseCase';
import { Hono } from 'hono';
import type { ContentEditVariables } from '../middleware/contentEditMiddleware';

type TimetableRepositoryFactory = (env: Env) => ITimetableRepository;

export function createTimetableRoutes(
    repositoryFactory: TimetableRepositoryFactory = (env) =>
        new TimetableRepository(createDatabaseClient(env)),
) {
    const app = new Hono<{ Bindings: Env; Variables: ContentEditVariables }>();
    const EDITOR_ROLES = ['admin', 'user'];

    app.get('/timetable', contentAccessMiddleware, async (c) => {
        const repository = repositoryFactory(c.env);
        const useCase = new GetTimetableItemsUseCase(repository);
        return getTimetableItems(c, useCase);
    });

    app.post(
        '/timetable',
        contentEditMiddleware,
        roleGuard(EDITOR_ROLES),
        async (c) => {
            const repository = repositoryFactory(c.env);
            const useCase = new CreateTimetableItemUseCase(repository);
            return createTimetableItem(c, useCase);
        },
    );

    app.put(
        '/timetable/:id',
        contentEditMiddleware,
        roleGuard(EDITOR_ROLES),
        async (c) => {
            const repository = repositoryFactory(c.env);
            const useCase = new UpdateTimetableItemUseCase(repository);
            return updateTimetableItem(c, useCase);
        },
    );

    app.delete(
        '/timetable/:id',
        contentEditMiddleware,
        roleGuard(EDITOR_ROLES),
        async (c) => {
            const repository = repositoryFactory(c.env);
            const useCase = new DeleteTimetableItemUseCase(repository);
            return deleteTimetableItem(c, useCase);
        },
    );

    return app;
}
