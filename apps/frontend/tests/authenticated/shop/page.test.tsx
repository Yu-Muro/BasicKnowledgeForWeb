import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen, within } from '@testing-library/react';

jest.mock('@frontend/app/lib/serverAuth', () => ({
    resolveAuth: jest.fn(),
    buildContentFetchHeaders: jest.fn(),
}));

jest.mock('@frontend/app/actions/shop-items', () => ({
    createShopItemAction: jest.fn(),
    updateShopItemAction: jest.fn(),
    deleteShopItemAction: jest.fn(),
}));

jest.mock('next/navigation', () => ({
    useRouter: () => ({ refresh: jest.fn() }),
}));

jest.mock('next/image', () => ({
    __esModule: true,
    default: ({ src, alt }: { src: string; alt: string }) => (
        // biome-ignore lint/a11y/useAltText: テスト用モック
        <img src={src} alt={alt} />
    ),
}));

const serverAuth =
    require('@frontend/app/lib/serverAuth') as typeof import('@frontend/app/lib/serverAuth');
const ShopPage =
    require('@frontend/app/(authenticated)/shop/page').default as typeof import('@frontend/app/(authenticated)/shop/page').default;

const mockResolveAuth = jest.mocked(serverAuth.resolveAuth);
const mockBuildHeaders = jest.mocked(serverAuth.buildContentFetchHeaders);

const NO_AUTH: serverAuth.ResolvedAuth = {
    eventId: null,
    authToken: null,
    accessToken: null,
    role: 'user',
};
const WITH_AUTH: serverAuth.ResolvedAuth = {
    eventId: 'event-1',
    authToken: null,
    accessToken: 'token',
    role: 'user',
};

const MOCK_ITEMS = [
    {
        id: '1',
        name: '公式パンフレット',
        price: 500,
        description: null,
        imageUrl: 'https://assets.example.com/event-1/pamphlet.webp',
    },
    {
        id: '2',
        name: '限定Tシャツ',
        price: 2500,
        description: 'サイズはS・M・Lのみ\n数量限定',
        imageUrl: 'https://assets.example.com/event-1/tshirt.webp',
    },
    {
        id: '3',
        name: '缶バッジセット',
        price: 300,
        description: null,
        imageUrl: 'https://assets.example.com/event-1/badge.webp',
    },
];

const originalFetch = global.fetch;

beforeEach(() => {
    jest.resetAllMocks();
    mockBuildHeaders.mockReturnValue({});
});

afterEach(() => {
    global.fetch = originalFetch;
});

describe('ShopPage', () => {
    it('会期未選択時に案内メッセージを表示する', async () => {
        mockResolveAuth.mockResolvedValue(NO_AUTH);

        const element = await ShopPage({
            searchParams: Promise.resolve({}),
        });
        render(element);

        expect(
            screen.getByText('会期が選択されていません'),
        ).toBeInTheDocument();
    });

    it('販売物がないとき空メッセージを表示する', async () => {
        mockResolveAuth.mockResolvedValue(WITH_AUTH);
        global.fetch = jest.fn<typeof fetch>().mockResolvedValue(
            new Response(JSON.stringify({ items: [] }), { status: 200 }),
        );

        const element = await ShopPage({
            searchParams: Promise.resolve({ event_id: 'event-1' }),
        });
        render(element);

        expect(
            screen.getByText('登録されている販売物はありません'),
        ).toBeInTheDocument();
    });

    it('販売物一覧を表示する', async () => {
        mockResolveAuth.mockResolvedValue(WITH_AUTH);
        global.fetch = jest.fn<typeof fetch>().mockResolvedValue(
            new Response(JSON.stringify({ items: MOCK_ITEMS }), {
                status: 200,
            }),
        );

        const element = await ShopPage({
            searchParams: Promise.resolve({ event_id: 'event-1' }),
        });
        render(element);

        expect(screen.getAllByText('公式パンフレット')).toHaveLength(2);
        expect(screen.getAllByText('限定Tシャツ')).toHaveLength(2);
        expect(screen.getAllByText('缶バッジセット')).toHaveLength(2);
        expect(screen.getAllByAltText('公式パンフレット')).toHaveLength(2);
    });

    it('価格を正しくフォーマットして表示する', async () => {
        mockResolveAuth.mockResolvedValue(WITH_AUTH);
        global.fetch = jest.fn<typeof fetch>().mockResolvedValue(
            new Response(JSON.stringify({ items: MOCK_ITEMS }), {
                status: 200,
            }),
        );

        const element = await ShopPage({
            searchParams: Promise.resolve({ event_id: 'event-1' }),
        });
        render(element);

        expect(screen.getAllByText('¥2,500')).toHaveLength(2);
    });

    it('descriptionがある場合に表示する', async () => {
        mockResolveAuth.mockResolvedValue(WITH_AUTH);
        global.fetch = jest.fn<typeof fetch>().mockResolvedValue(
            new Response(JSON.stringify({ items: MOCK_ITEMS }), {
                status: 200,
            }),
        );

        const element = await ShopPage({
            searchParams: Promise.resolve({ event_id: 'event-1' }),
        });
        render(element);

        const descriptions = screen.getAllByText(
            (_, element) =>
                element?.classList.contains('whitespace-pre-wrap') === true &&
                element.textContent?.includes('サイズはS・M・Lのみ') === true &&
                element.textContent?.includes('数量限定') === true,
        );
        expect(descriptions).toHaveLength(2);
        descriptions.forEach((element) => {
            expect(element).toHaveClass('whitespace-pre-wrap');
        });
    });

    it('テーブル表示で列ごとの情報を確認できる', async () => {
        mockResolveAuth.mockResolvedValue(WITH_AUTH);
        global.fetch = jest.fn<typeof fetch>().mockResolvedValue(
            new Response(JSON.stringify({ items: MOCK_ITEMS }), {
                status: 200,
            }),
        );

        const element = await ShopPage({
            searchParams: Promise.resolve({ event_id: 'event-1' }),
        });
        render(element);

        const table = screen.getByRole('table', { name: '販売物一覧' });
        expect(table).toBeInTheDocument();
        expect(within(table).getByText('公式パンフレット')).toBeInTheDocument();
        expect(within(table).getByText('¥500')).toBeInTheDocument();
    });

    it('モバイルカードでも説明を表示する', async () => {
        mockResolveAuth.mockResolvedValue(WITH_AUTH);
        global.fetch = jest.fn<typeof fetch>().mockResolvedValue(
            new Response(JSON.stringify({ items: MOCK_ITEMS }), {
                status: 200,
            }),
        );

        const element = await ShopPage({
            searchParams: Promise.resolve({ event_id: 'event-1' }),
        });
        const { container } = render(element);

        const articles = within(container).getAllByRole('article');
        expect(articles).toHaveLength(3);
        expect(articles[1]).toHaveTextContent('限定Tシャツ');
        expect(articles[1]).toHaveTextContent('サイズはS・M・Lのみ');
        expect(articles[1]).toHaveTextContent('数量限定');
    });

    it('画像が欠けている場合に警告とプレースホルダーを表示する', async () => {
        mockResolveAuth.mockResolvedValue(WITH_AUTH);
        global.fetch = jest.fn<typeof fetch>().mockResolvedValue(
            new Response(
                JSON.stringify({
                    items: [
                        {
                            ...MOCK_ITEMS[0],
                            imageUrl: '',
                        },
                    ],
                }),
                {
                    status: 200,
                },
            ),
        );

        const element = await ShopPage({
            searchParams: Promise.resolve({ event_id: 'event-1' }),
        });
        render(element);

        expect(
            screen.getByText('データ不備: 商品画像が登録されていないアイテムがあります。'),
        ).toBeInTheDocument();
        expect(screen.getAllByText('No Image')).toHaveLength(2);
    });

    it('admin ロールの場合、管理パネルを表示する', async () => {
        const adminAuth: serverAuth.ResolvedAuth = {
            eventId: 'event-1',
            authToken: 'auth-token',
            accessToken: null,
            role: 'admin',
        };
        mockResolveAuth.mockResolvedValue(adminAuth);
        global.fetch = jest.fn<typeof fetch>().mockResolvedValue(
            new Response(JSON.stringify({ items: MOCK_ITEMS }), {
                status: 200,
            }),
        );

        const element = await ShopPage({
            searchParams: Promise.resolve({ event_id: 'event-1' }),
        });
        render(element);

        expect(
            screen.getByRole('button', { name: '+ 追加' }),
        ).toBeInTheDocument();
        expect(screen.getAllByRole('button', { name: '編集' })).toHaveLength(6);
        expect(screen.getAllByRole('button', { name: '削除' })).toHaveLength(6);
    });
});
