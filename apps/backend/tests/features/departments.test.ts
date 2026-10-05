import type { Department, IDepartmentRepository } from '@backend/src/infrastructure/repositories/departments/IDepartmentRepository';
import { beforeAll, describe, expect, it, jest } from '@jest/globals';
import { sign } from 'hono/jwt';
import type { Env } from '@backend/src/db/connection';
import { createTestAppWithDepartments } from '../helpers/createTestApp';
import { department, departmentRepository } from '../helpers/departmentRepository';
const env = { JWT_SECRET: 'test-secret' } as Env;
async function cookie(role: string) { return `auth_token=${await sign({ id: 'actor', role, exp: Math.floor(Date.now()/1000)+3600 }, env.JWT_SECRET)}`; }
describe('共通部署 API', () => {
 it('登録前でも会期指定なしで部署一覧を取得できる', async () => {
  const app = createTestAppWithDepartments(departmentRepository);
  const res = await app.request('/api/departments', {}, env);
  expect(res.status).toBe(200); expect(await res.json()).toEqual({ departments: [department] });
 });
 it('会期を切り替えても同じ一覧を返す', async () => {
  const app = createTestAppWithDepartments(departmentRepository);
  const first = await app.request('/api/departments', { headers: { 'x-event-id': 'first' } }, env);
  const second = await app.request('/api/departments', { headers: { 'x-event-id': 'second' } }, env);
  expect(await first.json()).toEqual(await second.json());
 });
 it('管理者が会期指定なしで部署を作成できる', async () => {
  const create = jest.fn<typeof departmentRepository.create>().mockResolvedValue(department);
  const app = createTestAppWithDepartments({ ...departmentRepository, create });
  const res = await app.request('/api/departments', { method: 'POST', headers: { Cookie: await cookie('admin'), 'Content-Type': 'application/json' }, body: JSON.stringify({ name: '企画部' }) }, env);
  expect(res.status).toBe(201); expect(create).toHaveBeenCalledWith({ name: '企画部' });
 });
 it.each(['POST', 'PUT', 'DELETE'])('一般ユーザーの %s を拒否する', async (method) => {
  const app = createTestAppWithDepartments(departmentRepository);
  const res = await app.request(method === 'POST' ? '/api/departments' : `/api/departments/${department.id}`, { method, headers: { Cookie: await cookie('user') } }, env);
  expect(res.status).toBe(403);
 });
 it('参照中の部署を削除すると409を返す', async () => {
  const app = createTestAppWithDepartments({ ...departmentRepository, delete: async () => { throw new Error('foreign key violation'); } });
  const res = await app.request(`/api/departments/${department.id}`, { method: 'DELETE', headers: { Cookie: await cookie('admin') } }, env);
  expect(res.status).toBe(409);
 });
 it('過去会期コピーAPIは廃止される', async () => {
  const res = await createTestAppWithDepartments(departmentRepository).request('/api/departments/copy', { method: 'POST' }, env);
  expect(res.status).toBe(404);
 });
});

const JWT_SECRET = 'test-secret';
const mockEnv = { JWT_SECRET } as unknown as Env;

const EVENT_ID = '00000000-0000-4000-8000-000000000001';
const OTHER_EVENT_ID = '00000000-0000-4000-8000-000000000002';

const dept1: Department = {
    id: '60000000-0000-4000-8000-000000000001',
    name: '企画部',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
};

const dept2: Department = {
    ...dept1,
    id: '60000000-0000-4000-8000-000000000002',
    name: '運営部',
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

function createMockDepartmentRepository(
    overrides: Partial<IDepartmentRepository> = {},
): IDepartmentRepository {
    return {
        findAll: jest
            .fn<() => Promise<Department[]>>()
            .mockResolvedValue([]),
        create: jest
            .fn<IDepartmentRepository['create']>()
            .mockImplementation(() => Promise.resolve(dept1)),
        findById: async () => null,
        update: jest
            .fn<IDepartmentRepository['update']>()
            .mockImplementation(() => Promise.resolve(dept1)),
        delete: jest
            .fn<IDepartmentRepository['delete']>()
            .mockImplementation(() => Promise.resolve(true)),
        ...overrides,
    };
}

const DEPT_ID = dept1.id;

// ─── PUT /api/departments/:id ─────────────────────────────────────────────────

describe('PUT /api/departments/:id', () => {
    it('admin トークンと正しいボディで 200 と更新済み department が返ること', async () => {
        const updated = { ...dept1, name: '変更後部署名' };
        const repo = createMockDepartmentRepository({
            update: jest
                .fn<IDepartmentRepository['update']>()
                .mockImplementation(() => Promise.resolve(updated)),
        });
        const app = createTestAppWithDepartments(repo);

        const res = await app.request(
            `/api/departments/${DEPT_ID}`,
            {
                method: 'PUT',
                headers: {
                    'x-event-id': EVENT_ID,
                    'Content-Type': 'application/json',
                    Cookie: `auth_token=${adminToken}`,
                },
                body: JSON.stringify({ name: '変更後部署名' }),
            },
            mockEnv,
        );

        expect(res.status).toBe(200);
        const body = (await res.json()) as { department: Department };
        expect(body.department.name).toBe('変更後部署名');
    });

    it('部署が存在しない場合は 404 が返ること', async () => {
        const repo = createMockDepartmentRepository({
            update: jest
                .fn<IDepartmentRepository['update']>()
                .mockImplementation(() => Promise.resolve(null)),
        });
        const app = createTestAppWithDepartments(repo);

        const res = await app.request(
            `/api/departments/${DEPT_ID}`,
            {
                method: 'PUT',
                headers: {
                    'x-event-id': EVENT_ID,
                    'Content-Type': 'application/json',
                    Cookie: `auth_token=${adminToken}`,
                },
                body: JSON.stringify({ name: '変更' }),
            },
            mockEnv,
        );

        expect(res.status).toBe(404);
    });

    it('不正な UUID のとき 400 が返ること', async () => {
        const app = createTestAppWithDepartments(
            createMockDepartmentRepository(),
        );

        const res = await app.request(
            '/api/departments/not-a-uuid',
            {
                method: 'PUT',
                headers: {
                    'x-event-id': EVENT_ID,
                    'Content-Type': 'application/json',
                    Cookie: `auth_token=${adminToken}`,
                },
                body: JSON.stringify({ name: '変更' }),
            },
            mockEnv,
        );

        expect(res.status).toBe(400);
    });

    it('認証なしのとき 401 が返ること', async () => {
        const app = createTestAppWithDepartments(
            createMockDepartmentRepository(),
        );

        const res = await app.request(`/api/departments/${DEPT_ID}`, {
            method: 'PUT',
            headers: {
                'x-event-id': EVENT_ID,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name: '変更' }),
        });

        expect(res.status).toBe(401);
    });
});

// ─── DELETE /api/departments/:id ──────────────────────────────────────────────

describe('DELETE /api/departments/:id', () => {
    it('admin トークンで 200 と削除した id が返ること', async () => {
        const repo = createMockDepartmentRepository({
            delete: jest
                .fn<IDepartmentRepository['delete']>()
                .mockImplementation(() => Promise.resolve(true)),
        });
        const app = createTestAppWithDepartments(repo);

        const res = await app.request(
            `/api/departments/${DEPT_ID}`,
            {
                method: 'DELETE',
                headers: {
                    'x-event-id': EVENT_ID,
                    Cookie: `auth_token=${adminToken}`,
                },
            },
            mockEnv,
        );

        expect(res.status).toBe(200);
        const body = (await res.json()) as { id: string };
        expect(body.id).toBe(DEPT_ID);
    });

    it('部署が存在しない場合は 404 が返ること', async () => {
        const repo = createMockDepartmentRepository({
            delete: jest
                .fn<IDepartmentRepository['delete']>()
                .mockImplementation(() => Promise.resolve(false)),
        });
        const app = createTestAppWithDepartments(repo);

        const res = await app.request(
            `/api/departments/${DEPT_ID}`,
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

    it('FK 制約違反（ユーザー・部屋割り・タイムテーブルで使用中）のとき 409 が返ること', async () => {
        const repo = createMockDepartmentRepository({
            delete: jest
                .fn<IDepartmentRepository['delete']>()
                .mockImplementation(() =>
                    Promise.reject(new Error('foreign key constraint violation')),
                ),
        });
        const app = createTestAppWithDepartments(repo);

        const res = await app.request(
            `/api/departments/${DEPT_ID}`,
            {
                method: 'DELETE',
                headers: {
                    'x-event-id': EVENT_ID,
                    Cookie: `auth_token=${adminToken}`,
                },
            },
            mockEnv,
        );

        expect(res.status).toBe(409);
        expect(await res.json()).toEqual({
            error: 'この部署はユーザー・部屋割り・タイムテーブルで使用されているため削除できません',
        });
    });

    it('不正な UUID のとき 400 が返ること', async () => {
        const app = createTestAppWithDepartments(
            createMockDepartmentRepository(),
        );

        const res = await app.request(
            '/api/departments/not-a-uuid',
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
        const app = createTestAppWithDepartments(
            createMockDepartmentRepository(),
        );

        const res = await app.request(`/api/departments/${DEPT_ID}`, {
            method: 'DELETE',
            headers: { 'x-event-id': EVENT_ID },
        });

        expect(res.status).toBe(401);
    });
});
