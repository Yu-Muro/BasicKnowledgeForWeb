import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('next/headers', () => ({ cookies: jest.fn() }));
jest.mock('@frontend/app/lib/backendFetch', () => ({
    fetchFromBackend: jest.fn(),
    buildBackendUrl: (url: string) => url,
}));
const { cookies } = require('next/headers') as typeof import('next/headers');
const { fetchFromBackend } =
    require('@frontend/app/lib/backendFetch') as typeof import('@frontend/app/lib/backendFetch');
const { restoreUserAction } =
    require('@frontend/app/actions/dashboard') as typeof import('@frontend/app/actions/dashboard');
beforeEach(() => {
    jest.resetAllMocks();
    jest.mocked(cookies).mockResolvedValue({
        get: () => ({ value: 'admin-token' }),
    } as unknown as Awaited<ReturnType<typeof cookies>>);
});
describe('restoreUserAction', () => {
    it('部署と認証Cookieを復元APIへ送る', async () => {
        jest.mocked(fetchFromBackend).mockResolvedValue(
            new Response('{}', { status: 200 }),
        );
        expect(await restoreUserAction('user-id', 'department-id')).toEqual({
            success: true,
        });
        expect(fetchFromBackend).toHaveBeenCalledWith(
            '/api/users/user-id/restore',
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ departmentId: 'department-id' }),
                headers: expect.objectContaining({
                    Cookie: 'auth_token=admin-token',
                }),
            }),
        );
    });
    it('未認証では呼び出さない', async () => {
        jest.mocked(cookies).mockResolvedValue({
            get: () => undefined,
        } as unknown as Awaited<ReturnType<typeof cookies>>);
        expect(await restoreUserAction('user-id')).toMatchObject({
            success: false,
        });
        expect(fetchFromBackend).not.toHaveBeenCalled();
    });
    it('APIのエラーを返す', async () => {
        jest.mocked(fetchFromBackend).mockResolvedValue(
            new Response(JSON.stringify({ error: '部署が必要です' }), {
                status: 400,
            }),
        );
        expect(await restoreUserAction('user-id')).toEqual({
            success: false,
            error: '部署が必要です',
        });
    });
    it('接続失敗時はエラーを返す', async () => {
        jest.mocked(fetchFromBackend).mockRejectedValue(new Error('offline'));
        expect(await restoreUserAction('user-id')).toEqual({
            success: false,
            error: 'ユーザーの復元に失敗しました',
        });
    });
});
