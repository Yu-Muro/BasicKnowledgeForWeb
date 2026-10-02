import { describe, expect, it, jest } from '@jest/globals';
import type {
    IOtherItemRepository,
    OtherItem,
} from '@backend/src/infrastructure/repositories/other-item/IOtherItemRepository';
import type {
    IProgramRepository,
    Program,
} from '@backend/src/infrastructure/repositories/program/IProgramRepository';
import type {
    IRoomRepository,
    RoomWithDepartments,
} from '@backend/src/infrastructure/repositories/room/IRoomRepository';
import type {
    IShopItemRepository,
    ShopItem,
} from '@backend/src/infrastructure/repositories/shop-item/IShopItemRepository';
import type {
    ITimetableRepository,
    TimetableItem,
} from '@backend/src/infrastructure/repositories/timetable/ITimetableRepository';
import { SearchUseCase } from '@backend/src/use-cases/search/SearchUseCase';

const notCalled = () => Promise.reject(new Error('not called'));

const timetableRepo = (): ITimetableRepository => ({
    findByEventId: jest
        .fn<(eventId: string) => Promise<TimetableItem[]>>()
        .mockResolvedValue([]),
    findById: jest.fn<ITimetableRepository['findById']>().mockImplementation(notCalled),
    search: jest
        .fn<
            (keyword: string, eventId: string) => Promise<TimetableItem[]>
        >()
        .mockResolvedValue([]),
    create: jest.fn<ITimetableRepository['create']>().mockImplementation(notCalled),
    update: jest.fn<ITimetableRepository['update']>().mockImplementation(notCalled),
    delete: jest.fn<ITimetableRepository['delete']>().mockImplementation(notCalled),
});

const roomRepo = (): IRoomRepository => ({
    findByEventId: jest
        .fn<(eventId: string) => Promise<RoomWithDepartments[]>>()
        .mockResolvedValue([]),
    search: jest
        .fn<
            (
                keyword: string,
                eventId: string,
            ) => Promise<RoomWithDepartments[]>
        >()
        .mockResolvedValue([]),
    create: jest.fn<IRoomRepository['create']>().mockImplementation(notCalled),
    update: jest.fn<IRoomRepository['update']>().mockImplementation(notCalled),
    delete: jest.fn<IRoomRepository['delete']>().mockImplementation(notCalled),
});

const programRepo = (): IProgramRepository => ({
    findByEventId: jest
        .fn<(eventId: string) => Promise<Program[]>>()
        .mockResolvedValue([]),
    findById: jest.fn<IProgramRepository['findById']>().mockImplementation(notCalled),
    search: jest
        .fn<(keyword: string, eventId: string) => Promise<Program[]>>()
        .mockResolvedValue([]),
    create: jest.fn<IProgramRepository['create']>().mockImplementation(notCalled),
    update: jest.fn<IProgramRepository['update']>().mockImplementation(notCalled),
    delete: jest.fn<IProgramRepository['delete']>().mockImplementation(notCalled),
});

const shopRepo = (): IShopItemRepository => ({
    findByEventId: jest
        .fn<(eventId: string) => Promise<ShopItem[]>>()
        .mockResolvedValue([]),
    search: jest
        .fn<(keyword: string, eventId: string) => Promise<ShopItem[]>>()
        .mockResolvedValue([]),
    create: jest.fn<IShopItemRepository['create']>().mockImplementation(notCalled),
    update: jest.fn<IShopItemRepository['update']>().mockImplementation(notCalled),
    delete: jest.fn<IShopItemRepository['delete']>().mockImplementation(notCalled),
});

const otherRepo = (): IOtherItemRepository => ({
    findByEventId: jest
        .fn<(eventId: string) => Promise<OtherItem[]>>()
        .mockResolvedValue([]),
    search: jest
        .fn<(keyword: string, eventId: string) => Promise<OtherItem[]>>()
        .mockResolvedValue([]),
    create: jest.fn<IOtherItemRepository['create']>().mockImplementation(notCalled),
    update: jest.fn<IOtherItemRepository['update']>().mockImplementation(notCalled),
    delete: jest.fn<IOtherItemRepository['delete']>().mockImplementation(notCalled),
});

describe('SearchUseCase', () => {
    it('5 つのリポジトリ結果をまとめて返す', async () => {
        const timetableRepository = timetableRepo();
        const roomRepository = roomRepo();
        const programRepository = programRepo();
        const shopItemRepository = shopRepo();
        const otherItemRepository = otherRepo();

        jest.spyOn(timetableRepository, 'search').mockResolvedValue([
            {
                id: 'tt-1',
                eventId: 'event-1',
                title: '開会式',
                startTime: new Date(),
                endTime: new Date(),
                location: '会場A',
                description: null,
                isPublic: true,
                departments: [],
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        ]);
        jest.spyOn(roomRepository, 'search').mockResolvedValue([
            {
                id: 'room-1',
                eventId: 'event-1',
                buildingName: 'A棟',
                floor: '2F',
                roomName: '201',
                preDayManagerId: null,
                preDayManagerName: null,
                preDayPurpose: null,
                dayManagerId: 'dept-1',
                dayManagerName: '運営部',
                dayPurpose: '受付',
                notes: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        ]);
        jest.spyOn(programRepository, 'search').mockResolvedValue([
            {
                id: 'program-1',
                eventId: 'event-1',
                name: '企画1',
                location: 'ホール',
                startTime: new Date(),
                endTime: new Date(),
                description: null,
                imageUrl: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        ]);
        jest.spyOn(shopItemRepository, 'search').mockResolvedValue([
            {
                id: 'item-1',
                eventId: 'event-1',
                name: 'グッズA',
                price: 1000,
                description: null,
                imageUrl: 'https://assets.example.com/event-1/item-1.webp',
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        ]);
        jest.spyOn(otherItemRepository, 'search').mockResolvedValue([
            {
                id: 'other-1',
                eventId: 'event-1',
                title: '連絡',
                content: '集合時間は9時です',
                imageUrl: null,
                displayOrder: 1,
                createdBy: 'user-1',
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        ]);

        const useCase = new SearchUseCase(
            timetableRepository,
            roomRepository,
            programRepository,
            shopItemRepository,
            otherItemRepository,
        );

        const result = await useCase.execute('keyword', 'event-1');

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.timetable).toHaveLength(1);
            expect(result.data.rooms).toHaveLength(1);
            expect(result.data.programs).toHaveLength(1);
            expect(result.data.shopItems).toHaveLength(1);
            expect(result.data.otherItems).toHaveLength(1);
        }
        expect(timetableRepository.search).toHaveBeenCalledWith(
            'keyword',
            'event-1',
        );
    });

    it('いずれかの検索が失敗したとき error を返す', async () => {
        const timetableRepository = timetableRepo();
        const roomRepository = roomRepo();
        const programRepository = programRepo();
        const shopItemRepository = shopRepo();
        const otherItemRepository = otherRepo();

        jest.spyOn(programRepository, 'search').mockRejectedValue(
            new Error('db error'),
        );

        const useCase = new SearchUseCase(
            timetableRepository,
            roomRepository,
            programRepository,
            shopItemRepository,
            otherItemRepository,
        );

        const result = await useCase.execute('keyword', 'event-1');
        expect(result.success).toBe(false);
    });
});
