import { describe, expect, it, jest } from '@jest/globals';
import type { createDatabaseClient } from '@backend/src/db/connection';
import { TimetableRepository } from '@backend/src/infrastructure/repositories/timetable/TimetableRepository';
import { InvalidTimetableLaneSelectionError } from '@backend/src/infrastructure/repositories/timetable/ITimetableRepository';
import { createIlikePattern } from '@backend/src/infrastructure/repositories/utils/escapeIlikePattern';

jest.mock(
    '@backend/src/infrastructure/repositories/utils/escapeIlikePattern',
    () => ({
        createIlikePattern: jest.fn().mockReturnValue('%escaped%'),
    }),
);

type DatabaseClient = ReturnType<typeof createDatabaseClient>;

const EVENT_ID = '00000000-0000-0000-0000-000000000001';
const ITEM_ID = '10000000-0000-4000-8000-000000000001';
const mockedCreateIlikePattern = createIlikePattern as jest.MockedFunction<
    typeof createIlikePattern
>;

describe('TimetableRepository', () => {
    it('findByEventId が start_time 昇順で select クエリを実行すること', async () => {
        const orderBy = jest
            .fn()
            .mockImplementation(() => Promise.resolve([]));
        const where = jest.fn().mockReturnValue({ orderBy });
        const query = {
            leftJoin: jest.fn(),
            where,
        };
        query.leftJoin.mockReturnValue(query);
        const from = jest.fn().mockReturnValue(query);
        const db = {
            select: jest.fn().mockReturnValue({ from }),
        } as unknown as DatabaseClient;

        const repo = new TimetableRepository(db);
        await repo.findByEventId(EVENT_ID);

        expect(db.select).toHaveBeenCalled();
        expect(from).toHaveBeenCalled();
        expect(query.leftJoin).toHaveBeenCalledTimes(2);
        expect(where).toHaveBeenCalled();
        expect(orderBy).toHaveBeenCalled();
    });

    it('search が createIlikePattern を経由して ILIKE 検索を組み立てること', async () => {
        mockedCreateIlikePattern.mockClear();
        const orderBy = jest
            .fn()
            .mockImplementation(() => Promise.resolve([]));
        const where = jest.fn().mockReturnValue({ orderBy });
        const query = {
            leftJoin: jest.fn(),
            where,
        };
        query.leftJoin.mockReturnValue(query);
        const from = jest.fn().mockReturnValue(query);
        const db = {
            select: jest.fn().mockReturnValue({ from }),
        } as unknown as DatabaseClient;

        const repo = new TimetableRepository(db);
        await repo.search('会場_%', EVENT_ID);

        expect(mockedCreateIlikePattern).toHaveBeenCalledWith('会場_%');
        expect(query.leftJoin).toHaveBeenCalledTimes(2);
        expect(where).toHaveBeenCalled();
        expect(orderBy).toHaveBeenCalled();
    });

    it('部署タグだけの更新でも親行をロックして updatedAt を更新すること', async () => {
        const row = {
            id: ITEM_ID,
            eventId: EVENT_ID,
            title: '開会式',
            startTime: new Date('2025-08-01T10:00:00.000Z'),
            endTime: new Date('2025-08-01T11:00:00.000Z'),
            location: '会場A',
            description: null,
            isPublic: true,
            createdAt: new Date('2025-01-01T00:00:00.000Z'),
            updatedAt: new Date('2025-01-01T00:00:00.000Z'),
            departmentId: null,
            departmentName: null,
        };
        const forUpdate = jest
            .fn()
            .mockImplementation(() => Promise.resolve([row]));
        const txWhere = jest.fn().mockReturnValue({ for: forUpdate });
        const txFrom = jest.fn().mockReturnValue({ where: txWhere });
        const updateWhere = jest
            .fn()
            .mockImplementation(() => Promise.resolve());
        const set = jest.fn().mockReturnValue({ where: updateWhere });
        const deleteWhere = jest
            .fn()
            .mockImplementation(() => Promise.resolve());
        const tx = {
            select: jest.fn().mockReturnValue({ from: txFrom }),
            update: jest.fn().mockReturnValue({ set }),
            delete: jest.fn().mockReturnValue({ where: deleteWhere }),
            insert: jest.fn(),
        };
        const resultQuery = {
            leftJoin: jest.fn(),
            where: jest
                .fn()
                .mockImplementation(() => Promise.resolve([row])),
        };
        resultQuery.leftJoin.mockReturnValue(resultQuery);
        const db = {
            transaction: jest
                .fn<
                    (
                        callback: (
                            executor: typeof tx,
                        ) => Promise<unknown>,
                    ) => Promise<unknown>
                >()
                .mockImplementation(
                    (callback: (executor: typeof tx) => Promise<unknown>) =>
                        callback(tx),
                ),
            select: jest.fn().mockReturnValue({
                from: jest.fn().mockReturnValue(resultQuery),
            }),
        } as unknown as DatabaseClient;

        const repo = new TimetableRepository(db);
        await repo.update(ITEM_ID, EVENT_ID, { departmentIds: [] });

        expect(forUpdate).toHaveBeenCalledWith('update');
        expect(set).toHaveBeenCalledWith({ updatedAt: expect.any(Date) });
        expect(deleteWhere).toHaveBeenCalled();
    });

    it('トランザクション内の最新状態で表示先なしの更新を拒否すること', async () => {
        const forUpdate = jest.fn().mockImplementation(() =>
            Promise.resolve([
                {
                    startTime: new Date('2025-08-01T10:00:00.000Z'),
                    endTime: new Date('2025-08-01T11:00:00.000Z'),
                    isPublic: true,
                },
            ]),
        );
        const tx = {
            select: jest.fn().mockReturnValue({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({ for: forUpdate }),
                }),
            }),
            update: jest.fn(),
            delete: jest.fn(),
            insert: jest.fn(),
        };
        const db = {
            transaction: jest
                .fn<
                    (
                        callback: (
                            executor: typeof tx,
                        ) => Promise<unknown>,
                    ) => Promise<unknown>
                >()
                .mockImplementation(
                    (callback: (executor: typeof tx) => Promise<unknown>) =>
                        callback(tx),
                ),
        } as unknown as DatabaseClient;

        const repo = new TimetableRepository(db);

        await expect(
            repo.update(ITEM_ID, EVENT_ID, {
                isPublic: false,
                departmentIds: [],
            }),
        ).rejects.toBeInstanceOf(InvalidTimetableLaneSelectionError);
        expect(forUpdate).toHaveBeenCalledWith('update');
        expect(tx.update).not.toHaveBeenCalled();
    });
});
