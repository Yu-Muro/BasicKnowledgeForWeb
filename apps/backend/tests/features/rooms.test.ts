import type { Env } from '@backend/src/db/connection';
import type {
    IRoomRepository,
    RoomWithDepartments,
} from '@backend/src/infrastructure/repositories/room/IRoomRepository';
import { beforeAll, describe, expect, it, jest } from '@jest/globals';
import { sign } from 'hono/jwt';
import { createTestAppWithRooms } from '../helpers/createTestApp';

const JWT_SECRET = 'test-secret';
const mockEnv = { JWT_SECRET } as unknown as Env;

const EVENT_ID = '00000000-0000-4000-8000-000000000001';
const OTHER_EVENT_ID = '00000000-0000-4000-8000-000000000002';

const DEPT_ID_1 = '60000000-0000-4000-8000-000000000001';
const DEPT_ID_2 = '60000000-0000-4000-8000-000000000002';

const room1: RoomWithDepartments = {
    id: '20000000-0000-4000-8000-000000000001',
    eventId: EVENT_ID,
    buildingName: 'A棟',
    floor: '1階',
    roomName: '会場 A',
    preDayManagerId: DEPT_ID_1,
    preDayManagerName: '総務部',
    preDayPurpose: '搬入受付',
    dayManagerId: DEPT_ID_1,
    dayManagerName: '総務部',
    dayPurpose: '本部受付',
    notes: null,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
};

const room2: RoomWithDepartments = {
    ...room1,
    id: '20000000-0000-4000-8000-000000000002',
    roomName: '会場 B',
    preDayManagerId: null,
    preDayManagerName: null,
    preDayPurpose: null,
    dayManagerId: DEPT_ID_2,
    dayManagerName: '企画部',
    dayPurpose: 'メイン企画',
};

let accessToken: string;
let adminToken: string;
let userToken: string;

beforeAll(async () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    accessToken = await sign({ event_id: EVENT_ID, exp }, JWT_SECRET);
    adminToken = await sign(
        {
            id: 'admin-id',
            name: 'Admin',
            email: 'admin@test.com',
            role: 'admin',
            exp,
        },
        JWT_SECRET,
        'HS256',
    );
    userToken = await sign(
        {
            id: 'user-id',
            name: 'User',
            email: 'user@test.com',
            role: 'user',
            exp,
        },
        JWT_SECRET,
        'HS256',
    );
});

function createMockRoomRepository(
    overrides: Partial<IRoomRepository> = {},
): IRoomRepository {
    return {
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
        create: jest
            .fn<IRoomRepository['create']>()
            .mockImplementation(() => Promise.resolve(room1)),
        update: jest
            .fn<IRoomRepository['update']>()
            .mockImplementation(() => Promise.resolve(room1)),
        delete: jest
            .fn<IRoomRepository['delete']>()
            .mockImplementation(() => Promise.resolve(true)),
        ...overrides,
    };
}

// ─── GET /api/rooms ───────────────────────────────────────────────────────────

describe('GET /api/rooms', () => {
    it('有効な access_token と一致する x-event-id で 200 と rooms 配列が返ること', async () => {
        const repo = createMockRoomRepository({
            findByEventId: jest
                .fn<(eventId: string) => Promise<RoomWithDepartments[]>>()
                .mockResolvedValue([room1, room2]),
        });
        const app = createTestAppWithRooms(repo);

        const res = await app.request(
            '/api/rooms',
            {
                headers: {
                    'x-event-id': EVENT_ID,
                    Cookie: `access_token=${accessToken}`,
                },
            },
            mockEnv,
        );
        const body = (await res.json()) as { rooms: RoomWithDepartments[] };

        expect(res.status).toBe(200);
        expect(body.rooms).toHaveLength(2);
    });

    it('部署名が含まれること', async () => {
        const repo = createMockRoomRepository({
            findByEventId: jest
                .fn<(eventId: string) => Promise<RoomWithDepartments[]>>()
                .mockResolvedValue([room1, room2]),
        });
        const app = createTestAppWithRooms(repo);

        const res = await app.request(
            '/api/rooms',
            {
                headers: {
                    'x-event-id': EVENT_ID,
                    Cookie: `access_token=${accessToken}`,
                },
            },
            mockEnv,
        );
        const body = (await res.json()) as { rooms: RoomWithDepartments[] };

        expect(body.rooms[0]?.dayManagerName).toBe('総務部');
        expect(body.rooms[1]?.preDayManagerName).toBeNull();
        expect(body.rooms[1]?.dayManagerName).toBe('企画部');
    });

    it('x-event-id でフィルタリングされること', async () => {
        const findByEventId = jest
            .fn<(eventId: string) => Promise<RoomWithDepartments[]>>()
            .mockImplementation((eventId) =>
                Promise.resolve(eventId === EVENT_ID ? [room1, room2] : []),
            );
        const app = createTestAppWithRooms(
            createMockRoomRepository({ findByEventId }),
        );

        const res = await app.request(
            '/api/rooms',
            {
                headers: {
                    'x-event-id': OTHER_EVENT_ID,
                    Cookie: `auth_token=${adminToken}`,
                },
            },
            mockEnv,
        );
        const body = (await res.json()) as { rooms: RoomWithDepartments[] };

        expect(res.status).toBe(200);
        expect(body.rooms).toHaveLength(0);
        expect(findByEventId).toHaveBeenCalledWith(OTHER_EVENT_ID);
    });

    it('認証なしのとき 401 が返ること', async () => {
        const app = createTestAppWithRooms(createMockRoomRepository());

        const res = await app.request('/api/rooms', {
            headers: { 'x-event-id': EVENT_ID },
        });

        expect(res.status).toBe(401);
    });

    it('部署スタッフのセッションでアクセスできること', async () => {
        const app = createTestAppWithRooms(createMockRoomRepository());

        const res = await app.request(
            '/api/rooms',
            {
                headers: {
                    'x-event-id': EVENT_ID,
                    Cookie: `auth_token=${userToken}`,
                },
            },
            mockEnv,
        );

        expect(res.status).toBe(200);
    });

    it('access_token の event_id と x-event-id が不一致のとき 401 が返ること', async () => {
        const app = createTestAppWithRooms(createMockRoomRepository());

        const res = await app.request(
            '/api/rooms',
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

    it('x-event-id ヘッダーが未指定のとき 400 が返ること', async () => {
        const app = createTestAppWithRooms(createMockRoomRepository());

        const res = await app.request(
            '/api/rooms',
            { headers: { Cookie: `auth_token=${adminToken}` } },
            mockEnv,
        );

        expect(res.status).toBe(400);
    });

    it('x-event-id が UUID でないとき 400 が返ること', async () => {
        const app = createTestAppWithRooms(createMockRoomRepository());

        const res = await app.request(
            '/api/rooms',
            {
                headers: {
                    'x-event-id': 'not-a-uuid',
                    Cookie: `auth_token=${adminToken}`,
                },
            },
            mockEnv,
        );

        expect(res.status).toBe(400);
    });

    it('0 件のとき空配列が返ること', async () => {
        const app = createTestAppWithRooms(createMockRoomRepository());

        const res = await app.request(
            '/api/rooms',
            {
                headers: {
                    'x-event-id': EVENT_ID,
                    Cookie: `access_token=${accessToken}`,
                },
            },
            mockEnv,
        );
        const body = (await res.json()) as { rooms: RoomWithDepartments[] };

        expect(res.status).toBe(200);
        expect(body.rooms).toHaveLength(0);
    });
});

const validRoomBody = {
    event_id: EVENT_ID,
    building_name: 'A棟',
    floor: '1階',
    room_name: '会議室1',
    day_manager_id: DEPT_ID_1,
    day_purpose: '本部受付',
};

const ROOM_ID = room1.id;

// ─── POST /api/rooms ──────────────────────────────────────────────────────────

describe('POST /api/rooms', () => {
    it('admin トークンと正しいボディで 201 と room が返ること', async () => {
        const repo = createMockRoomRepository({
            create: jest
                .fn<IRoomRepository['create']>()
                .mockImplementation(() => Promise.resolve(room1)),
        });
        const app = createTestAppWithRooms(repo);

        const res = await app.request(
            '/api/rooms',
            {
                method: 'POST',
                headers: {
                    'x-event-id': EVENT_ID,
                    'Content-Type': 'application/json',
                    Cookie: `auth_token=${adminToken}`,
                },
                body: JSON.stringify(validRoomBody),
            },
            mockEnv,
        );

        expect(res.status).toBe(201);
        const body = (await res.json()) as { room: RoomWithDepartments };
        expect(body.room.id).toBe(room1.id);
    });

    it('必須フィールドが欠けている場合は 400 が返ること', async () => {
        const app = createTestAppWithRooms(createMockRoomRepository());

        const res = await app.request(
            '/api/rooms',
            {
                method: 'POST',
                headers: {
                    'x-event-id': EVENT_ID,
                    'Content-Type': 'application/json',
                    Cookie: `auth_token=${adminToken}`,
                },
                body: JSON.stringify({ building_name: 'A棟' }),
            },
            mockEnv,
        );

        expect(res.status).toBe(400);
    });

    it('body の event_id と x-event-id が不一致のとき 400 が返ること', async () => {
        const app = createTestAppWithRooms(createMockRoomRepository());

        const res = await app.request(
            '/api/rooms',
            {
                method: 'POST',
                headers: {
                    'x-event-id': OTHER_EVENT_ID,
                    'Content-Type': 'application/json',
                    Cookie: `auth_token=${adminToken}`,
                },
                body: JSON.stringify(validRoomBody),
            },
            mockEnv,
        );

        expect(res.status).toBe(400);
    });

    it('認証なしのとき 401 が返ること', async () => {
        const app = createTestAppWithRooms(createMockRoomRepository());

        const res = await app.request('/api/rooms', {
            method: 'POST',
            headers: {
                'x-event-id': EVENT_ID,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(validRoomBody),
        });

        expect(res.status).toBe(401);
    });

    it('部署スタッフのセッションでアクセスできること', async () => {
        const app = createTestAppWithRooms(createMockRoomRepository());

        const res = await app.request(
            '/api/rooms',
            {
                method: 'POST',
                headers: {
                    'x-event-id': EVENT_ID,
                    'Content-Type': 'application/json',
                    Cookie: `auth_token=${userToken}`,
                },
                body: JSON.stringify(validRoomBody),
            },
            mockEnv,
        );

        expect(res.status).toBe(201);
    });
});

// ─── PUT /api/rooms/:id ───────────────────────────────────────────────────────

describe('PUT /api/rooms/:id', () => {
    it.each(['admin', 'user'])(
        'admin トークンと正しいボディで 200 と更新済み room が返ること（ロール: %s）',
        async (role) => {
            const updated = { ...room1, roomName: '変更後会議室' };
            const repo = createMockRoomRepository({
                update: jest
                    .fn<IRoomRepository['update']>()
                    .mockImplementation(() => Promise.resolve(updated)),
            });
            const app = createTestAppWithRooms(repo);

            const res = await app.request(
                `/api/rooms/${ROOM_ID}`,
                {
                    method: 'PUT',
                    headers: {
                        'x-event-id': EVENT_ID,
                        'Content-Type': 'application/json',
                        Cookie: `auth_token=${role === 'admin' ? adminToken : userToken}`,
                    },
                    body: JSON.stringify({ room_name: '変更後会議室' }),
                },
                mockEnv,
            );

            expect(res.status).toBe(200);
            const body = (await res.json()) as { room: RoomWithDepartments };
            expect(body.room.roomName).toBe('変更後会議室');
        },
    );

    it('部屋が存在しない場合は 404 が返ること', async () => {
        const repo = createMockRoomRepository({
            update: jest
                .fn<IRoomRepository['update']>()
                .mockImplementation(() => Promise.resolve(null)),
        });
        const app = createTestAppWithRooms(repo);

        const res = await app.request(
            `/api/rooms/${ROOM_ID}`,
            {
                method: 'PUT',
                headers: {
                    'x-event-id': EVENT_ID,
                    'Content-Type': 'application/json',
                    Cookie: `auth_token=${adminToken}`,
                },
                body: JSON.stringify({ room_name: '変更' }),
            },
            mockEnv,
        );

        expect(res.status).toBe(404);
    });

    it('不正な UUID のとき 400 が返ること', async () => {
        const app = createTestAppWithRooms(createMockRoomRepository());

        const res = await app.request(
            '/api/rooms/not-a-uuid',
            {
                method: 'PUT',
                headers: {
                    'x-event-id': EVENT_ID,
                    'Content-Type': 'application/json',
                    Cookie: `auth_token=${adminToken}`,
                },
                body: JSON.stringify({ room_name: '変更' }),
            },
            mockEnv,
        );

        expect(res.status).toBe(400);
    });

    it('認証なしのとき 401 が返ること', async () => {
        const app = createTestAppWithRooms(createMockRoomRepository());

        const res = await app.request(`/api/rooms/${ROOM_ID}`, {
            method: 'PUT',
            headers: {
                'x-event-id': EVENT_ID,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ room_name: '変更' }),
        });

        expect(res.status).toBe(401);
    });
});

// ─── DELETE /api/rooms/:id ────────────────────────────────────────────────────

describe('DELETE /api/rooms/:id', () => {
    it.each(['admin', 'user'])(
        'admin トークンで 200 と削除した id が返ること（ロール: %s）',
        async (role) => {
            const repo = createMockRoomRepository({
                delete: jest
                    .fn<IRoomRepository['delete']>()
                    .mockImplementation(() => Promise.resolve(true)),
            });
            const app = createTestAppWithRooms(repo);

            const res = await app.request(
                `/api/rooms/${ROOM_ID}`,
                {
                    method: 'DELETE',
                    headers: {
                        'x-event-id': EVENT_ID,
                        Cookie: `auth_token=${role === 'admin' ? adminToken : userToken}`,
                    },
                },
                mockEnv,
            );

            expect(res.status).toBe(200);
            const body = (await res.json()) as { id: string };
            expect(body.id).toBe(ROOM_ID);
        },
    );

    it('部屋が存在しない場合は 404 が返ること', async () => {
        const repo = createMockRoomRepository({
            delete: jest
                .fn<IRoomRepository['delete']>()
                .mockImplementation(() => Promise.resolve(false)),
        });
        const app = createTestAppWithRooms(repo);

        const res = await app.request(
            `/api/rooms/${ROOM_ID}`,
            {
                method: 'DELETE',
                headers: {
                    'x-event-id': EVENT_ID,
                    Cookie: `auth_token=${adminToken}`,
                },
            },
            mockEnv,
        );

        expect(res.status).toBe(404);
    });

    it('不正な UUID のとき 400 が返ること', async () => {
        const app = createTestAppWithRooms(createMockRoomRepository());

        const res = await app.request(
            '/api/rooms/not-a-uuid',
            {
                method: 'DELETE',
                headers: {
                    'x-event-id': EVENT_ID,
                    Cookie: `auth_token=${adminToken}`,
                },
            },
            mockEnv,
        );

        expect(res.status).toBe(400);
    });

    it('認証なしのとき 401 が返ること', async () => {
        const app = createTestAppWithRooms(createMockRoomRepository());

        const res = await app.request(`/api/rooms/${ROOM_ID}`, {
            method: 'DELETE',
            headers: { 'x-event-id': EVENT_ID },
        });

        expect(res.status).toBe(401);
    });
});
