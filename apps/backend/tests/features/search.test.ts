import { beforeAll, describe, expect, it, jest } from '@jest/globals';
import type { Env } from '@backend/src/db/connection';
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
import { sign } from 'hono/jwt';
import { createTestAppWithSearch } from '../helpers/createTestApp';

const JWT_SECRET = 'test-secret';
const mockEnv = { JWT_SECRET } as unknown as Env;

const EVENT_ID = '00000000-0000-4000-8000-000000000001';
const OTHER_EVENT_ID = '00000000-0000-4000-8000-000000000002';

let accessToken: string;
let adminToken: string;
let userToken: string;

beforeAll(async () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    accessToken = await sign({ event_id: EVENT_ID, exp }, JWT_SECRET);
    adminToken = await sign(
        { id: 'admin-id', name: 'Admin', email: 'admin@test.com', role: 'admin', exp },
        JWT_SECRET,
        'HS256',
    );
    userToken = await sign(
        { id: 'user-id', name: 'User', email: 'user@test.com', role: 'user', exp },
        JWT_SECRET,
        'HS256',
    );
});

function createRepositories() {
    const timetableRepository: ITimetableRepository = {
        findByEventId: jest
            .fn<(eventId: string) => Promise<TimetableItem[]>>()
            .mockResolvedValue([]),
        findById: jest.fn<ITimetableRepository['findById']>().mockImplementation(
            () => Promise.reject(new Error('not called')),
        ),
        search: jest
            .fn<
                (keyword: string, eventId: string) => Promise<TimetableItem[]>
            >()
            .mockResolvedValue([]),
        create: jest.fn<ITimetableRepository['create']>().mockImplementation(
            () => Promise.reject(new Error('not called')),
        ),
        update: jest.fn<ITimetableRepository['update']>().mockImplementation(
            () => Promise.reject(new Error('not called')),
        ),
        delete: jest.fn<ITimetableRepository['delete']>().mockImplementation(
            () => Promise.reject(new Error('not called')),
        ),
    };
    const roomRepository: IRoomRepository = {
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
        create: jest.fn<IRoomRepository['create']>().mockImplementation(
            () => Promise.reject(new Error('not called')),
        ),
        update: jest.fn<IRoomRepository['update']>().mockImplementation(
            () => Promise.reject(new Error('not called')),
        ),
        delete: jest.fn<IRoomRepository['delete']>().mockImplementation(
            () => Promise.reject(new Error('not called')),
        ),
    };
    const programRepository: IProgramRepository = {
        findByEventId: jest
            .fn<(eventId: string) => Promise<Program[]>>()
            .mockResolvedValue([]),
        findById: jest.fn<IProgramRepository['findById']>().mockImplementation(
            () => Promise.reject(new Error('not called')),
        ),
        search: jest
            .fn<(keyword: string, eventId: string) => Promise<Program[]>>()
            .mockResolvedValue([]),
        create: jest.fn<IProgramRepository['create']>().mockImplementation(
            () => Promise.reject(new Error('not called')),
        ),
        update: jest.fn<IProgramRepository['update']>().mockImplementation(
            () => Promise.reject(new Error('not called')),
        ),
        delete: jest.fn<IProgramRepository['delete']>().mockImplementation(
            () => Promise.reject(new Error('not called')),
        ),
    };
    const shopItemRepository: IShopItemRepository = {
        findByEventId: jest
            .fn<(eventId: string) => Promise<ShopItem[]>>()
            .mockResolvedValue([]),
        search: jest
            .fn<(keyword: string, eventId: string) => Promise<ShopItem[]>>()
            .mockResolvedValue([]),
        create: jest.fn<IShopItemRepository['create']>().mockImplementation(
            () => Promise.reject(new Error('not called')),
        ),
        update: jest.fn<IShopItemRepository['update']>().mockImplementation(
            () => Promise.reject(new Error('not called')),
        ),
        delete: jest.fn<IShopItemRepository['delete']>().mockImplementation(
            () => Promise.reject(new Error('not called')),
        ),
    };
    const otherItemRepository: IOtherItemRepository = {
        findByEventId: jest
            .fn<(eventId: string) => Promise<OtherItem[]>>()
            .mockResolvedValue([]),
        search: jest
            .fn<(keyword: string, eventId: string) => Promise<OtherItem[]>>()
            .mockResolvedValue([]),
        create: jest.fn<IOtherItemRepository['create']>().mockImplementation(
            () => Promise.reject(new Error('not called')),
        ),
        update: jest.fn<IOtherItemRepository['update']>().mockImplementation(
            () => Promise.reject(new Error('not called')),
        ),
        delete: jest.fn<IOtherItemRepository['delete']>().mockImplementation(
            () => Promise.reject(new Error('not called')),
        ),
    };
    return {
        timetableRepository,
        roomRepository,
        programRepository,
        shopItemRepository,
        otherItemRepository,
    };
}

describe('GET /api/search', () => {
    it('有効な access_token と x-event-id で検索結果を返す', async () => {
        const {
            timetableRepository,
            roomRepository,
            programRepository,
            shopItemRepository,
            otherItemRepository,
        } = createRepositories();

        jest.spyOn(timetableRepository, 'search').mockResolvedValue([
            {
                id: 'tt-1',
                eventId: EVENT_ID,
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
                eventId: EVENT_ID,
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

        const app = createTestAppWithSearch({
            timetableRepository,
            roomRepository,
            programRepository,
            shopItemRepository,
            otherItemRepository,
        });

        const res = await app.request(
            '/api/search?q=開会',
            {
                headers: {
                    'x-event-id': EVENT_ID,
                    Cookie: `access_token=${accessToken}`,
                },
            },
            mockEnv,
        );

        expect(res.status).toBe(200);
        const body = (await res.json()) as {
            timetable: unknown[];
            rooms: unknown[];
        };
        expect(body.timetable).toHaveLength(1);
        expect(body.rooms).toHaveLength(1);
    });

    it('admin ロールの auth_token では任意の会期を検索できる', async () => {
        const repos = createRepositories();
        const app = createTestAppWithSearch(repos);

        const res = await app.request(
            '/api/search?q=all',
            {
                headers: {
                    'x-event-id': OTHER_EVENT_ID,
                    Cookie: `auth_token=${adminToken}`,
                },
            },
            mockEnv,
        );

        expect(res.status).toBe(200);
        expect(repos.timetableRepository.search).toHaveBeenCalledWith(
            'all',
            OTHER_EVENT_ID,
        );
    });

    it('role=user の auth_token では 401 を返す', async () => {
        const repos = createRepositories();
        const app = createTestAppWithSearch(repos);

        const res = await app.request(
            '/api/search?q=info',
            {
                headers: {
                    'x-event-id': EVENT_ID,
                    Cookie: `auth_token=${userToken}`,
                },
            },
            mockEnv,
        );

        expect(res.status).toBe(401);
    });

    it('access_token の event_id と x-event-id が一致しない場合 401 を返す', async () => {
        const repos = createRepositories();
        const app = createTestAppWithSearch(repos);

        const res = await app.request(
            '/api/search?q=info',
            {
                headers: {
                    'x-event-id': OTHER_EVENT_ID,
                    Cookie: `access_token=${accessToken}`,
                },
            },
            mockEnv,
        );

        expect(res.status).toBe(401);
    });

    it('認証がない場合 401 を返す', async () => {
        const repos = createRepositories();
        const app = createTestAppWithSearch(repos);

        const res = await app.request('/api/search?q=foo', {
            headers: { 'x-event-id': EVENT_ID },
        });

        expect(res.status).toBe(401);
    });

    it('q が空文字の場合 400 を返す', async () => {
        const repos = createRepositories();
        const app = createTestAppWithSearch(repos);

        const res = await app.request(
            '/api/search?q=',
            {
                headers: {
                    'x-event-id': EVENT_ID,
                    Cookie: `access_token=${accessToken}`,
                },
            },
            mockEnv,
        );

        expect(res.status).toBe(400);
    });
});
