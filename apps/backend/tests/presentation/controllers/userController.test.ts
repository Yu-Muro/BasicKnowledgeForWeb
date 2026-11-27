import { Hono } from 'hono';
import { describe, expect, it } from '@jest/globals';
import {
    createUser,
    getUsers,
    updateUserRole,
} from '@backend/src/presentation/controllers/userController';
import type { User } from '@backend/src/infrastructure/repositories/user/IUserRepository';
import type { ICreateUserUseCase } from '@backend/src/use-cases/user/ICreateUserUseCase';
import type { IGetUsersUseCase } from '@backend/src/use-cases/user/IGetUsersUseCase';
import type { IUpdateUserRoleUseCase } from '@backend/src/use-cases/user/IUpdateUserRoleUseCase';

const mockUser: User = {
    id: 'uuid-1',
    name: 'テストユーザー',
    email: 'test@example.com',
    password: 'hashed',
    role: 'user',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    departmentId: '60000000-0000-4000-8000-000000000001',
    deletedAt: null,
    sessionVersion: 0,
};

// ---- getUsers ----

describe('getUsers controller', () => {
    it('ユーザー一覧を200で返す', async () => {
        const mockUseCase: IGetUsersUseCase = {
            execute: async () => ({ success: true, data: [mockUser] }),
        };
        const app = new Hono();
        app.get('/users', (c) => getUsers(c, mockUseCase));

        const res = await app.request('/users');

        expect(res.status).toBe(200);
        const json = await res.json() as { users: User[] };
        expect(json.users).toHaveLength(1);
        expect(json.users[0].email).toBe('test@example.com');
    });

    it('UseCase失敗時に500を返す', async () => {
        const mockUseCase: IGetUsersUseCase = {
            execute: async () => ({ success: false, error: 'DB Error' }),
        };
        const app = new Hono();
        app.get('/users', (c) => getUsers(c, mockUseCase));

        const res = await app.request('/users');

        expect(res.status).toBe(500);
        expect(await res.json()).toEqual({ error: 'DB Error' });
    });
});

// ---- createUser ----

describe('createUser controller', () => {
    const validBody = {
        name: 'テストユーザー',
        email: 'test@example.com',
        password: 'password123',
        departmentId: '60000000-0000-4000-8000-000000000001',
    };

    function postJson(app: Hono, body: unknown) {
        return app.request('/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
    }

    it('ユーザー作成成功時に201を返す', async () => {
        const mockUseCase: ICreateUserUseCase = {
            execute: async () => ({ success: true, data: mockUser }),
        };
        const app = new Hono();
        app.post('/users', (c) => createUser(c, mockUseCase));

        const res = await postJson(app, validBody);

        expect(res.status).toBe(201);
        const json = await res.json() as { user: User };
        expect(json.user.email).toBe('test@example.com');
    });

    it('バリデーションエラー時に400を返す', async () => {
        const mockUseCase: ICreateUserUseCase = {
            execute: async () => ({ success: true, data: mockUser }),
        };
        const app = new Hono();
        app.post('/users', (c) => createUser(c, mockUseCase));

        const res = await postJson(app, { name: '', email: 'invalid', password: 'short' });

        expect(res.status).toBe(400);
        const json = await res.json() as { error: string };
        expect(json.error).toBe('バリデーションエラー');
    });

    it('UseCase失敗時（メール重複など）に400を返す', async () => {
        const mockUseCase: ICreateUserUseCase = {
            execute: async () => ({
                success: false,
                error: 'このメールアドレスは既に使用されています',
            }),
        };
        const app = new Hono();
        app.post('/users', (c) => createUser(c, mockUseCase));

        const res = await postJson(app, validBody);

        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({
            error: 'このメールアドレスは既に使用されています',
        });
    });
});

// ---- updateUserRole ----

describe('updateUserRole controller', () => {
    const USER_ID = '00000000-0000-4000-8000-000000000001';

    function putJson(app: Hono, id: string, body: unknown) {
        return app.request(`/users/${id}/role`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
    }

    it('ロール変更成功時に 200 とメッセージを返す', async () => {
        const mockUseCase: IUpdateUserRoleUseCase = {
            execute: async () => ({ success: true }),
        };
        const app = new Hono();
        app.put('/users/:id/role', (c) => updateUserRole(c, mockUseCase));

        const res = await putJson(app, USER_ID, { role: 'admin' });

        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ message: 'ロールを変更しました' });
    });

    it('UUID でない id の場合 400 を返す', async () => {
        const mockUseCase: IUpdateUserRoleUseCase = {
            execute: async () => ({ success: true }),
        };
        const app = new Hono();
        app.put('/users/:id/role', (c) => updateUserRole(c, mockUseCase));

        const res = await putJson(app, 'invalid-id', { role: 'admin' });

        expect(res.status).toBe(400);
    });

    it('role が不正な値の場合 400 を返す', async () => {
        const mockUseCase: IUpdateUserRoleUseCase = {
            execute: async () => ({ success: true }),
        };
        const app = new Hono();
        app.put('/users/:id/role', (c) => updateUserRole(c, mockUseCase));

        const res = await putJson(app, USER_ID, { role: 'superadmin' });

        expect(res.status).toBe(400);
    });

    it('ユーザーが存在しない場合 404 を返す', async () => {
        const mockUseCase: IUpdateUserRoleUseCase = {
            execute: async () => ({
                success: false,
                error: 'ユーザーが見つかりません',
                status: 404,
            }),
        };
        const app = new Hono();
        app.put('/users/:id/role', (c) => updateUserRole(c, mockUseCase));

        const res = await putJson(app, USER_ID, { role: 'admin' });

        expect(res.status).toBe(404);
    });
});
