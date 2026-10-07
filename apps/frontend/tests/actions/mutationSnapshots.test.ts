import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('next/headers', () => ({ cookies: jest.fn() }));
jest.mock('@frontend/app/lib/backendFetch', () => ({
    fetchFromBackend: jest.fn(),
    buildBackendUrl: (url: string) => url,
}));
const { cookies } = require('next/headers') as typeof import('next/headers');
const { fetchFromBackend } =
    require('@frontend/app/lib/backendFetch') as typeof import('@frontend/app/lib/backendFetch');
beforeEach(() => {
    jest.resetAllMocks();
    jest.mocked(cookies).mockResolvedValue({
        get: () => ({ value: 'admin-token' }),
    } as unknown as Awaited<ReturnType<typeof cookies>>);
});
describe('更新後の一覧取得失敗', () => {
    const dashboard =
        require('@frontend/app/actions/dashboard') as typeof import('@frontend/app/actions/dashboard');
    const departments =
        require('@frontend/app/actions/departments') as typeof import('@frontend/app/actions/departments');
    const mutations = [
        ['ロール', () => dashboard.updateUserRoleAction('user-id', 'admin')],
        [
            '所属',
            () =>
                dashboard.updateUserDepartmentAction(
                    'user-id',
                    'department-id',
                ),
        ],
        ['ユーザー削除', () => dashboard.deleteUserAction('user-id')],
        [
            '部署作成',
            () => departments.createDepartmentAction({ name: '企画部' }),
        ],
        [
            '部署更新',
            () =>
                departments.updateDepartmentAction('department-id', {
                    name: '総務部',
                }),
        ],
        ['部署削除', () => departments.deleteDepartmentAction('department-id')],
    ] as const;
    it.each(
        mutations.flatMap(([name, action]) =>
            ['offline', 'status', 'payload'].map((failure) => ({
                name,
                action,
                failure,
            })),
        ),
    )(
        '$name / $failure は更新成功と再取得エラーを区別する',
        async ({ action, failure }) => {
            const mocked = jest
                .mocked(fetchFromBackend)
                .mockResolvedValueOnce(new Response('{}', { status: 200 }));
            if (failure === 'offline')
                mocked.mockRejectedValueOnce(new Error('offline'));
            else
                mocked.mockResolvedValueOnce(
                    new Response('{}', {
                        status: failure === 'status' ? 503 : 200,
                    }),
                );
            expect(await action()).toMatchObject({
                success: true,
                warning: expect.stringContaining('一覧を再取得'),
            });
            expect(fetchFromBackend).toHaveBeenCalledTimes(2);
        },
    );
});
