import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { hash } from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/cockroach';
import { Hono } from 'hono';
import { sign } from 'hono/jwt';
import { Pool } from 'pg';
import type { Env } from '../src/db/connection';
import {
    authAccounts,
    authRateLimits,
    authSessions,
    departments,
    users,
} from '../src/db/schema';
import { BetterAuthRepository } from '../src/infrastructure/repositories/auth/BetterAuthRepository';
import { DepartmentRepository } from '../src/infrastructure/repositories/departments/DepartmentRepository';
import { UserRepository } from '../src/infrastructure/repositories/user/UserRepository';
import { contentAccessMiddleware } from '../src/presentation/middleware/contentAccessMiddleware';
import { createAuthRoutes } from '../src/presentation/routes/authRoutes';
import { csrfProtection } from '../src/presentation/routes/csrfProtection';
import { createSessionValidation } from '../src/presentation/routes/sessionValidation';
import { createUserRoutes } from '../src/presentation/routes/userRoutes';

// This script requires a dedicated, migrated test DB; it never reads .env.
if (!process.env.AUTH_TEST_DATABASE_URL)
    throw new Error('専用テストDBの AUTH_TEST_DATABASE_URL が必要です');
const pool = new Pool({
    connectionString: process.env.AUTH_TEST_DATABASE_URL,
    max: 2,
});
const db = drizzle({ client: pool });
const repo = new UserRepository(db);
const departmentId = randomUUID();
const userId = randomUUID();
const email = `auth-${userId}@example.com`;
const password = 'existing-password-123';
const env = {
    JWT_SECRET: 'event-only-test-secret',
    BETTER_AUTH_SECRET: 'integration-test-only-secret-at-least-32-characters',
    BETTER_AUTH_URL: 'http://localhost:8080',
} as Env;
const authentication = new BetterAuthRepository(db, {
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
});
const app = new Hono<{ Bindings: Env }>();
app.use('/api/*', csrfProtection);
app.use(
    '/api/*',
    createSessionValidation(
        () => repo,
        async () => authentication,
    ),
);
app.route(
    '/api',
    createAuthRoutes(
        () => repo,
        async () => authentication,
    ),
);
app.route(
    '/api',
    createUserRoutes(
        () => repo,
        () => new DepartmentRepository(db),
    ),
);
app.get('/api/timetable', contentAccessMiddleware, (c) =>
    c.json({ items: [] }),
);
const registeredIds: string[] = [];
let requestNumber = 1;
function request(
    path: string,
    method = 'GET',
    cookie = '',
    body?: object,
    ip?: string,
) {
    return app.request(
        path,
        {
            method,
            headers: {
                Origin: 'http://localhost:8771',
                'Content-Type': 'application/json',
                Cookie: cookie,
                'cf-connecting-ip': ip ?? `192.0.2.${requestNumber++}`,
            },
            ...(body ? { body: JSON.stringify(body) } : {}),
        },
        env,
    );
}
function cookies(response: Response) {
    return response.headers
        .getSetCookie()
        .map((cookie) => cookie.split(';')[0])
        .join('; ');
}
async function login(p = password, ip?: string) {
    return request('/api/auth/login', 'POST', '', { email, password: p }, ip);
}
try {
    await db
        .insert(departments)
        .values({ id: departmentId, name: `認証検証-${departmentId}` });
    // A pre-migration bcrypt user has no Better Auth account yet.
    await db.insert(users).values({
        id: userId,
        name: '移行検証',
        email,
        password: await hash(password, 1),
        role: 'admin',
    });
    const first = await login();
    assert.equal(first.status, 200, await first.clone().text());
    const secureAuth = new BetterAuthRepository(db, {
        secret: env.BETTER_AUTH_SECRET,
        baseURL: 'https://dev.reitaisai.info',
    });
    const secureResponse = await secureAuth.signIn(
        email,
        password,
        new Headers({
            Origin: 'https://dev.reitaisai.info',
            'cf-connecting-ip': '192.0.2.200',
        }),
    );
    assert.equal(secureResponse.status, 200);
    const secureCookie = secureResponse.headers
        .getSetCookie()
        .find((cookie) => cookie.startsWith('auth_token='));
    assert.ok(secureCookie);
    assert.match(secureCookie, /; Secure/i);
    assert.match(secureCookie, /; HttpOnly/i);
    assert.match(secureCookie, /; SameSite=Lax/i);
    const expiredCookie = cookies(await login());
    const expiredSessionId = await authentication.getSessionUserId(
        new Headers({ Cookie: expiredCookie }),
    );
    assert.equal(expiredSessionId, userId);
    await db
        .update(authSessions)
        .set({ expiresAt: new Date(Date.now() - 1000) })
        .where(eq(authSessions.userId, userId));
    assert.equal(
        (await request('/api/auth/me', 'GET', expiredCookie)).status,
        401,
    );
    const refreshed = await login();
    assert.equal(refreshed.status, 200);
    const firstCookie = cookies(refreshed);
    assert.match(firstCookie, /auth_token=/);
    assert.equal(
        (await request('/api/auth/me', 'GET', firstCookie)).status,
        200,
    );
    assert.equal((await login('wrong-password')).status, 401);
    const oldJWT = await sign(
        {
            id: userId,
            role: 'admin',
            exp: Math.floor(Date.now() / 1000) + 3600,
        },
        env.JWT_SECRET,
    );
    assert.equal(
        (await request('/api/auth/me', 'GET', `auth_token=${oldJWT}`)).status,
        401,
    );
    const logout = await request('/api/auth/logout', 'POST', firstCookie, {});
    assert.equal(logout.status, 200);
    assert.equal(
        (await request('/api/auth/me', 'GET', firstCookie)).status,
        401,
    );
    const secondCookie = cookies(await login());
    const thirdCookie = cookies(await login());
    const changed = await request('/api/auth/password', 'PUT', secondCookie, {
        currentPassword: password,
        newPassword: 'updated-password-123',
    });
    assert.equal(changed.status, 200, await changed.clone().text());
    assert.equal(
        (await request('/api/auth/me', 'GET', secondCookie)).status,
        401,
    );
    assert.equal(
        (await request('/api/auth/me', 'GET', thirdCookie)).status,
        401,
    );
    assert.equal((await login()).status, 401);
    const updated = await login('updated-password-123');
    assert.equal(updated.status, 200);
    const active = cookies(updated);
    await repo.updateRole(userId, 'user', departmentId);
    assert.equal((await request('/api/users', 'GET', active)).status, 403);
    assert.equal((await request('/api/timetable', 'GET', active)).status, 401);
    const me = await request('/api/auth/me', 'GET', active);
    assert.equal(
        ((await me.json()) as { departmentId: string }).departmentId,
        departmentId,
    );
    await db
        .update(users)
        .set({ departmentId: null })
        .where(eq(users.id, userId));
    assert.equal((await request('/api/auth/me', 'GET', active)).status, 403);
    assert.equal((await login('updated-password-123')).status, 403);
    await repo.softDelete(userId);
    assert.equal((await request('/api/auth/me', 'GET', active)).status, 401);
    assert.equal((await login('updated-password-123')).status, 401);
    const eventId = randomUUID();
    const access = await sign(
        { event_id: eventId, exp: Math.floor(Date.now() / 1000) + 3600 },
        env.JWT_SECRET,
    );
    const content = await app.request(
        '/api/timetable',
        {
            headers: {
                Cookie: `${active}; access_token=${access}`,
                'x-event-id': eventId,
            },
        },
        env,
    );
    assert.equal(content.status, 200);
    const registeredEmail = `new-${userId}@example.com`;
    const registered = await request('/api/users', 'POST', '', {
        name: '新規検証',
        email: registeredEmail.toUpperCase(),
        password,
        departmentId,
    });
    assert.equal(registered.status, 201, await registered.clone().text());
    const newUser = (await registered.json()) as {
        user: { id: string; email: string };
    };
    registeredIds.push(newUser.user.id);
    assert.equal(newUser.user.email, registeredEmail);
    assert.equal(
        (
            await request('/api/auth/login', 'POST', '', {
                email: registeredEmail,
                password,
            })
        ).status,
        200,
    );
    const csrf = await app.request(
        '/api/auth/password',
        {
            method: 'PUT',
            headers: { Origin: 'https://attacker.example', Cookie: active },
        },
        env,
    );
    assert.equal(csrf.status, 403);
    // No public Better Auth signup/update-user endpoints bypass the domain rules.
    assert.equal(
        (await request('/api/auth/sign-up/email', 'POST', '', {})).status,
        404,
    );
    let limited = false;
    for (let attempt = 0; attempt < 12; attempt++)
        if ((await login('wrong-password', '203.0.113.45')).status === 429)
            limited = true;
    assert.ok(limited, 'DBレート制限で429を返す');
    console.log(
        'Better Auth: bcrypt移行・新規登録・旧JWT拒否・ログアウト・全セッション失効・部署/RBAC・削除・会期アクセス・CSRF・DBレート制限を確認しました',
    );
} finally {
    for (const id of [userId, ...registeredIds]) {
        await db.delete(authSessions).where(eq(authSessions.userId, id));
        await db.delete(authAccounts).where(eq(authAccounts.userId, id));
        await db.delete(users).where(eq(users.id, id));
    }
    await db.delete(departments).where(eq(departments.id, departmentId));
    // The dedicated test DB contains only these fixtures.
    await db.delete(authRateLimits);
    await pool.end();
}
