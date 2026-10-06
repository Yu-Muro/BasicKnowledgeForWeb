import { createDatabaseClient, type Env } from '@backend/src/db/connection';
import type { IRoomRepository } from '@backend/src/infrastructure/repositories/room/IRoomRepository';
import { RoomRepository } from '@backend/src/infrastructure/repositories/room/RoomRepository';
import {
    createRoom,
    deleteRoom,
    getRooms,
    updateRoom,
} from '@backend/src/presentation/controllers/roomController';
import { contentAccessMiddleware } from '@backend/src/presentation/middleware/contentAccessMiddleware';
import { contentEditMiddleware } from '@backend/src/presentation/middleware/contentEditMiddleware';
import { roleGuard } from '@backend/src/presentation/middleware/roleGuard';
import { CreateRoomUseCase } from '@backend/src/use-cases/room/CreateRoomUseCase';
import { DeleteRoomUseCase } from '@backend/src/use-cases/room/DeleteRoomUseCase';
import { GetRoomsUseCase } from '@backend/src/use-cases/room/GetRoomsUseCase';
import { UpdateRoomUseCase } from '@backend/src/use-cases/room/UpdateRoomUseCase';
import { Hono } from 'hono';
import type { ContentEditVariables } from '../middleware/contentEditMiddleware';

type RoomRepositoryFactory = (env: Env) => IRoomRepository;

export function createRoomRoutes(
    repositoryFactory: RoomRepositoryFactory = (env) =>
        new RoomRepository(createDatabaseClient(env)),
) {
    const app = new Hono<{ Bindings: Env; Variables: ContentEditVariables }>();
    const EDITOR_ROLES = ['admin', 'user'];

    app.get('/rooms', contentAccessMiddleware, async (c) => {
        const repository = repositoryFactory(c.env);
        const useCase = new GetRoomsUseCase(repository);
        return getRooms(c, useCase);
    });

    app.post(
        '/rooms',
        contentEditMiddleware,
        roleGuard(EDITOR_ROLES),
        async (c) => {
            const repository = repositoryFactory(c.env);
            const useCase = new CreateRoomUseCase(repository);
            return createRoom(c, useCase);
        },
    );

    app.put(
        '/rooms/:id',
        contentEditMiddleware,
        roleGuard(EDITOR_ROLES),
        async (c) => {
            const repository = repositoryFactory(c.env);
            const useCase = new UpdateRoomUseCase(repository);
            return updateRoom(c, useCase);
        },
    );

    app.delete(
        '/rooms/:id',
        contentEditMiddleware,
        roleGuard(EDITOR_ROLES),
        async (c) => {
            const repository = repositoryFactory(c.env);
            const useCase = new DeleteRoomUseCase(repository);
            return deleteRoom(c, useCase);
        },
    );

    return app;
}
