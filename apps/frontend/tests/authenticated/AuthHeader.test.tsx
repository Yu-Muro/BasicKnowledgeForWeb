import {
    AuthHeader,
    buildNavigationHref,
} from '@frontend/components/AuthHeader';
import { AppRouterWrapper } from '@frontend/tests/helpers/createMockRouter';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockUseSearchParams = jest.fn().mockReturnValue(new URLSearchParams());
const mockUsePathname = jest.fn().mockReturnValue('/');

jest.mock('next/navigation', () => ({
    usePathname: mockUsePathname,
    useSearchParams: mockUseSearchParams,
}));

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

const ACCESS_CODES = [
    { id: 'event-1', eventName: '第1回イベント' },
    { id: 'event-2', eventName: '第2回イベント' },
];

const defaultProps = {
    role: 'viewer',
    userName: 'テストユーザー',
    userEventId: 'event-1',
    userEventName: null,
    accessCodes: [],
    logoutAction: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
};

function renderHeader(props = defaultProps) {
    return render(
        <AppRouterWrapper>
            <AuthHeader {...props} />
        </AppRouterWrapper>,
    );
}

describe('AuthHeader', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockUsePathname.mockReturnValue('/');
        mockUseSearchParams.mockReturnValue(new URLSearchParams());
    });

    describe('ナビゲーション', () => {
        it('全ての共通ナビゲーションリンクが表示されること', () => {
            renderHeader();

            expect(
                screen.getAllByRole('link', { name: 'タイムテーブル' }).length,
            ).toBeGreaterThanOrEqual(1);
            expect(
                screen.getAllByRole('link', { name: '部屋割り' }).length,
            ).toBeGreaterThanOrEqual(1);
            expect(
                screen.getAllByRole('link', { name: '企画一覧' }).length,
            ).toBeGreaterThanOrEqual(1);
            expect(
                screen.getAllByRole('link', { name: '販売物' }).length,
            ).toBeGreaterThanOrEqual(1);
            expect(
                screen.getAllByRole('link', { name: '情報' }).length,
            ).toBeGreaterThanOrEqual(1);
            expect(
                screen.getAllByRole('link', { name: '検索' }).length,
            ).toBeGreaterThanOrEqual(1);
        });

        it('ホームリンクが表示されること', () => {
            renderHeader();
            expect(
                screen.getByRole('link', { name: 'スタッフポータル' }),
            ).toBeInTheDocument();
        });
    });

    describe('buildNavigationHref', () => {
        it('検索クエリは検索ページ以外に引き継がれないこと', () => {
            const rawParams = 'event_id=event-1&q=hogehoge';

            expect(buildNavigationHref('/timetable', rawParams)).toBe(
                '/timetable?event_id=event-1',
            );
            expect(buildNavigationHref('/search', rawParams)).toBe(
                '/search?event_id=event-1&q=hogehoge',
            );
        });
    });

    describe('会期セレクター — 権限制御', () => {
        it('閲覧者では会期セレクターが表示されないこと', () => {
            renderHeader({
                ...defaultProps,
                role: 'viewer',
                accessCodes: ACCESS_CODES,
            });
            expect(
                screen.queryByRole('combobox', { name: '会期を選択' }),
            ).not.toBeInTheDocument();
        });

        it.each(['admin', 'user'])(
            '%s ロールでは会期セレクターが表示されること',
            (role) => {
                renderHeader({
                    ...defaultProps,
                    role,
                    accessCodes: ACCESS_CODES,
                });
                const selectors = screen.getAllByRole('combobox', {
                    name: '会期を選択',
                });

                expect(selectors.length).toBeGreaterThanOrEqual(1);
                expect(selectors[0]).toHaveClass('text-[var(--header-fg)]');
            },
        );
    });

    describe('ロゴ表示', () => {
        it('admin ロールではイベント管理と表示されること', () => {
            renderHeader({ ...defaultProps, role: 'admin', accessCodes: [] });
            expect(
                screen.getByRole('link', { name: 'イベント管理' }),
            ).toBeInTheDocument();
        });

        it('閲覧者ではスタッフポータルと表示されること', () => {
            renderHeader({ ...defaultProps, role: 'viewer' });
            expect(
                screen.getByRole('link', { name: 'スタッフポータル' }),
            ).toBeInTheDocument();
        });
    });

    describe('イベント名表示 — 閲覧者', () => {
        it('userEventName が渡された場合にイベント名が表示されること', () => {
            renderHeader({
                ...defaultProps,
                role: 'viewer',
                userEventName: '第1回テストイベント',
            });
            const names = screen.getAllByText('第1回テストイベント');
            expect(names.length).toBeGreaterThanOrEqual(1);
        });

        it('userEventName が null の場合にイベント名が表示されないこと', () => {
            renderHeader({
                ...defaultProps,
                role: 'viewer',
                userEventName: null,
            });
            expect(
                screen.queryByText('第1回テストイベント'),
            ).not.toBeInTheDocument();
        });
    });

    describe('モバイルドロワー', () => {
        it('ハンバーガーボタンが表示されること', () => {
            renderHeader();
            expect(
                screen.getByRole('button', { name: 'メニューを開く' }),
            ).toBeInTheDocument();
        });

        it('ハンバーガーボタンをクリックするとドロワーが開くこと', async () => {
            const user = userEvent.setup();
            renderHeader();

            await user.click(
                screen.getByRole('button', { name: 'メニューを開く' }),
            );

            expect(
                screen.getByRole('button', { name: 'メニューを閉じる' }),
            ).toBeInTheDocument();
            expect(
                screen.getByRole('dialog', { name: 'ナビゲーションメニュー' }),
            ).toBeInTheDocument();
        });

        it('閉じるボタンをクリックするとドロワーが閉じること', async () => {
            const user = userEvent.setup();
            renderHeader();

            await user.click(
                screen.getByRole('button', { name: 'メニューを開く' }),
            );
            await user.click(
                screen.getByRole('button', { name: 'メニューを閉じる' }),
            );

            const dialog = screen.getByRole('dialog', {
                name: 'ナビゲーションメニュー',
            });
            expect(dialog.className).toContain('translate-x-full');
        });
    });
});
