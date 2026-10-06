import type { Env } from '@backend/src/db/connection';
import type { IAccessCodeRepository } from '@backend/src/infrastructure/repositories/access-code/IAccessCodeRepository';
import type { IDepartmentRepository } from '@backend/src/infrastructure/repositories/departments/IDepartmentRepository';
import type { IHealthRepository } from '@backend/src/infrastructure/repositories/health/IHealthRepository';
import type { IOtherItemRepository } from '@backend/src/infrastructure/repositories/other-item/IOtherItemRepository';
import type { IProgramRepository } from '@backend/src/infrastructure/repositories/program/IProgramRepository';
import type { IRoomRepository } from '@backend/src/infrastructure/repositories/room/IRoomRepository';
import type { IShopItemRepository } from '@backend/src/infrastructure/repositories/shop-item/IShopItemRepository';
import type { ITimetableRepository } from '@backend/src/infrastructure/repositories/timetable/ITimetableRepository';
import type { IUserRepository } from '@backend/src/infrastructure/repositories/user/IUserRepository';
import type { ContentEditVariables } from '@backend/src/presentation/middleware/contentEditMiddleware';
import { createAccessCodeRoutes } from '@backend/src/presentation/routes/accessCodeRoutes';
import { createAuthRoutes } from '@backend/src/presentation/routes/authRoutes';
import { createDepartmentRoutes } from '@backend/src/presentation/routes/departmentRoutes';
import { createHealthRoutes } from '@backend/src/presentation/routes/healthRoutes';
import { createOtherItemRoutes } from '@backend/src/presentation/routes/otherItemRoutes';
import { createProgramRoutes } from '@backend/src/presentation/routes/programRoutes';
import { createRoomRoutes } from '@backend/src/presentation/routes/roomRoutes';
import { createSearchRoutes } from '@backend/src/presentation/routes/searchRoutes';
import { createShopItemRoutes } from '@backend/src/presentation/routes/shopItemRoutes';
import { createTimetableRoutes } from '@backend/src/presentation/routes/timetableRoutes';
import { createUserRoutes } from '@backend/src/presentation/routes/userRoutes';
import { Hono } from 'hono';
import { testAuthentication, testSessionMiddleware } from './authentication';
import { departmentRepository } from './departmentRepository';

export function createTestAppWithHealth(healthRepository: IHealthRepository) {
    const app = new Hono<{ Bindings: Env }>();
    app.use('*', testSessionMiddleware);
    app.route(
        '/api',
        createHealthRoutes(() => healthRepository),
    );
    return app;
}

export function createTestAppWithUsers(userRepository: IUserRepository) {
    const app = new Hono<{ Bindings: Env }>();
    app.use('*', testSessionMiddleware);
    app.route(
        '/api',
        createUserRoutes(
            () => userRepository,
            () => departmentRepository,
        ),
    );
    return app;
}

export function createTestAppWithAuth(userRepository: IUserRepository) {
    const app = new Hono<{ Bindings: Env }>();
    app.use('*', testSessionMiddleware);
    app.route(
        '/api',
        createAuthRoutes(
            () => userRepository,
            async (env) => testAuthentication(env, userRepository),
        ),
    );
    return app;
}

export function createTestAppWithAccessCodes(
    accessCodeRepository: IAccessCodeRepository,
) {
    const app = new Hono<{ Bindings: Env }>();
    app.use('*', testSessionMiddleware);
    app.route(
        '/api',
        createAccessCodeRoutes(() => accessCodeRepository),
    );
    return app;
}

export function createTestAppWithTimetable(
    timetableRepository: ITimetableRepository,
) {
    const app = new Hono<{ Bindings: Env; Variables: ContentEditVariables }>();
    app.use('*', testSessionMiddleware);
    app.route(
        '/api',
        createTimetableRoutes(() => timetableRepository),
    );
    return app;
}

export function createTestAppWithRooms(roomRepository: IRoomRepository) {
    const app = new Hono<{ Bindings: Env; Variables: ContentEditVariables }>();
    app.use('*', testSessionMiddleware);
    app.route(
        '/api',
        createRoomRoutes(() => roomRepository),
    );
    return app;
}

export function createTestAppWithPrograms(
    programRepository: IProgramRepository,
) {
    const app = new Hono<{ Bindings: Env; Variables: ContentEditVariables }>();
    app.use('*', testSessionMiddleware);
    app.route(
        '/api',
        createProgramRoutes(() => programRepository),
    );
    return app;
}

export function createTestAppWithShopItems(
    shopItemRepository: IShopItemRepository,
) {
    const app = new Hono<{ Bindings: Env; Variables: ContentEditVariables }>();
    app.use('*', testSessionMiddleware);
    app.route(
        '/api',
        createShopItemRoutes(() => shopItemRepository),
    );
    return app;
}

export function createTestAppWithOtherItems(
    otherItemRepository: IOtherItemRepository,
) {
    const app = new Hono<{ Bindings: Env; Variables: ContentEditVariables }>();
    app.use('*', testSessionMiddleware);
    app.route(
        '/api',
        createOtherItemRoutes(() => otherItemRepository),
    );
    return app;
}

export function createTestAppWithDepartments(
    departmentRepository: IDepartmentRepository,
) {
    const app = new Hono<{ Bindings: Env; Variables: ContentEditVariables }>();
    app.use('*', testSessionMiddleware);
    app.route(
        '/api',
        createDepartmentRoutes(() => departmentRepository),
    );
    return app;
}

type SearchRepositories = {
    timetableRepository: ITimetableRepository;
    roomRepository: IRoomRepository;
    programRepository: IProgramRepository;
    shopItemRepository: IShopItemRepository;
    otherItemRepository: IOtherItemRepository;
};

export function createTestAppWithSearch(repositories: SearchRepositories) {
    const app = new Hono<{ Bindings: Env }>();
    app.use('*', testSessionMiddleware);
    app.route(
        '/api',
        createSearchRoutes(() => ({
            timetableRepository: repositories.timetableRepository,
            roomRepository: repositories.roomRepository,
            programRepository: repositories.programRepository,
            shopItemRepository: repositories.shopItemRepository,
            otherItemRepository: repositories.otherItemRepository,
        })),
    );
    return app;
}
