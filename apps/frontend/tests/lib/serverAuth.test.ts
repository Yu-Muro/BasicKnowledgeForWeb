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
    it('古い管理者トークンでも現在の部署スタッフ権限と部署を使う', async () => {
        const auth = 'opaque-session';
        setCookies({ auth_token: auth });
        mockFetch.mockResolvedValue(new Response(JSON.stringify(me)));
        const result = await resolveAuth('event-1');
        expect(result.role).toBe('user');
        expect(result.user?.departmentId).toBe('dept-2');
        expect(result.eventId).toBe('event-1');
    });
    it('削除されたユーザーは有効な古いトークンでも未認証になる', async () => {
        setCookies({ auth_token: jwt({ ...me, role: 'admin' }) });
        mockFetch.mockResolvedValue(new Response('{}', { status: 401 }));
        const result = await resolveAuth();
        expect(result.authToken).toBeNull();
        expect(result.role).toBe('viewer');
    });
    it('所属未設定を拒否した場合はログイン済みとして扱わない', async () => {
        setCookies({ auth_token: jwt(me) });
        mockFetch.mockResolvedValue(new Response('{}', { status: 403 }));
        expect((await resolveAuth()).authToken).toBeNull();
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
        expect((await resolveAuth()).role).toBe('viewer');
    });
});

it('セッション文字列をJWTとしてデコードせずBackendで検証する', async () => {
    setCookies({ auth_token: 'opaque-session-no-jwt-payload' });
    mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ ...me, role: 'admin' })),
    );
    const result = await resolveAuth('event-1');
    expect(result.authToken).toBe('opaque-session-no-jwt-payload');
    expect(result.role).toBe('admin');
    expect(mockFetch).toHaveBeenCalledWith(
        '/api/auth/me',
        expect.objectContaining({
            headers: { Cookie: 'auth_token=opaque-session-no-jwt-payload' },
            cache: 'no-store',
        }),
    );
});
