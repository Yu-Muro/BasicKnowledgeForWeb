import type { Env, PublicAuthRateLimiter } from '@backend/src/db/connection';
import type { IAccessCodeRepository } from '@backend/src/infrastructure/repositories/access-code/IAccessCodeRepository';
import type { IUserRepository } from '@backend/src/infrastructure/repositories/user/IUserRepository';
import { createAccessCodeRoutes } from '@backend/src/presentation/routes/accessCodeRoutes';
import { createAuthRoutes } from '@backend/src/presentation/routes/authRoutes';
import { createUserRoutes } from '@backend/src/presentation/routes/userRoutes';
import { describe, expect, it, jest } from '@jest/globals';
import { Hono } from 'hono';

function setup() {
    const userFactory = jest.fn<(env: Env) => IUserRepository>();
    const accessFactory = jest.fn<(env: Env) => IAccessCodeRepository>();
    const app = new Hono<{ Bindings: Env }>();
    app.route('/api', createAuthRoutes(userFactory));
    app.route('/api', createUserRoutes(userFactory));
    app.route('/api', createAccessCodeRoutes(accessFactory));
    return { app, userFactory, accessFactory };
}

const routes = [
    ['/api/auth/login', 'login'],
    ['/api/access-codes/verify', 'verify'],
    ['/api/users', 'register'],
] as const;
const request = (body = {}, ip: string | undefined = '192.0.2.1') => ({
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        ...(ip ? { 'CF-Connecting-IP': ip } : {}),
    },
    body: JSON.stringify(body),
});
const env = (limiter?: PublicAuthRateLimiter, enabled = 'true') =>
    ({
        PUBLIC_AUTH_RATE_LIMIT_ENABLED: enabled,
        PUBLIC_AUTH_RATE_LIMITER: limiter,
    }) as Env;

describe.each(routes)('%s の試行回数制限', (path, operation) => {
    it('超過時は入力検証・DB生成前に429を返す', async () => {
        const { app, userFactory, accessFactory } = setup();
        const limit = jest
            .fn<PublicAuthRateLimiter['limit']>()
            .mockResolvedValue({ success: false });
        const res = await app.request(path, request(), env({ limit }));
        expect(res.status).toBe(429);
        expect(res.headers.get('Retry-After')).toBe('60');
        expect(res.headers.get('Cache-Control')).toBe('no-store');
        expect(limit).toHaveBeenCalledWith({ key: `${operation}:192.0.2.1` });
        expect(userFactory).not.toHaveBeenCalled();
        expect(accessFactory).not.toHaveBeenCalled();
    });
    it('許可された要求は既存の入力検証へ進む', async () => {
        const { app } = setup();
        const limit = jest
            .fn<PublicAuthRateLimiter['limit']>()
            .mockResolvedValue({ success: true });
        expect(
            (await app.request(path, request(), env({ limit }))).status,
        ).toBe(400);
        expect(limit).toHaveBeenCalledTimes(1);
    });
    it('入力を変えても同じ送信元は同じキーで数える', async () => {
        const { app } = setup();
        const limit = jest
            .fn<PublicAuthRateLimiter['limit']>()
            .mockResolvedValue({ success: false });
        for (const value of ['one', 'two']) {
            await app.request(
                path,
                request({ code: value, email: `${value}@example.com` }),
                env({ limit }),
            );
        }
        expect(limit.mock.calls.map(([options]) => options.key)).toEqual([
            `${operation}:192.0.2.1`,
            `${operation}:192.0.2.1`,
        ]);
    });
    it('送信元が異なる要求は別のキーで数える', async () => {
        const { app } = setup();
        const limit = jest
            .fn<PublicAuthRateLimiter['limit']>()
            .mockResolvedValue({ success: false });
        for (const ip of ['192.0.2.1', '192.0.2.2']) {
            await app.request(path, request({}, ip), env({ limit }));
        }
        expect(limit.mock.calls.map(([options]) => options.key)).toEqual([
            `${operation}:192.0.2.1`,
            `${operation}:192.0.2.2`,
        ]);
    });
    it('IPv6の同一/64と表記揺れは同じキー、別/64は別キーになる', async () => {
        const { app } = setup();
        const limit = jest
            .fn<PublicAuthRateLimiter['limit']>()
            .mockResolvedValue({ success: false });
        for (const ip of [
            '2001:DB8:1234:5678::1',
            '2001:0db8:1234:5678:abcd:ef01:2345:6789',
            '2001:db8:1234:5679::1',
        ]) {
            expect(
                (await app.request(path, request({}, ip), env({ limit })))
                    .status,
            ).toBe(429);
        }
        expect(limit.mock.calls.map(([options]) => options.key)).toEqual([
            `${operation}:2001:0db8:1234:5678::/64`,
            `${operation}:2001:0db8:1234:5678::/64`,
            `${operation}:2001:0db8:1234:5679::/64`,
        ]);
    });
    it('無効な環境はバインディングなしで既存の入力検証へ進む', async () => {
        const { app } = setup();
        expect(
            (await app.request(path, request(), env(undefined, 'false')))
                .status,
        ).toBe(400);
        expect((await app.request(path, request(), {} as Env)).status).toBe(
            400,
        );
    });
    it('有効なのにバインディングがない場合は503で止める', async () => {
        const { app, userFactory, accessFactory } = setup();
        expect((await app.request(path, request(), env())).status).toBe(503);
        expect(userFactory).not.toHaveBeenCalled();
        expect(accessFactory).not.toHaveBeenCalled();
    });
    it('Cloudflareの送信元ヘッダーがない場合は転送ヘッダーを信用しない', async () => {
        const { app } = setup();
        const limit = jest.fn<PublicAuthRateLimiter['limit']>();
        const init = request({}, '');
        const res = await app.request(
            path,
            {
                ...init,
                headers: { ...init.headers, 'X-Forwarded-For': '192.0.2.1' },
            },
            env({ limit }),
        );
        expect(res.status).toBe(503);
        expect(limit).not.toHaveBeenCalled();
    });
    it('リミッタ障害時は内部エラーを露出せず503で止める', async () => {
        const { app, userFactory, accessFactory } = setup();
        const limit = jest
            .fn<PublicAuthRateLimiter['limit']>()
            .mockRejectedValue(new Error('private details'));
        const res = await app.request(path, request(), env({ limit }));
        expect(res.status).toBe(503);
        expect(await res.text()).not.toContain('private details');
        expect(userFactory).not.toHaveBeenCalled();
        expect(accessFactory).not.toHaveBeenCalled();
    });
});
