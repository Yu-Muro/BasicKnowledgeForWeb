import type { createDatabaseClient } from '@backend/src/db/connection';
import { ShopItemRepository } from '@backend/src/infrastructure/repositories/shop-item/ShopItemRepository';
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

describe('ShopItemRepository', () => {
    it('findByEventId が name 昇順で select クエリを実行すること', async () => {
        const orderBy = jest.fn().mockImplementation(() => Promise.resolve([]));
        const where = jest.fn().mockReturnValue({ orderBy });
        const from = jest.fn().mockReturnValue({ where });
        const db = {
            select: jest.fn().mockReturnValue({ from }),
        } as unknown as DatabaseClient;

        const repo = new ShopItemRepository(db);
        await repo.findByEventId(EVENT_ID);

        expect(db.select).toHaveBeenCalled();
        expect(from).toHaveBeenCalled();
        expect(where).toHaveBeenCalled();
        expect(orderBy).toHaveBeenCalled();
    });

    it('search が createIlikePattern を使って ILIKE 条件を構築すること', async () => {
        mockedCreateIlikePattern.mockClear();
        const orderBy = jest.fn().mockImplementation(() => Promise.resolve([]));
        const where = jest.fn().mockReturnValue({ orderBy });
        const from = jest.fn().mockReturnValue({ where });
        const db = {
            select: jest.fn().mockReturnValue({ from }),
        } as unknown as DatabaseClient;

        const repo = new ShopItemRepository(db);
        await repo.search('商品_%', EVENT_ID);

        expect(mockedCreateIlikePattern).toHaveBeenCalledWith('商品_%');
        expect(where).toHaveBeenCalled();
        expect(orderBy).toHaveBeenCalled();
    });
});
