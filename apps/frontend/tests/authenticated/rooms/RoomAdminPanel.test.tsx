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

jest.mock('@frontend/app/actions/rooms', () => ({
    createRoomAction: jest.fn(),
    updateRoomAction: jest.fn(),
    deleteRoomAction: jest.fn(),
}));

const actions =
    require('@frontend/app/actions/rooms') as typeof import('@frontend/app/actions/rooms');
const RoomAdminPanel =
    require('@frontend/app/(authenticated)/rooms/RoomAdminPanel')
        .default as typeof import('@frontend/app/(authenticated)/rooms/RoomAdminPanel').default;

const mockCreate = jest.mocked(actions.createRoomAction);
const mockUpdate = jest.mocked(actions.updateRoomAction);
const mockDelete = jest.mocked(actions.deleteRoomAction);
const MOCK_DEPARTMENTS = [
    { id: 'dept-1', name: '運営部' },
    { id: 'dept-2', name: '企画部' },
];

const MOCK_ROOMS = [
    {
        id: '1',
        buildingName: 'A棟',
        floor: '2F',
        roomName: '第1会議室',
        preDayManagerId: null,
        preDayManagerName: null,
        preDayPurpose: null,
        dayManagerId: 'dept-1',
        dayManagerName: '運営部',
        dayPurpose: '受付',
        notes: null,
    },
    {
        id: '2',
        buildingName: 'A棟',
        floor: '3F',
        roomName: '展示室',
        preDayManagerId: 'dept-2',
        preDayManagerName: '企画部',
        preDayPurpose: '準備',
        dayManagerId: 'dept-1',
        dayManagerName: '運営部',
        dayPurpose: '展示',
        notes: '追加机あり',
    },
];

const CREATED_ROOM = {
    id: 'created-id',
    buildingName: 'B棟',
    floor: '1F',
    roomName: '控室',
    preDayManagerId: null,
    preDayManagerName: null,
    preDayPurpose: null,
    dayManagerId: 'dept-2',
    dayManagerName: '企画部',
    dayPurpose: '準備',
    notes: null,
};

beforeEach(() => {
    jest.clearAllMocks();
    mockUseRouter.mockReset();
    global.confirm = jest.fn<typeof confirm>().mockReturnValue(true);
    mockCreate.mockResolvedValue({
        success: true,
        data: [...MOCK_ROOMS, CREATED_ROOM],
    });
    mockUpdate.mockResolvedValue({ success: true, data: MOCK_ROOMS });
    mockDelete.mockResolvedValue({
        success: true,
        data: MOCK_ROOMS.slice(1),
    });
    mockUseRouter.mockReturnValue(createRouterMock());
});

describe('RoomAdminPanel', () => {
    it('部屋割り一覧を表示する', () => {
        render(<RoomAdminPanel rooms={MOCK_ROOMS} departments={MOCK_DEPARTMENTS} eventId='event-1' />);

        expect(screen.getAllByText('第1会議室')[0]).toBeInTheDocument();
        expect(screen.getAllByText('展示室')[0]).toBeInTheDocument();
    });

    it('各アイテムに編集・削除ボタンを表示する', () => {
        render(<RoomAdminPanel rooms={MOCK_ROOMS} departments={MOCK_DEPARTMENTS} eventId='event-1' />);

        expect(screen.getAllByRole('button', { name: '編集' })).toHaveLength(4);
        expect(screen.getAllByRole('button', { name: '削除' })).toHaveLength(4);
    });

    it('部屋がない場合に空メッセージを表示する', () => {
        render(<RoomAdminPanel rooms={[]} departments={MOCK_DEPARTMENTS} eventId='event-1' />);

        expect(
            screen.getByText('登録されている部屋割りはありません'),
        ).toBeInTheDocument();
    });

    it('+ 追加 ボタンクリックでフォームを表示する', async () => {
        const user = userEvent.setup();
        render(<RoomAdminPanel rooms={MOCK_ROOMS} departments={MOCK_DEPARTMENTS} eventId='event-1' />);

        await user.click(screen.getByRole('button', { name: '+ 追加' }));

        expect(screen.getByText('新しい部屋割りを追加')).toBeInTheDocument();
        expect(screen.getByLabelText(/建物名/)).toBeInTheDocument();
    });

    it('キャンセルボタンでフォームを閉じる', async () => {
        const user = userEvent.setup();
        render(<RoomAdminPanel rooms={MOCK_ROOMS} departments={MOCK_DEPARTMENTS} eventId='event-1' />);

        await user.click(screen.getByRole('button', { name: '+ 追加' }));
        await user.click(screen.getByRole('button', { name: 'キャンセル' }));

        expect(
            screen.queryByText('新しい部屋割りを追加'),
        ).not.toBeInTheDocument();
    });

    it('編集ボタンで既存データがフォームに入力済みになる', async () => {
        const user = userEvent.setup();
        render(<RoomAdminPanel rooms={MOCK_ROOMS} departments={MOCK_DEPARTMENTS} eventId='event-1' />);

        const editButtons = screen.getAllByRole('button', { name: '編集' });
        await user.click(editButtons[0]);

        expect(
            screen.getByRole('dialog', { name: '部屋割りを編集' }),
        ).toBeInTheDocument();
        expect(screen.getByText('部屋割りを編集')).toBeInTheDocument();
        expect(screen.getByLabelText(/建物名/)).toHaveValue('A棟');
        expect(screen.getByLabelText(/^部屋名/)).toHaveValue('第1会議室');
    });

    it('必須項目が空の場合にエラーを表示する', async () => {
        const user = userEvent.setup();
        render(<RoomAdminPanel rooms={[]} departments={MOCK_DEPARTMENTS} eventId='event-1' />);

        await user.click(screen.getByRole('button', { name: '+ 追加' }));
        await user.click(screen.getByRole('button', { name: '保存' }));

        expect(screen.getByRole('alert')).toHaveTextContent(
            '建物名・階・部屋名・当日担当部署・当日用途は必須です',
        );
        expect(mockCreate).not.toHaveBeenCalled();
    });

    it('削除ボタンクリック + confirm で deleteRoomAction を呼ぶ', async () => {
        const user = userEvent.setup();
        render(<RoomAdminPanel rooms={MOCK_ROOMS} departments={MOCK_DEPARTMENTS} eventId='event-1' />);

        const deleteButtons = screen.getAllByRole('button', { name: '削除' });
        await act(async () => {
            await user.click(deleteButtons[0]);
        });

        await waitFor(() => {
            expect(mockDelete).toHaveBeenCalledWith('event-1', '1');
        });
    });

    it('confirm キャンセル時は deleteRoomAction を呼ばない', async () => {
        const user = userEvent.setup();
        global.confirm = jest.fn<typeof confirm>().mockReturnValue(false);
        render(<RoomAdminPanel rooms={MOCK_ROOMS} departments={MOCK_DEPARTMENTS} eventId='event-1' />);

        const deleteButtons = screen.getAllByRole('button', { name: '削除' });
        await user.click(deleteButtons[0]);

        expect(mockDelete).not.toHaveBeenCalled();
    });

    it('備考が設定されている部屋に備考を表示する', () => {
        render(<RoomAdminPanel rooms={MOCK_ROOMS} departments={MOCK_DEPARTMENTS} eventId='event-1' />);

        expect(screen.getAllByText(/追加机あり/)[0]).toBeInTheDocument();
    });
});
