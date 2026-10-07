import { beforeEach, describe, expect, it, jest } from '@jest/globals';
jest.mock('next/headers', () => ({ cookies: jest.fn() }));
jest.mock('@frontend/app/lib/backendFetch', () => ({
    fetchFromBackend: jest.fn(),
}));
const { cookies } = require('next/headers') as typeof import('next/headers');
const { fetchFromBackend } =
    require('@frontend/app/lib/backendFetch') as typeof import('@frontend/app/lib/backendFetch');
const { resolveAuth } =
    require('@frontend/app/lib/serverAuth') as typeof import('@frontend/app/lib/serverAuth');
const mockFetch = jest.mocked(fetchFromBackend);
const me = {
    id: 'user-1',
    name: 'スタッフ',
    email: 'staff@test.com',
    role: 'user',
    departmentId: 'dept-2',
};
function jwt(payload: object) {
    return `header.${Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.signature`;
}
function setCookies(values: Record<string, string>) {
    jest.mocked(cookies).mockResolvedValue({
        get: (name: string) =>
            values[name] ? { name, value: values[name] } : undefined,
    } as Awaited<ReturnType<typeof cookies>>);
}
beforeEach(() => {
    jest.resetAllMocks();
});
describe('現在のロールと所属を使った認証情報', () => {
    it('古い管理者トークンでも現在の一般ユーザー権限と部署を使う', async () => {
        const auth = jwt({ ...me, role: 'admin', departmentId: 'dept-1' });
        setCookies({ auth_token: auth });
        mockFetch.mockResolvedValue(new Response(JSON.stringify(me)));
        const result = await resolveAuth('event-1');
        expect(result.role).toBe('user');
        expect(result.user?.departmentId).toBe('dept-2');
        expect(result.eventId).toBeNull();
    });
    it('削除されたユーザーは有効な古いトークンでも未認証になる', async () => {
        setCookies({ auth_token: jwt({ ...me, role: 'admin' }) });
        mockFetch.mockResolvedValue(new Response('{}', { status: 401 }));
        const result = await resolveAuth();
        expect(result.authToken).toBeNull();
        expect(result.role).toBe('user');
    });
    it('所属未設定を拒否した場合はログイン済みとして扱わない', async () => {
        setCookies({ auth_token: jwt(me) });
        mockFetch.mockResolvedValue(new Response('{}', { status: 403 }));
        await expect(resolveAuth()).rejects.toMatchObject({ status: 403 });
    });
    it('会期閲覧トークンはユーザー削除後も従来通り独立して解決する', async () => {
        setCookies({
            auth_token: jwt(me),
            access_token: jwt({ event_id: 'event-1' }),
        });
        mockFetch.mockResolvedValue(new Response('{}', { status: 401 }));
        const result = await resolveAuth();
        expect(result.authToken).toBeNull();
        expect(result.eventId).toBe('event-1');
    });
    it('APIに接続できない場合に古い管理者権限へ戻さない', async () => {
        setCookies({ auth_token: jwt({ ...me, role: 'admin' }) });
        mockFetch.mockRejectedValue(new Error('offline'));
        await expect(resolveAuth()).rejects.toMatchObject({ status: 503 });
    });
    it.each([500, 503])(
        '認証サービスの%sをセッション無効と区別する',
        async (status) => {
            setCookies({ auth_token: jwt({ ...me, role: 'admin' }) });
            mockFetch.mockResolvedValue(new Response('{}', { status }));
            await expect(resolveAuth()).rejects.toMatchObject({ status: 503 });
        },
    );
    it('認証確認に失敗しても有効な会期閲覧は明示的に継続できる', async () => {
        setCookies({
            auth_token: jwt({ ...me, role: 'admin' }),
            access_token: jwt({ event_id: 'event-1' }),
        });
        mockFetch.mockImplementation(
            async () => new Response('{}', { status: 503 }),
        );
        const result = await resolveAuth(undefined, {
            allowAccessFallback: true,
        });
        expect(result).toMatchObject({
            role: 'user',
            authToken: null,
            eventId: 'event-1',
        });
        await expect(resolveAuth()).rejects.toMatchObject({ status: 503 });
    });
    it('会期トークンなしでは確認失敗を閲覧権限として扱わない', async () => {
        setCookies({ auth_token: jwt({ ...me, role: 'admin' }) });
        mockFetch.mockResolvedValue(new Response('{}', { status: 503 }));
        await expect(
            resolveAuth(undefined, { allowAccessFallback: true }),
        ).rejects.toMatchObject({ status: 503 });
    });
});
