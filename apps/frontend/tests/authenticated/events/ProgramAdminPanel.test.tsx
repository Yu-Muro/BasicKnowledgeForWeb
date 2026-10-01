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

jest.mock('@frontend/app/actions/programs', () => ({
    createProgramAction: jest.fn(),
    updateProgramAction: jest.fn(),
    deleteProgramAction: jest.fn(),
}));

jest.mock('@frontend/app/lib/imageUpload', () => ({
    uploadImage: jest.fn(),
}));

jest.mock('next/image', () => ({
    __esModule: true,
    default: ({ src, alt }: { src: string; alt: string }) => (
        // biome-ignore lint/a11y/useAltText: テスト用モック
        <img src={src} alt={alt} />
    ),
}));

const actions =
    require('@frontend/app/actions/programs') as typeof import('@frontend/app/actions/programs');
const imageUpload =
    require('@frontend/app/lib/imageUpload') as typeof import('@frontend/app/lib/imageUpload');
const ProgramAdminPanel =
    require('@frontend/app/(authenticated)/events/ProgramAdminPanel')
        .default as typeof import('@frontend/app/(authenticated)/events/ProgramAdminPanel').default;

const mockCreate = jest.mocked(actions.createProgramAction);
const mockUpdate = jest.mocked(actions.updateProgramAction);
const mockDelete = jest.mocked(actions.deleteProgramAction);
const mockUploadImage = jest.mocked(imageUpload.uploadImage);
const MOCK_ITEMS = [
    {
        id: '1',
        name: '展示会',
        location: 'A棟3F',
        startTime: '2025-08-01T01:00:00.000Z',
        endTime: '2025-08-01T09:00:00.000Z',
        description: null,
        imageUrl: null,
    },
    {
        id: '2',
        name: 'ライブイベント',
        location: 'ステージ',
        startTime: '2025-08-01T05:00:00.000Z',
        endTime: '2025-08-01T07:00:00.000Z',
        description: 'チケット必要\n入場整理券あり',
        imageUrl: null,
    },
];

const CREATED_PROGRAM = {
    id: 'created-id',
    name: '新規企画',
    location: 'サブホール',
    startTime: '2025-08-02T01:00:00.000Z',
    endTime: '2025-08-02T02:00:00.000Z',
    description: null,
    imageUrl: null,
};

beforeEach(() => {
    jest.clearAllMocks();
    mockUseRouter.mockReset();
    global.confirm = jest.fn<typeof confirm>().mockReturnValue(true);
    mockCreate.mockResolvedValue({
        success: true,
        data: [...MOCK_ITEMS, CREATED_PROGRAM],
    });
    mockUploadImage.mockResolvedValue({
        success: true,
        imageKey: 'programs/event-1/new.webp',
    });
    mockUpdate.mockResolvedValue({ success: true, data: MOCK_ITEMS });
    mockDelete.mockResolvedValue({
        success: true,
        data: MOCK_ITEMS.slice(1),
    });
    mockUseRouter.mockReturnValue(createRouterMock());
});

describe('ProgramAdminPanel', () => {
    it('企画一覧を表示する', () => {
        render(<ProgramAdminPanel items={MOCK_ITEMS} eventId='event-1' />);

        expect(screen.getByText('展示会')).toBeInTheDocument();
        expect(screen.getByText('ライブイベント')).toBeInTheDocument();
        expect(screen.getByText('A棟3F')).toBeInTheDocument();
    });

    it('各アイテムに編集・削除ボタンを表示する', () => {
        render(<ProgramAdminPanel items={MOCK_ITEMS} eventId='event-1' />);

        expect(screen.getAllByRole('button', { name: '編集' })).toHaveLength(2);
        expect(screen.getAllByRole('button', { name: '削除' })).toHaveLength(2);
    });

    it('アイテムがない場合に空メッセージを表示する', () => {
        render(<ProgramAdminPanel items={[]} eventId='event-1' />);

        expect(
            screen.getByText('登録されている企画はありません'),
        ).toBeInTheDocument();
    });

    it('+ 追加 ボタンクリックでフォームを表示する', async () => {
        const user = userEvent.setup();
        render(<ProgramAdminPanel items={MOCK_ITEMS} eventId='event-1' />);

        await user.click(screen.getByRole('button', { name: '+ 追加' }));

        expect(screen.getByText('新しい企画を追加')).toBeInTheDocument();
        expect(screen.getByLabelText(/企画名/)).toBeInTheDocument();
    });

    it('キャンセルボタンでフォームを閉じる', async () => {
        const user = userEvent.setup();
        render(<ProgramAdminPanel items={MOCK_ITEMS} eventId='event-1' />);

        await user.click(screen.getByRole('button', { name: '+ 追加' }));
        await user.click(screen.getByRole('button', { name: 'キャンセル' }));

        expect(
            screen.queryByText('新しい企画を追加'),
        ).not.toBeInTheDocument();
    });

    it('編集ボタンで既存データがフォームに入力済みになる', async () => {
        const user = userEvent.setup();
        render(<ProgramAdminPanel items={MOCK_ITEMS} eventId='event-1' />);

        const editButtons = screen.getAllByRole('button', { name: '編集' });
        await user.click(editButtons[0]);

        expect(
            screen.getByRole('dialog', { name: '企画を編集' }),
        ).toBeInTheDocument();
        expect(screen.getByText('企画を編集')).toBeInTheDocument();
        expect(screen.getByLabelText(/企画名/)).toHaveValue('展示会');
        expect(screen.getByLabelText(/場所/)).toHaveValue('A棟3F');
    });

    it('必須項目が空の場合にエラーを表示する', async () => {
        const user = userEvent.setup();
        render(<ProgramAdminPanel items={[]} eventId='event-1' />);

        await user.click(screen.getByRole('button', { name: '+ 追加' }));
        await user.click(screen.getByRole('button', { name: '保存' }));

        expect(screen.getByRole('alert')).toHaveTextContent(
            '名前・開始・終了・場所は必須です',
        );
        expect(mockCreate).not.toHaveBeenCalled();
    });

    it('削除ボタンクリック + confirm で deleteProgramAction を呼ぶ', async () => {
        const user = userEvent.setup();
        mockDelete.mockResolvedValue({
            success: true,
            data: MOCK_ITEMS.slice(1),
        });
        render(<ProgramAdminPanel items={MOCK_ITEMS} eventId='event-1' />);

        const deleteButtons = screen.getAllByRole('button', { name: '削除' });
        await act(async () => {
            await user.click(deleteButtons[0]);
        });

        await waitFor(() => {
            expect(mockDelete).toHaveBeenCalledWith('event-1', '1');
        });
    });

    it('confirm キャンセル時は deleteProgramAction を呼ばない', async () => {
        const user = userEvent.setup();
        global.confirm = jest.fn<typeof confirm>().mockReturnValue(false);
        render(<ProgramAdminPanel items={MOCK_ITEMS} eventId='event-1' />);

        const deleteButtons = screen.getAllByRole('button', { name: '削除' });
        await user.click(deleteButtons[0]);

        expect(mockDelete).not.toHaveBeenCalled();
    });

    it('説明がある場合に表示する', () => {
        render(<ProgramAdminPanel items={MOCK_ITEMS} eventId='event-1' />);

        const description = screen.getByText(
            (_, element) =>
                element?.classList.contains('whitespace-pre-wrap') === true &&
                element.textContent?.includes('チケット必要') === true &&
                element.textContent?.includes('入場整理券あり') === true,
        );
        expect(description).toBeInTheDocument();
        expect(description).toHaveClass('whitespace-pre-wrap');
    });

    it('画像を選択して保存すると画像アップロードAPIを呼ぶ', async () => {
        const user = userEvent.setup();
        render(<ProgramAdminPanel items={[]} eventId='event-1' />);

        await user.click(screen.getByRole('button', { name: '+ 追加' }));
        await user.type(screen.getByLabelText(/企画名/), '新規企画');
        await user.type(screen.getByLabelText(/場所/), 'サブホール');
        await user.type(
            screen.getByLabelText(/開始時刻/),
            '2025-08-01T10:00',
        );
        await user.type(
            screen.getByLabelText(/終了時刻/),
            '2025-08-01T11:00',
        );
        const fileInput = screen.getByLabelText(/画像ファイル/);
        const file = new File(['dummy'], 'program.png', { type: 'image/png' });
        await user.upload(fileInput, file);

        await act(async () => {
            await user.click(screen.getByRole('button', { name: '保存' }));
        });

        await waitFor(() => {
            expect(mockUploadImage).toHaveBeenCalledWith(
                '/api/programs/upload',
                'event-1',
                file,
            );
        });
    });

    it('編集フォーム送信で updateProgramAction を呼ぶ', async () => {
        const user = userEvent.setup();
        render(<ProgramAdminPanel items={MOCK_ITEMS} eventId='event-1' />);

        const editButtons = screen.getAllByRole('button', { name: '編集' });
        await user.click(editButtons[0]);

        const nameInput = screen.getByLabelText(/企画名/);
        await user.clear(nameInput);
        await user.type(nameInput, '更新企画名');

        await act(async () => {
            await user.click(screen.getByRole('button', { name: '保存' }));
        });

        await waitFor(() => {
            expect(mockUpdate).toHaveBeenCalledWith(
                'event-1',
                '1',
                expect.objectContaining({ name: '更新企画名' }),
            );
        });
    });
});
