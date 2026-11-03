import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react';

jest.mock('@frontend/app/lib/backendFetch', () => ({
    fetchFromBackend: jest.fn(),
}));
jest.mock('@frontend/app/lib/serverAuth', () => ({ resolveAuth: jest.fn() }));
jest.mock('next/navigation', () => ({
    redirect: jest.fn((url: string) => {
        throw new Error(`redirect:${url}`);
    }),
}));
jest.mock(
    '@frontend/app/(authenticated)/departments/DepartmentAdminPanel',
    () => ({ __esModule: true, default: () => <div>部署管理</div> }),
);
const { fetchFromBackend } =
    require('@frontend/app/lib/backendFetch') as typeof import('@frontend/app/lib/backendFetch');
const { resolveAuth } =
    require('@frontend/app/lib/serverAuth') as typeof import('@frontend/app/lib/serverAuth');
const Page = require('@frontend/app/(authenticated)/departments/page')
    .default as typeof import('@frontend/app/(authenticated)/departments/page').default;
beforeEach(() => {
    jest.resetAllMocks();
    jest.mocked(resolveAuth).mockResolvedValue({
        role: 'admin',
        authToken: 'token',
        accessToken: null,
        eventId: null,
    });
});
describe('部署一覧の読み込み', () => {
    it('接続例外を画面の取得エラーにする', async () => {
        jest.mocked(fetchFromBackend).mockRejectedValue(new Error('offline'));
        render(await Page());
        expect(screen.getByRole('alert')).toHaveTextContent(
            '部署一覧を取得できませんでした',
        );
    });
    it('HTTPエラーも同じ取得エラーにする', async () => {
        jest.mocked(fetchFromBackend).mockResolvedValue(
            new Response('{}', { status: 503 }),
        );
        render(await Page());
        expect(screen.getByRole('alert')).toHaveTextContent(
            '部署一覧を取得できませんでした',
        );
    });
    it('正常に読み込めれば部署管理を表示する', async () => {
        jest.mocked(fetchFromBackend).mockResolvedValue(
            new Response(JSON.stringify({ departments: [] })),
        );
        render(await Page());
        expect(screen.getByText('部署管理')).toBeInTheDocument();
    });
});
