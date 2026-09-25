import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react';

jest.mock('next/navigation', () => ({
    useRouter: () => ({
        refresh: jest.fn(),
        prefetch: jest.fn(),
        push: jest.fn(),
        replace: jest.fn(),
        back: jest.fn(),
        forward: jest.fn(),
    }),
}));

jest.mock('@frontend/app/lib/serverAuth', () => ({
    resolveAuth: jest.fn(),
    buildContentFetchHeaders: jest.fn(),
}));

jest.mock('@frontend/app/actions/timetable', () => ({
    createTimetableItemAction: jest.fn(),
    updateTimetableItemAction: jest.fn(),
    deleteTimetableItemAction: jest.fn(),
}));

const serverAuth =
    require('@frontend/app/lib/serverAuth') as typeof import('@frontend/app/lib/serverAuth');
const TimetablePage = require('@frontend/app/(authenticated)/timetable/page')
    .default as typeof import('@frontend/app/(authenticated)/timetable/page').default;

const mockResolveAuth = jest.mocked(serverAuth.resolveAuth);
const mockBuildHeaders = jest.mocked(serverAuth.buildContentFetchHeaders);

const TIME_ZONE = 'Asia/Tokyo';
const dateFormatter = new Intl.DateTimeFormat('ja-JP', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    timeZone: TIME_ZONE,
});
const timeFormatter = new Intl.DateTimeFormat('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: TIME_ZONE,
});

const formatDateLabel = (iso: string) => dateFormatter.format(new Date(iso));
const formatTime = (iso: string) => timeFormatter.format(new Date(iso));

const NO_AUTH: serverAuth.ResolvedAuth = {
    eventId: null,
    authToken: null,
    accessToken: null,
    role: 'user',
};

const WITH_AUTH: serverAuth.ResolvedAuth = {
    eventId: 'event-1',
    authToken: null,
    accessToken: 'access-token',
    role: 'user',
};

const MOCK_ITEMS = [
    {
        id: '1',
        title: '開会式',
        startTime: '2025-08-01T09:00:00.000Z',
        endTime: '2025-08-01T09:30:00.000Z',
        location: '大ホール',
        description: null,
        isPublic: true,
        departments: [],
    },
    {
        id: '2',
        title: 'スタッフ集合',
        startTime: '2025-08-01T08:00:00.000Z',
        endTime: '2025-08-01T08:30:00.000Z',
        location: 'ロビー',
        description: '全員参加',
        isPublic: true,
        departments: [],
    },
];

const originalFetch = global.fetch;

beforeEach(() => {
    jest.resetAllMocks();
    mockBuildHeaders.mockReturnValue({});
    window.localStorage.clear();
});

afterEach(() => {
    global.fetch = originalFetch;
});

describe('TimetablePage', () => {
    it('会期未選択時に案内メッセージを表示する', async () => {
        mockResolveAuth.mockResolvedValue(NO_AUTH);

        const element = await TimetablePage({
            searchParams: Promise.resolve({}),
        });
        render(element);

        expect(
            screen.getByText('会期が選択されていません'),
        ).toBeInTheDocument();
    });

    it('アイテムがないとき空メッセージを表示する', async () => {
        mockResolveAuth.mockResolvedValue(WITH_AUTH);
        global.fetch = jest
            .fn<typeof fetch>()
            .mockResolvedValue(
                new Response(JSON.stringify({ items: [] }), { status: 200 }),
            );

        const element = await TimetablePage({
            searchParams: Promise.resolve({}),
        });
        render(element);

        expect(
            screen.getByText('登録されているタイムテーブルはありません'),
        ).toBeInTheDocument();
    });

    it('アイテムを開始時刻順に日付ごとで表示する', async () => {
        mockResolveAuth.mockResolvedValue(WITH_AUTH);
        global.fetch = jest.fn<typeof fetch>().mockResolvedValue(
            new Response(JSON.stringify({ items: MOCK_ITEMS }), {
                status: 200,
            }),
        );

        const element = await TimetablePage({
            searchParams: Promise.resolve({}),
        });
        render(element);

        expect(screen.getByText('開会式')).toBeInTheDocument();
        expect(screen.getByText('スタッフ集合')).toBeInTheDocument();

        const titles = screen
            .getAllByText(/開会式|スタッフ集合/)
            .map((el) => el.textContent);
        expect(titles[0]).toBe('スタッフ集合');
        expect(titles[1]).toBe('開会式');

        const dateLabel = formatDateLabel(MOCK_ITEMS[0].startTime);
        expect(screen.getByText(dateLabel)).toBeInTheDocument();

        const earlyTime = formatTime(MOCK_ITEMS[1].startTime);
        const lateTime = formatTime(MOCK_ITEMS[0].startTime);
        expect(screen.getByText(earlyTime)).toBeInTheDocument();
        expect(screen.getByText(lateTime)).toBeInTheDocument();

        expect(screen.getByText('ロビー')).toBeInTheDocument();
        expect(screen.getAllByText('全体向け').length).toBeGreaterThan(0);
    });

    it('descriptionがある場合に表示する', async () => {
        mockResolveAuth.mockResolvedValue(WITH_AUTH);
        global.fetch = jest.fn<typeof fetch>().mockResolvedValue(
            new Response(JSON.stringify({ items: MOCK_ITEMS }), {
                status: 200,
            }),
        );

        const element = await TimetablePage({
            searchParams: Promise.resolve({}),
        });
        render(element);

        expect(screen.getByText('全員参加')).toBeInTheDocument();
    });

    it('fetchが失敗したとき空メッセージを表示する', async () => {
        mockResolveAuth.mockResolvedValue(WITH_AUTH);
        global.fetch = jest
            .fn<typeof fetch>()
            .mockResolvedValue(new Response(null, { status: 401 }));

        const element = await TimetablePage({
            searchParams: Promise.resolve({}),
        });
        render(element);

        expect(
            screen.getByText('登録されているタイムテーブルはありません'),
        ).toBeInTheDocument();
    });

    it('部署一覧の取得に失敗しても項目内の部署レーンを表示する', async () => {
        mockResolveAuth.mockResolvedValue(WITH_AUTH);
        const department = { id: 'dept-1', name: '広報部' };
        const departmentItem = {
            ...MOCK_ITEMS[0],
            isPublic: false,
            departments: [department],
        };
        global.fetch = jest.fn<typeof fetch>().mockImplementation((input) => {
            const url = String(input);
            if (url.endsWith('/api/timetable')) {
                return Promise.resolve(
                    new Response(JSON.stringify({ items: [departmentItem] }), {
                        status: 200,
                    }),
                );
            }
            return Promise.resolve(new Response(null, { status: 503 }));
        });

        const element = await TimetablePage({
            searchParams: Promise.resolve({}),
        });
        render(element);

        expect(screen.getByLabelText('広報部')).toBeChecked();
        expect(screen.getByText('開会式')).toBeInTheDocument();
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

        const element = await TimetablePage({
            searchParams: Promise.resolve({ event_id: 'event-1' }),
        });
        render(element);

        expect(
            screen.getByRole('button', { name: '+ 追加' }),
        ).toBeInTheDocument();
        expect(screen.getAllByRole('button', { name: '編集' })).toHaveLength(2);
    });
});
