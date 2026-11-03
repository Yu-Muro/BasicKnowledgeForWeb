import type { createDatabaseClient } from '@backend/src/db/connection';
import { ProgramRepository } from '@backend/src/infrastructure/repositories/program/ProgramRepository';
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

describe('ProgramRepository', () => {
    it('findByEventId が start_time 昇順で select クエリを実行すること', async () => {
        const orderBy = jest.fn().mockImplementation(() => Promise.resolve([]));
        const where = jest.fn().mockReturnValue({ orderBy });
        const from = jest.fn().mockReturnValue({ where });
        const db = {
            select: jest.fn().mockReturnValue({ from }),
        } as unknown as DatabaseClient;

        const repo = new ProgramRepository(db);
        await repo.findByEventId(EVENT_ID);

        expect(db.select).toHaveBeenCalled();
        expect(from).toHaveBeenCalled();
        expect(where).toHaveBeenCalled();
        expect(orderBy).toHaveBeenCalled();
    });

    it('search が createIlikePattern を使用して ILIKE 条件を構築すること', async () => {
        mockedCreateIlikePattern.mockClear();
        const orderBy = jest.fn().mockImplementation(() => Promise.resolve([]));
        const where = jest.fn().mockReturnValue({ orderBy });
        const from = jest.fn().mockReturnValue({ where });
        const db = {
            select: jest.fn().mockReturnValue({ from }),
        } as unknown as DatabaseClient;

        const repo = new ProgramRepository(db);
        await repo.search('企画_%', EVENT_ID);

        expect(mockedCreateIlikePattern).toHaveBeenCalledWith('企画_%');
        expect(where).toHaveBeenCalled();
        expect(orderBy).toHaveBeenCalled();
    });
});
