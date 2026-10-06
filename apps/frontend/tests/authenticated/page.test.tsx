import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('next/link', () => {
    const Link = ({
        href,
        children,
        ...props
    }: {
        href: string;
        children: React.ReactNode;
        [key: string]: unknown;
    }) => (
        <a href={href} {...props}>
            {children}
        </a>
    );
    Link.displayName = 'Link';
    return Link;
});

jest.mock('@frontend/app/lib/serverAuth', () => ({
    resolveAuth: jest.fn(),
    buildContentFetchHeaders: jest.fn(),
}));

const serverAuth =
    require('@frontend/app/lib/serverAuth') as typeof import('@frontend/app/lib/serverAuth');
const HomePage = require('@frontend/app/(authenticated)/page')
    .default as typeof import('@frontend/app/(authenticated)/page').default;

const mockResolveAuth = jest.mocked(serverAuth.resolveAuth);
const mockBuildHeaders = jest.mocked(serverAuth.buildContentFetchHeaders);

const USER_AUTH: serverAuth.ResolvedAuth = {
    eventId: 'event-1',
    authToken: null,
    accessToken: 'access-token',
    role: 'viewer',
};

const ADMIN_AUTH: serverAuth.ResolvedAuth = {
    eventId: 'event-2',
    authToken: 'auth-token',
    accessToken: null,
    role: 'admin',
};

const ADMIN_WITHOUT_EVENT: serverAuth.ResolvedAuth = {
    eventId: null,
    authToken: 'auth-token',
    accessToken: null,
    role: 'admin',
};

beforeEach(() => {
    jest.resetAllMocks();
    mockBuildHeaders.mockReturnValue({});
});

describe('HomePage', () => {
    it('共通ナビゲーションカードが表示されること', async () => {
        mockResolveAuth.mockResolvedValue(ADMIN_WITHOUT_EVENT);

        const element = await HomePage({
            searchParams: Promise.resolve({}),
        });
        render(element);

        expect(
            screen.getByRole('link', { name: /タイムテーブル/ }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: /部屋割り/ }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: /企画一覧/ }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: /販売物一覧/ }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('link', { name: /その他のお知らせ/ }),
        ).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /検索/ })).toBeInTheDocument();
    });

    it('user ロールでは access_token 由来の会期名を表示すること', async () => {
        mockResolveAuth.mockResolvedValue(USER_AUTH);
        global.fetch = jest.fn<typeof fetch>().mockResolvedValue(
            new Response(
                JSON.stringify({
                    code: { id: 'event-1', eventName: '第1回テストイベント' },
                }),
                { status: 200 },
            ),
        );

        const element = await HomePage({
            searchParams: Promise.resolve({}),
        });
        render(element);

        expect(
            screen.getByText('ようこそ、第1回テストイベントへ'),
        ).toBeInTheDocument();
        expect(mockBuildHeaders).toHaveBeenCalledWith(
            'event-1',
            null,
            'access-token',
            'viewer',
        );

        const timetableLink = screen.getByRole('link', {
            name: /タイムテーブル/,
        });
        expect(timetableLink).toHaveAttribute('href', '/timetable');
    });

    it('admin ロールでは選択中会期の会期名を表示すること', async () => {
        mockResolveAuth.mockResolvedValue(ADMIN_AUTH);
        global.fetch = jest.fn<typeof fetch>().mockResolvedValue(
            new Response(
                JSON.stringify({
                    code: { id: 'event-2', eventName: '第2回テストイベント' },
                }),
                { status: 200 },
            ),
        );

        const element = await HomePage({
            searchParams: Promise.resolve({ event_id: 'event-2' }),
        });
        render(element);

        expect(
            screen.getByText('ようこそ、第2回テストイベントへ'),
        ).toBeInTheDocument();
        expect(mockBuildHeaders).toHaveBeenCalledWith(
            'event-2',
            'auth-token',
            null,
            'admin',
        );

        const timetableLink = screen.getByRole('link', {
            name: /タイムテーブル/,
        });
        expect(timetableLink).toHaveAttribute(
            'href',
            '/timetable?event_id=event-2',
        );
    });

    it('admin で会期未選択時に案内メッセージを表示すること', async () => {
        mockResolveAuth.mockResolvedValue(ADMIN_WITHOUT_EVENT);

        const element = await HomePage({
            searchParams: Promise.resolve({}),
        });
        render(element);

        expect(screen.getByText('ようこそ')).toBeInTheDocument();
        expect(
            screen.getByText('会期を選択すると入口ページを表示できます'),
        ).toBeInTheDocument();
    });
});
