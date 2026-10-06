import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    jest,
} from '@jest/globals';
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

jest.mock('@frontend/app/actions/programs', () => ({
    createProgramAction: jest.fn(),
    updateProgramAction: jest.fn(),
    deleteProgramAction: jest.fn(),
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
const EventsPage = require('@frontend/app/(authenticated)/events/page')
    .default as typeof import('@frontend/app/(authenticated)/events/page').default;

const mockResolveAuth = jest.mocked(serverAuth.resolveAuth);
const mockBuildHeaders = jest.mocked(serverAuth.buildContentFetchHeaders);

const NO_AUTH: serverAuth.ResolvedAuth = {
    eventId: null,
    authToken: null,
    accessToken: null,
    role: 'viewer',
};
const WITH_AUTH: serverAuth.ResolvedAuth = {
    eventId: 'event-1',
    authToken: null,
    accessToken: 'token',
    role: 'viewer',
};

const MOCK_PROGRAMS = [
    {
        id: '1',
        name: 'オープニングセレモニー',
        location: '大ホール',
        startTime: '2025-08-01T10:00:00.000Z',
        endTime: '2025-08-01T11:00:00.000Z',
        description: null,
        imageUrl: null,
    },
    {
        id: '2',
        name: 'ミニゲーム大会',
        location: '多目的室',
        startTime: '2025-08-01T13:00:00.000Z',
        endTime: '2025-08-01T15:00:00.000Z',
        description: '参加費無料\n事前申込制',
        imageUrl: null,
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

describe('EventsPage', () => {
    it('会期未選択時に案内メッセージを表示する', async () => {
        mockResolveAuth.mockResolvedValue(NO_AUTH);

        const element = await EventsPage({
            searchParams: Promise.resolve({}),
        });
        render(element);

        expect(
            screen.getByText('会期が選択されていません'),
        ).toBeInTheDocument();
    });

    it('企画がないとき空メッセージを表示する', async () => {
        mockResolveAuth.mockResolvedValue(WITH_AUTH);
        global.fetch = jest
            .fn<typeof fetch>()
            .mockResolvedValue(
                new Response(JSON.stringify({ programs: [] }), { status: 200 }),
            );

        const element = await EventsPage({
            searchParams: Promise.resolve({ event_id: 'event-1' }),
        });
        render(element);

        expect(
            screen.getByText('登録されている企画はありません'),
        ).toBeInTheDocument();
    });

    it('企画一覧を開始時刻順に表示する', async () => {
        mockResolveAuth.mockResolvedValue(WITH_AUTH);
        global.fetch = jest.fn<typeof fetch>().mockResolvedValue(
            new Response(JSON.stringify({ programs: MOCK_PROGRAMS }), {
                status: 200,
            }),
        );

        const element = await EventsPage({
            searchParams: Promise.resolve({ event_id: 'event-1' }),
        });
        render(element);

        expect(screen.getByText('オープニングセレモニー')).toBeInTheDocument();
        expect(screen.getByText('ミニゲーム大会')).toBeInTheDocument();
        expect(screen.getByText('大ホール')).toBeInTheDocument();
    });

    it('日時をフォーマットして表示する', async () => {
        mockResolveAuth.mockResolvedValue(WITH_AUTH);
        global.fetch = jest.fn<typeof fetch>().mockResolvedValue(
            new Response(JSON.stringify({ programs: [MOCK_PROGRAMS[0]] }), {
                status: 200,
            }),
        );

        const element = await EventsPage({
            searchParams: Promise.resolve({ event_id: 'event-1' }),
        });
        render(element);

        expect(screen.getByText('8/1(金)')).toBeInTheDocument();
        expect(screen.getByText('19:00 〜 20:00')).toBeInTheDocument();
    });

    it('descriptionがある場合に表示する', async () => {
        mockResolveAuth.mockResolvedValue(WITH_AUTH);
        global.fetch = jest.fn<typeof fetch>().mockResolvedValue(
            new Response(JSON.stringify({ programs: MOCK_PROGRAMS }), {
                status: 200,
            }),
        );

        const element = await EventsPage({
            searchParams: Promise.resolve({ event_id: 'event-1' }),
        });
        render(element);

        const description = screen.getByText(
            (_, element) =>
                element?.classList.contains('whitespace-pre-wrap') === true &&
                element.textContent?.includes('参加費無料') === true &&
                element.textContent?.includes('事前申込制') === true,
        );
        expect(description).toBeInTheDocument();
        expect(description).toHaveClass('whitespace-pre-wrap');
    });

    it('日時が不正な場合は日時未定を表示する', async () => {
        mockResolveAuth.mockResolvedValue(WITH_AUTH);
        global.fetch = jest.fn<typeof fetch>().mockResolvedValue(
            new Response(
                JSON.stringify({
                    programs: [
                        {
                            id: '3',
                            name: '時間未定の企画',
                            location: '会場A',
                            startTime: 'invalid',
                            endTime: 'invalid',
                            description: null,
                            imageUrl: null,
                        },
                    ],
                }),
                { status: 200 },
            ),
        );

        const element = await EventsPage({
            searchParams: Promise.resolve({ event_id: 'event-1' }),
        });
        render(element);

        expect(screen.getByText('時間未定の企画')).toBeInTheDocument();
        expect(screen.getByText('日時未定')).toBeInTheDocument();
    });

    it.each(['admin', 'user'])(
        '%s ロールの場合、編集パネルを表示する',
        async (role) => {
            const adminAuth: serverAuth.ResolvedAuth = {
                eventId: 'event-1',
                authToken: 'auth-token',
                accessToken: null,
                role,
            };
            mockResolveAuth.mockResolvedValue(adminAuth);
            global.fetch = jest.fn<typeof fetch>().mockResolvedValue(
                new Response(JSON.stringify({ programs: MOCK_PROGRAMS }), {
                    status: 200,
                }),
            );

            const element = await EventsPage({
                searchParams: Promise.resolve({ event_id: 'event-1' }),
            });
            render(element);

            expect(
                screen.getByRole('button', { name: '+ 追加' }),
            ).toBeInTheDocument();
            expect(
                screen.getAllByRole('button', { name: '編集' }),
            ).toHaveLength(2);
        },
    );
});
