import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('next/headers', () => ({ cookies: jest.fn() }));
jest.mock('next/navigation', () => ({
    redirect: jest.fn((path: string) => {
        throw new Error(`redirect:${path}`);
    }),
}));
jest.mock('@frontend/app/lib/backendFetch', () => ({
    fetchFromBackend: jest.fn(),
    buildBackendUrl: (path: string) => `https://dev.reitaisai.info${path}`,
}));
const { cookies } = require('next/headers') as typeof import('next/headers');
const { fetchFromBackend } =
    require('@frontend/app/lib/backendFetch') as typeof import('@frontend/app/lib/backendFetch');
const { logoutAction } =
    require('@frontend/app/actions/auth') as typeof import('@frontend/app/actions/auth');
const deleted = jest.fn();
function cookieStore(token?: string) {
    jest.mocked(cookies).mockResolvedValue({
        get: (name: string) =>
            name === 'auth_token' && token ? { value: token } : undefined,
        delete: deleted,
    } as unknown as Awaited<ReturnType<typeof cookies>>);
}
beforeEach(() => {
    jest.clearAllMocks();
});
describe('サーバー側セッションを失効させるログアウト', () => {
    it('不透明なセッションをBackendで失効させてからCookieを削除する', async () => {
        cookieStore('opaque-session');
        jest.mocked(fetchFromBackend).mockResolvedValue(new Response('{}'));
        await expect(logoutAction()).rejects.toThrow('redirect:/login');
        expect(fetchFromBackend).toHaveBeenCalledWith(
            '/api/auth/logout',
            expect.objectContaining({
                method: 'POST',
                headers: {
                    Cookie: 'auth_token=opaque-session',
                    Origin: 'https://dev.reitaisai.info',
                },
            }),
        );
        expect(deleted).toHaveBeenCalledWith('auth_token');
        expect(deleted).toHaveBeenCalledWith('access_token');
    });
    it('失効APIに失敗した場合はログアウト完了として扱わない', async () => {
        cookieStore('opaque-session');
        jest.mocked(fetchFromBackend).mockResolvedValue(
            new Response('{}', { status: 503 }),
        );
        await expect(logoutAction()).rejects.toThrow(
            'ログアウトに失敗しました',
        );
        expect(deleted).not.toHaveBeenCalled();
    });
    it('会期アクセスだけの場合はユーザー認証APIを呼ばない', async () => {
        cookieStore();
        await expect(logoutAction()).rejects.toThrow('redirect:/access');
        expect(fetchFromBackend).not.toHaveBeenCalled();
    });
});
