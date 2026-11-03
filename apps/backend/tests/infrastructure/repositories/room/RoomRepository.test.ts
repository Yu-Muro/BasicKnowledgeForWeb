import type { createDatabaseClient } from '@backend/src/db/connection';
import { RoomRepository } from '@backend/src/infrastructure/repositories/room/RoomRepository';
import { createIlikePattern } from '@backend/src/infrastructure/repositories/utils/escapeIlikePattern';
import { describe, expect, it } from '@jest/globals';

jest.mock(
    '@backend/src/infrastructure/repositories/utils/escapeIlikePattern',
    () => ({
        createIlikePattern: jest.fn().mockReturnValue('%escaped%'),
    }),
);

type DatabaseClient = ReturnType<typeof createDatabaseClient>;

const EVENT_ID = '00000000-0000-0000-0000-000000000001';
const mockedCreateIlikePattern = createIlikePattern as jest.MockedFunction<
    typeof createIlikePattern
>;

describe('RoomRepository', () => {
    it('findByEventId が departments を JOIN して building_name/floor/room_name 昇順で select クエリを実行すること', async () => {
        const orderBy = jest.fn().mockImplementation(() => Promise.resolve([]));
        const where = jest.fn().mockReturnValue({ orderBy });
        const innerJoin = jest.fn().mockReturnValue({ where });
        const leftJoin = jest.fn().mockReturnValue({ innerJoin });
        const from = jest.fn().mockReturnValue({ leftJoin });
        const db = {
            select: jest.fn().mockReturnValue({ from }),
        } as unknown as DatabaseClient;

        const repo = new RoomRepository(db);
        await repo.findByEventId(EVENT_ID);

        expect(db.select).toHaveBeenCalled();
        expect(from).toHaveBeenCalled();
        expect(leftJoin).toHaveBeenCalled();
        expect(innerJoin).toHaveBeenCalled();
        expect(where).toHaveBeenCalled();
        expect(orderBy).toHaveBeenCalled();
    });

    it('search が createIlikePattern と JOIN 付きクエリを組み立てること', async () => {
        mockedCreateIlikePattern.mockClear();
        const orderBy = jest.fn().mockImplementation(() => Promise.resolve([]));
        const where = jest.fn().mockReturnValue({ orderBy });
        const innerJoin = jest.fn().mockReturnValue({ where });
        const leftJoin = jest.fn().mockReturnValue({ innerJoin });
        const from = jest.fn().mockReturnValue({ leftJoin });
        const db = {
            select: jest.fn().mockReturnValue({ from }),
        } as unknown as DatabaseClient;

        const repo = new RoomRepository(db);
        await repo.search('A棟_%', EVENT_ID);

        expect(mockedCreateIlikePattern).toHaveBeenCalledWith('A棟_%');
        expect(leftJoin).toHaveBeenCalled();
        expect(innerJoin).toHaveBeenCalled();
        expect(where).toHaveBeenCalled();
    });
});
