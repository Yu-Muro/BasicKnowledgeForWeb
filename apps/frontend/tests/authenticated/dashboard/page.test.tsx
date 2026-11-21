import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react';

// decodeJwtPayload は実装を残し、resolveAuth のみモックする
jest.mock('@frontend/app/lib/serverAuth', () => ({
    ...jest.requireActual('@frontend/app/lib/serverAuth'),
    resolveAuth: jest.fn(),
}));

jest.mock('next/navigation', () => ({
    useRouter: () => ({
        refresh: jest.fn(),
        prefetch: jest.fn(),
        push: jest.fn(),
        replace: jest.fn(),
        back: jest.fn(),
        forward: jest.fn(),
    }),
    redirect: jest.fn().mockImplementation((url: string) => {
        throw new Error(`NEXT_REDIRECT:${url}`);
    }),
}));

jest.mock('@frontend/app/actions/dashboard', () => ({
    changePasswordAction: jest.fn(),
    updateUserRoleAction: jest.fn(),
}));

const serverAuth =
    require('@frontend/app/lib/serverAuth') as typeof import('@frontend/app/lib/serverAuth');
const navigation =
    require('next/navigation') as { redirect: ReturnType<typeof jest.fn> };
const DashboardPage =
    require('@frontend/app/(authenticated)/dashboard/page')
        .default as typeof import('@frontend/app/(authenticated)/dashboard/page').default;

const mockResolveAuth = jest.mocked(serverAuth.resolveAuth);
const mockRedirect = navigation.redirect as ReturnType<typeof jest.fn>;

const buildPageProps = (params?: { event_id?: string }) => ({
    searchParams: Promise.resolve(params ?? {}),
});

// テスト用の偽 JWT を生成（decodeJwtPayload が payload を取得できる形式）
function createMockJwt(payload: object): string {
    const json = JSON.stringify(payload);
    const base64url = Buffer.from(json)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
    return `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${base64url}.fakesignature`;
}

const MOCK_USER_PAYLOAD = {
    id: 'user-1',
    name: '山田太郎',
    email: 'yamada@example.com',
    role: 'user',
    exp: Math.floor(Date.now() / 1000) + 3600,
};

const MOCK_ADMIN_PAYLOAD = {
    id: 'admin-1',
    name: '管理者A',
    email: 'admin@example.com',
    role: 'admin',
    exp: Math.floor(Date.now() / 1000) + 3600,
};

const MOCK_USERS = [
    { id: 'user-1', name: '山田太郎', email: 'yamada@example.com', role: 'user' },
    { id: 'admin-1', name: '管理者A', email: 'admin@example.com', role: 'admin' },
];

const originalFetch = global.fetch;

beforeEach(() => {
    jest.resetAllMocks();
    mockRedirect.mockImplementation((url: string) => {
        throw new Error(`NEXT_REDIRECT:${url}`);
    });
});

afterEach(() => {
    global.fetch = originalFetch;
});

describe('DashboardPage', () => {
    it('authToken がない場合 /login にリダイレクトする', async () => {
        mockResolveAuth.mockResolvedValue({
            authToken: null,
            accessToken: null,
            eventId: null,
            role: 'user',
        });

        await expect(DashboardPage(buildPageProps())).rejects.toThrow(
            'NEXT_REDIRECT:/login',
        );
    });

    it('JWT が不正な場合 /login にリダイレクトする', async () => {
        mockResolveAuth.mockResolvedValue({
            authToken: 'invalid-not-a-jwt',
            accessToken: null,
            eventId: null,
            role: 'user',
        });

        await expect(DashboardPage(buildPageProps())).rejects.toThrow(
            'NEXT_REDIRECT:/login',
        );
    });

    it('プロフィール情報（名前・メール・ロール）を表示する', async () => {
        mockResolveAuth.mockResolvedValue({
            authToken: createMockJwt(MOCK_USER_PAYLOAD),
            accessToken: null,
            eventId: null,
            role: 'user',
        });

        const element = await DashboardPage(buildPageProps());
        render(element);

        expect(screen.getByText('山田太郎')).toBeInTheDocument();
        expect(screen.getByText('yamada@example.com')).toBeInTheDocument();
        expect(screen.getByText('スタッフ')).toBeInTheDocument();
    });

    it('パスワード変更フォームを表示する', async () => {
        mockResolveAuth.mockResolvedValue({
            authToken: createMockJwt(MOCK_USER_PAYLOAD),
            accessToken: null,
            eventId: null,
            role: 'user',
        });

        const element = await DashboardPage(buildPageProps());
        render(element);

        expect(screen.getByLabelText('現在のパスワード')).toBeInTheDocument();
        expect(screen.getByLabelText('新しいパスワード')).toBeInTheDocument();
        expect(screen.getByLabelText('確認')).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: '変更する' }),
        ).toBeInTheDocument();
    });

    it('user ロール時にユーザー管理・管理メニューが表示されない', async () => {
        mockResolveAuth.mockResolvedValue({
            authToken: createMockJwt(MOCK_USER_PAYLOAD),
            accessToken: null,
            eventId: null,
            role: 'user',
        });

        const element = await DashboardPage(buildPageProps());
        render(element);

        expect(screen.queryByText('ユーザー管理')).not.toBeInTheDocument();
        expect(screen.queryByText('削除済みユーザー')).not.toBeInTheDocument();
        expect(screen.queryByText('管理メニュー')).not.toBeInTheDocument();
        expect(
            screen.queryByText('アクセスコード管理 →'),
        ).not.toBeInTheDocument();
    });

    it('admin ロール時にユーザー管理と管理メニューが表示される', async () => {
        mockResolveAuth.mockResolvedValue({
            authToken: createMockJwt(MOCK_ADMIN_PAYLOAD),
            accessToken: null,
            eventId: null,
            role: 'admin',
        });
        global.fetch = jest.fn<typeof fetch>().mockResolvedValue(
            new Response(JSON.stringify({ users: MOCK_USERS }), {
                status: 200,
            }),
        );

        const element = await DashboardPage(buildPageProps());
        render(element);

        expect(screen.getByText('ユーザー管理')).toBeInTheDocument();
        expect(screen.getByText('削除済みユーザー')).toBeInTheDocument();
        expect(screen.getByText('管理メニュー')).toBeInTheDocument();
        expect(
            screen.getByText('アクセスコード管理 →'),
        ).toBeInTheDocument();
    });

    it('admin ロール時にユーザー一覧を表示する', async () => {
        mockResolveAuth.mockResolvedValue({
            authToken: createMockJwt(MOCK_ADMIN_PAYLOAD),
            accessToken: null,
            eventId: null,
            role: 'admin',
        });
        global.fetch = jest.fn<typeof fetch>().mockResolvedValue(
            new Response(JSON.stringify({ users: MOCK_USERS }), {
                status: 200,
            }),
        );

        const element = await DashboardPage(buildPageProps());
        render(element);

        expect(screen.getAllByText('山田太郎').length).toBeGreaterThan(0);
        expect(screen.getAllByText('管理者A').length).toBeGreaterThan(0);
        expect(screen.getAllByText('admin@example.com').length).toBeGreaterThan(0);
    });
});
