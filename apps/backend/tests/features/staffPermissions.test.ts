import type { Env } from '@backend/src/db/connection';
import { createAccessCodeRoutes } from '@backend/src/presentation/routes/accessCodeRoutes';
import { createDepartmentRoutes } from '@backend/src/presentation/routes/departmentRoutes';
import { createOtherItemRoutes } from '@backend/src/presentation/routes/otherItemRoutes';
import { createProgramRoutes } from '@backend/src/presentation/routes/programRoutes';
import { createRoomRoutes } from '@backend/src/presentation/routes/roomRoutes';
import { createShopItemRoutes } from '@backend/src/presentation/routes/shopItemRoutes';
import { createTimetableRoutes } from '@backend/src/presentation/routes/timetableRoutes';
import { createUserRoutes } from '@backend/src/presentation/routes/userRoutes';
import { describe, expect, it } from '@jest/globals';
import { Hono } from 'hono';
import { sign } from 'hono/jwt';
import { testSessionMiddleware } from '../helpers/authentication';

const id = '00000000-0000-4000-8000-000000000001';
const env = { JWT_SECRET: 'permissions-test-secret' } as Env;
const app = new Hono<{ Bindings: Env }>();
app.use('*', testSessionMiddleware);
app.route('/api', createDepartmentRoutes());
app.route('/api', createAccessCodeRoutes());
app.route('/api', createUserRoutes());
app.route('/api', createTimetableRoutes());
app.route('/api', createRoomRoutes());
app.route('/api', createProgramRoutes());
app.route('/api', createShopItemRoutes());
app.route('/api', createOtherItemRoutes());

describe('3区分の権限境界', () => {
    it.each([
        ['POST', '/departments'],
        ['PUT', `/departments/${id}`],
        ['DELETE', `/departments/${id}`],
        ['GET', '/access-codes'],
        ['POST', '/access-codes'],
        ['DELETE', `/access-codes/${id}`],
        ['GET', '/users'],
        ['PUT', `/users/${id}/role`],
        ['PUT', `/users/${id}/department`],
        ['DELETE', `/users/${id}`],
    ])('部署スタッフは%s %sで管理操作を行えない', async (method, path) => {
        const token = await sign(
            { id, role: 'user', exp: Math.floor(Date.now() / 1000) + 60 },
            env.JWT_SECRET,
        );
        const res = await app.request(
            `/api${path}`,
            {
                method,
                headers: {
                    Cookie: `auth_token=${token}`,
                    'Content-Type': 'application/json',
                },
                body: method === 'GET' ? undefined : '{}',
            },
            env,
        );
        expect(res.status).toBe(403);
    });
    it.each(['timetable', 'rooms', 'programs', 'shop-items', 'others'])(
        'アクセスコードの閲覧者は%sを変更できない',
        async (path) => {
            const token = await sign(
                { event_id: id, exp: Math.floor(Date.now() / 1000) + 60 },
                env.JWT_SECRET,
            );
            for (const method of ['POST', 'PUT', 'DELETE']) {
                const res = await app.request(
                    `/api/${path}${method === 'POST' ? '' : `/${id}`}`,
                    {
                        method,
                        headers: {
                            Cookie: `access_token=${token}`,
                            'x-event-id': id,
                            'Content-Type': 'application/json',
                        },
                        body: '{}',
                    },
                    env,
                );
                expect(res.status).toBe(401);
            }
        },
    );
});
