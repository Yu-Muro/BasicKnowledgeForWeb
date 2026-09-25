import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
    createRouterMock,
    type RouterMock,
} from '@frontend/tests/utils/mockRouter';

const mockUseRouter = jest.fn<RouterMock, []>();

jest.mock('next/navigation', () => ({
    useRouter: () => mockUseRouter(),
}));

jest.mock('@frontend/app/actions/timetable', () => ({
    createTimetableItemAction: jest.fn(),
    updateTimetableItemAction: jest.fn(),
    deleteTimetableItemAction: jest.fn(),
}));

const actions =
    require('@frontend/app/actions/timetable') as typeof import('@frontend/app/actions/timetable');
const TimetableAdminPanel =
    require('@frontend/app/(authenticated)/timetable/TimetableAdminPanel')
        .default as typeof import('@frontend/app/(authenticated)/timetable/TimetableAdminPanel').default;

const mockCreate = jest.mocked(actions.createTimetableItemAction);
const mockUpdate = jest.mocked(actions.updateTimetableItemAction);
const mockDelete = jest.mocked(actions.deleteTimetableItemAction);
const MOCK_DEPARTMENTS = [
    { id: 'dept-1', name: '広報部' },
    { id: 'dept-2', name: '会場管理部' },
];
const MOCK_ITEMS = [
    {
        id: '1',
        title: '開会式',
        startTime: '2025-08-01T00:00:00.000Z',
        endTime: '2025-08-01T00:30:00.000Z',
        location: '大ホール',
        description: null,
        isPublic: true,
        departments: [MOCK_DEPARTMENTS[0]],
    },
    {
        id: '2',
        title: 'スタッフ集合',
        startTime: '2025-08-01T23:00:00.000Z',
        endTime: '2025-08-01T23:30:00.000Z',
        location: 'ロビー',
        description: '全員参加',
        isPublic: true,
        departments: [],
    },
];

const CREATED_ITEM = {
    id: 'created-id',
    title: '閉会式',
    startTime: '2025-08-02T00:00:00.000Z',
    endTime: '2025-08-02T00:30:00.000Z',
    location: '大ホール',
    description: null,
    isPublic: true,
    departments: [],
};

beforeEach(() => {
    jest.clearAllMocks();
    mockUseRouter.mockReset();
    window.localStorage.clear();
    global.confirm = jest.fn<typeof confirm>().mockReturnValue(true);
    mockCreate.mockResolvedValue({
        success: true,
        data: [...MOCK_ITEMS, CREATED_ITEM],
    });
    mockUpdate.mockResolvedValue({ success: true, data: MOCK_ITEMS });
    mockDelete.mockResolvedValue({
        success: true,
        data: MOCK_ITEMS.slice(1),
    });
    mockUseRouter.mockReturnValue(createRouterMock());
});

describe('TimetableAdminPanel', () => {
    it('アイテム一覧を表示する', () => {
        render(
            <TimetableAdminPanel
                items={MOCK_ITEMS}
                departments={MOCK_DEPARTMENTS}
                eventId='event-1'
            />,
        );

        expect(screen.getByText('開会式')).toBeInTheDocument();
        expect(screen.getByText('スタッフ集合')).toBeInTheDocument();
        expect(screen.getByText('大ホール')).toBeInTheDocument();
    });

    it('各アイテムに編集・削除ボタンを表示する', () => {
        render(
            <TimetableAdminPanel
                items={MOCK_ITEMS}
                departments={MOCK_DEPARTMENTS}
                eventId='event-1'
            />,
        );

        expect(screen.getAllByRole('button', { name: '編集' })).toHaveLength(2);
        expect(screen.getAllByRole('button', { name: '削除' })).toHaveLength(2);
    });

    it('アイテムがない場合に空メッセージを表示する', () => {
        render(
            <TimetableAdminPanel
                items={[]}
                departments={MOCK_DEPARTMENTS}
                eventId='event-1'
            />,
        );

        expect(
            screen.getByText('登録されているタイムテーブルはありません'),
        ).toBeInTheDocument();
    });

    it('+ 追加 ボタンクリックでフォームを表示する', async () => {
        const user = userEvent.setup();
        render(
            <TimetableAdminPanel
                items={MOCK_ITEMS}
                departments={MOCK_DEPARTMENTS}
                eventId='event-1'
            />,
        );

        await user.click(screen.getByRole('button', { name: '+ 追加' }));

        expect(screen.getByText('新しいアイテムを追加')).toBeInTheDocument();
        expect(screen.getByLabelText(/タイトル/)).toBeInTheDocument();
        expect(screen.getByLabelText(/場所/)).toBeInTheDocument();
        expect(screen.getByText('部署タグ')).toBeInTheDocument();
    });

    it('キャンセルボタンでフォームを閉じる', async () => {
        const user = userEvent.setup();
        render(
            <TimetableAdminPanel
                items={MOCK_ITEMS}
                departments={MOCK_DEPARTMENTS}
                eventId='event-1'
            />,
        );

        await user.click(screen.getByRole('button', { name: '+ 追加' }));
        await user.click(screen.getByRole('button', { name: 'キャンセル' }));

        expect(
            screen.queryByText('新しいアイテムを追加'),
        ).not.toBeInTheDocument();
    });

    it('編集ボタンで既存データがフォームに入力済みになる', async () => {
        const user = userEvent.setup();
        render(
            <TimetableAdminPanel
                items={MOCK_ITEMS}
                departments={MOCK_DEPARTMENTS}
                eventId='event-1'
            />,
        );

        const editButtons = screen.getAllByRole('button', { name: '編集' });
        await user.click(editButtons[0]);

        expect(screen.getByText('アイテムを編集')).toBeInTheDocument();
        expect(screen.getByLabelText(/タイトル/)).toHaveValue('開会式');
        expect(screen.getByLabelText(/場所/)).toHaveValue('大ホール');
        expect(
            screen
                .getAllByLabelText('広報部')
                .some((input) => (input as HTMLInputElement).checked),
        ).toBe(true);
    });

    it('必須項目が空の場合にエラーを表示する', async () => {
        const user = userEvent.setup();
        render(
            <TimetableAdminPanel
                items={[]}
                departments={MOCK_DEPARTMENTS}
                eventId='event-1'
            />,
        );

        await user.click(screen.getByRole('button', { name: '+ 追加' }));
        await user.click(screen.getByRole('button', { name: '保存' }));

        expect(screen.getByRole('alert')).toHaveTextContent(
            'タイトル・開始・終了は必須です',
        );
        expect(mockCreate).not.toHaveBeenCalled();
    });

    it('場所が空でも保存できる', async () => {
        const user = userEvent.setup();
        render(
            <TimetableAdminPanel
                items={[]}
                departments={MOCK_DEPARTMENTS}
                eventId='event-1'
            />,
        );

        await user.click(screen.getByRole('button', { name: '+ 追加' }));
        await user.type(screen.getByLabelText(/タイトル/), '場所未定アナウンス');
        await user.type(
            screen.getByLabelText(/開始時刻/),
            '2025-08-01T09:00',
        );
        await user.type(
            screen.getByLabelText(/終了時刻/),
            '2025-08-01T10:00',
        );
        await act(async () => {
            await user.click(screen.getByRole('button', { name: '保存' }));
        });

        await waitFor(() => {
            expect(mockCreate).toHaveBeenCalledWith(
                'event-1',
                expect.objectContaining({
                    title: '場所未定アナウンス',
                    location: '',
                    is_public: true,
                    department_ids: [],
                }),
            );
        });
    });

    it('全体向けでも部署タグ付きでもない場合は保存しない', async () => {
        const user = userEvent.setup();
        render(
            <TimetableAdminPanel
                items={[]}
                departments={MOCK_DEPARTMENTS}
                eventId='event-1'
            />,
        );

        await user.click(screen.getByRole('button', { name: '+ 追加' }));
        await user.type(screen.getByLabelText(/タイトル/), '対象なし予定');
        await user.type(
            screen.getByLabelText(/開始時刻/),
            '2025-08-01T09:00',
        );
        await user.type(
            screen.getByLabelText(/終了時刻/),
            '2025-08-01T10:00',
        );
        await user.click(screen.getByLabelText('全体向けに表示'));
        await user.click(screen.getByRole('button', { name: '保存' }));

        expect(screen.getByRole('alert')).toHaveTextContent(
            '全体向けまたは部署タグを1つ以上選択してください',
        );
        expect(mockCreate).not.toHaveBeenCalled();
    });

    it('削除ボタンクリック + confirm で deleteTimetableItemAction を呼ぶ', async () => {
        const user = userEvent.setup();
        render(
            <TimetableAdminPanel
                items={MOCK_ITEMS}
                departments={MOCK_DEPARTMENTS}
                eventId='event-1'
            />,
        );

        const deleteButtons = screen.getAllByRole('button', { name: '削除' });
        await act(async () => {
            await user.click(deleteButtons[0]);
        });

        await waitFor(() => {
            expect(mockDelete).toHaveBeenCalledWith('event-1', '1');
        });
    });

    it('保存済み表示列がないイベントへ切り替えたら初期表示列に戻る', async () => {
        window.localStorage.setItem(
            'timetable:lanes:event-1',
            JSON.stringify(['dept-1']),
        );
        const { rerender } = render(
            <TimetableAdminPanel
                items={MOCK_ITEMS}
                departments={MOCK_DEPARTMENTS}
                eventId='event-1'
            />,
        );

        await waitFor(() => {
            expect(
                screen.getByLabelText('全体向け') as HTMLInputElement,
            ).not.toBeChecked();
        });

        rerender(
            <TimetableAdminPanel
                items={MOCK_ITEMS}
                departments={[]}
                eventId='event-2'
            />,
        );

        await waitFor(() => {
            expect(
                screen.getByLabelText('全体向け') as HTMLInputElement,
            ).toBeChecked();
        });
    });

    it('保存済みレーンが削除済みの場合は初期表示列に戻る', async () => {
        window.localStorage.setItem(
            'timetable:lanes:event-stale-lane',
            JSON.stringify(['deleted-department']),
        );

        render(
            <TimetableAdminPanel
                items={MOCK_ITEMS}
                departments={MOCK_DEPARTMENTS}
                eventId='event-stale-lane'
            />,
        );

        await waitFor(() => {
            expect(
                screen.getByLabelText('全体向け') as HTMLInputElement,
            ).toBeChecked();
        });
    });

    it('全体向け予定がない場合は予定を持つ最初の部署を初期選択する', async () => {
        const departmentOnlyItem = {
            ...MOCK_ITEMS[0],
            isPublic: false,
            departments: [MOCK_DEPARTMENTS[1]],
        };

        render(
            <TimetableAdminPanel
                items={[departmentOnlyItem]}
                departments={MOCK_DEPARTMENTS}
                eventId='event-department-only'
            />,
        );

        await waitFor(() => {
            expect(
                screen.getByLabelText('会場管理部') as HTMLInputElement,
            ).toBeChecked();
        });
        expect(
            screen.getByLabelText('広報部') as HTMLInputElement,
        ).not.toBeChecked();
        expect(screen.getByText('開会式')).toBeInTheDocument();
    });

    it('localStorage が利用できなくても初期レーンを表示する', async () => {
        const getItem = jest
            .spyOn(Storage.prototype, 'getItem')
            .mockImplementation(() => {
                throw new DOMException('Storage disabled', 'SecurityError');
            });
        const setItem = jest
            .spyOn(Storage.prototype, 'setItem')
            .mockImplementation(() => {
                throw new DOMException('Storage disabled', 'SecurityError');
            });

        try {
            render(
                <TimetableAdminPanel
                    items={MOCK_ITEMS}
                    departments={MOCK_DEPARTMENTS}
                    eventId='event-storage-disabled'
                />,
            );

            await waitFor(() => {
                expect(screen.getByText('開会式')).toBeInTheDocument();
            });
        } finally {
            getItem.mockRestore();
            setItem.mockRestore();
        }
    });

    it('日をまたぐ予定の終了日時を表示する', () => {
        const overnightItem = {
            ...MOCK_ITEMS[0],
            startTime: '2025-08-01T14:00:00.000Z',
            endTime: '2025-08-01T16:00:00.000Z',
        };

        render(
            <TimetableAdminPanel
                items={[overnightItem]}
                departments={MOCK_DEPARTMENTS}
                eventId='event-overnight'
            />,
        );

        expect(screen.getByText(/8月2日.*01:00/)).toBeInTheDocument();
    });

    it('confirm キャンセル時は deleteTimetableItemAction を呼ばない', async () => {
        const user = userEvent.setup();
        global.confirm = jest.fn<typeof confirm>().mockReturnValue(false);
        render(
            <TimetableAdminPanel
                items={MOCK_ITEMS}
                departments={MOCK_DEPARTMENTS}
                eventId='event-1'
            />,
        );

        const deleteButtons = screen.getAllByRole('button', { name: '削除' });
        await user.click(deleteButtons[0]);

        expect(mockDelete).not.toHaveBeenCalled();
    });

    it('アクション失敗時にエラーメッセージを表示する', async () => {
        const user = userEvent.setup();
        mockDelete.mockResolvedValue({
            success: false,
            error: '削除に失敗しました',
        });
        render(
            <TimetableAdminPanel
                items={MOCK_ITEMS}
                departments={MOCK_DEPARTMENTS}
                eventId='event-1'
            />,
        );

        const deleteButtons = screen.getAllByRole('button', { name: '削除' });
        await act(async () => {
            await user.click(deleteButtons[0]);
        });

        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent(
                '削除に失敗しました',
            );
        });
    });

    it('編集フォーム送信で updateTimetableItemAction を呼ぶ', async () => {
        const user = userEvent.setup();
        render(
            <TimetableAdminPanel
                items={MOCK_ITEMS}
                departments={MOCK_DEPARTMENTS}
                eventId='event-1'
            />,
        );

        const editButtons = screen.getAllByRole('button', { name: '編集' });
        await user.click(editButtons[0]);

        const titleInput = screen.getByLabelText(/タイトル/);
        await user.clear(titleInput);
        await user.type(titleInput, '更新タイトル');

        await act(async () => {
            await user.click(screen.getByRole('button', { name: '保存' }));
        });

        await waitFor(() => {
            expect(mockUpdate).toHaveBeenCalledWith(
                'event-1',
                '1',
                expect.objectContaining({ title: '更新タイトル' }),
            );
        });
    });
});
