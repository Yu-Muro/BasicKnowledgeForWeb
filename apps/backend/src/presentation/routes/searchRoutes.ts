import { createDatabaseClient, type Env } from '@backend/src/db/connection';
import type { IOtherItemRepository } from '@backend/src/infrastructure/repositories/other-item/IOtherItemRepository';
import { OtherItemRepository } from '@backend/src/infrastructure/repositories/other-item/OtherItemRepository';
import type { IProgramRepository } from '@backend/src/infrastructure/repositories/program/IProgramRepository';
import { ProgramRepository } from '@backend/src/infrastructure/repositories/program/ProgramRepository';
import type { IRoomRepository } from '@backend/src/infrastructure/repositories/room/IRoomRepository';
import { RoomRepository } from '@backend/src/infrastructure/repositories/room/RoomRepository';
import type { IShopItemRepository } from '@backend/src/infrastructure/repositories/shop-item/IShopItemRepository';
import { ShopItemRepository } from '@backend/src/infrastructure/repositories/shop-item/ShopItemRepository';
import type { ITimetableRepository } from '@backend/src/infrastructure/repositories/timetable/ITimetableRepository';
import { TimetableRepository } from '@backend/src/infrastructure/repositories/timetable/TimetableRepository';
import { searchContent } from '@backend/src/presentation/controllers/searchController';
import { contentAccessMiddleware } from '@backend/src/presentation/middleware/contentAccessMiddleware';
import { SearchUseCase } from '@backend/src/use-cases/search/SearchUseCase';
import { Hono } from 'hono';
import type { DatabaseProvider } from './requestDatabase';

type SearchRepositoryFactory = (
    env: Env,
    database?: DatabaseProvider,
) => {
    timetableRepository: ITimetableRepository;
    roomRepository: IRoomRepository;
    programRepository: IProgramRepository;
    shopItemRepository: IShopItemRepository;
    otherItemRepository: IOtherItemRepository;
};

export function createSearchRoutes(
    repositoryFactory: SearchRepositoryFactory = (env, database) => {
        const db = database?.() ?? createDatabaseClient(env);
        return {
            timetableRepository: new TimetableRepository(db),
            roomRepository: new RoomRepository(db),
            programRepository: new ProgramRepository(db),
            shopItemRepository: new ShopItemRepository(db),
            otherItemRepository: new OtherItemRepository(db),
        };
    },
) {
    return new Hono<{ Bindings: Env }>().get(
        '/search',
        contentAccessMiddleware,
        async (c) => {
            const {
                timetableRepository,
                roomRepository,
                programRepository,
                shopItemRepository,
                otherItemRepository,
            } = repositoryFactory(c.env, c.get('databaseClient'));

            const useCase = new SearchUseCase(
                timetableRepository,
                roomRepository,
                programRepository,
                shopItemRepository,
                otherItemRepository,
            );

            return searchContent(c, useCase);
        },
    );
}
