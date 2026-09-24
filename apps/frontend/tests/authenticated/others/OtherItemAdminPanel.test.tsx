import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

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

jest.mock('@frontend/app/actions/others', () => ({
    createOtherItemAction: jest.fn(),
    updateOtherItemAction: jest.fn(),
    deleteOtherItemAction: jest.fn(),
    uploadOtherItemImageAction: jest.fn(),
}));

jest.mock('next/image', () => ({
    __esModule: true,
    default: ({ src, alt }: { src: string; alt: string }) => (
        // biome-ignore lint/a11y/useAltText: テスト用モック
        <img src={src} alt={alt} />
    ),
}));

const actions =
    require('@frontend/app/actions/others') as typeof import('@frontend/app/actions/others');
const OtherItemAdminPanel =
    require('@frontend/app/(authenticated)/others/OtherItemAdminPanel')
        .default as typeof import('@frontend/app/(authenticated)/others/OtherItemAdminPanel').default;

const mockCreate = jest.mocked(actions.createOtherItemAction);
const mockUpdate = jest.mocked(actions.updateOtherItemAction);
const mockDelete = jest.mocked(actions.deleteOtherItemAction);
const mockUploadImage = jest.mocked(actions.uploadOtherItemImageAction);

const MOCK_ITEMS = [
    {
        id: '1',
        title: '緊急連絡先',
        content: '内線123',
        imageUrl: null,
        displayOrder: 1,
    },
    {
        id: '2',
        title: 'Wi-Fi情報',
        content: 'SSID: EventStaff',
        imageUrl: null,
        displayOrder: 2,
    },
];

const CREATED_ITEM = {
    id: 'created-id',
    title: '新しいタイトル',
    content: '新しい内容',
    imageUrl: null,
    displayOrder: 999,
};

beforeEach(() => {
    jest.resetAllMocks();
    global.confirm = jest.fn<typeof confirm>().mockReturnValue(true);
    mockCreate.mockResolvedValue({
        success: true,
        data: [...MOCK_ITEMS, CREATED_ITEM],
    });
    mockUploadImage.mockResolvedValue({
        success: true,
        imageKey: 'others/event-1/new.webp',
    });
    mockUpdate.mockResolvedValue({ success: true, data: MOCK_ITEMS });
    mockDelete.mockResolvedValue({
        success: true,
        data: MOCK_ITEMS.slice(1),
    });
});

describe('OtherItemAdminPanel', () => {
    it('アイテム一覧を表示する', () => {
        render(<OtherItemAdminPanel items={MOCK_ITEMS} eventId='event-1' />);

        expect(screen.getByText('緊急連絡先')).toBeInTheDocument();
        expect(screen.getByText('Wi-Fi情報')).toBeInTheDocument();
        expect(screen.getByText('内線123')).toBeInTheDocument();
    });

    it('各アイテムに編集・削除ボタンを表示する', () => {
        render(<OtherItemAdminPanel items={MOCK_ITEMS} eventId='event-1' />);

        expect(screen.getAllByRole('button', { name: '編集' })).toHaveLength(2);
        expect(screen.getAllByRole('button', { name: '削除' })).toHaveLength(2);
    });

    it('アイテムがない場合に空メッセージを表示する', () => {
        render(<OtherItemAdminPanel items={[]} eventId='event-1' />);

        expect(
            screen.getByText('登録されているその他の情報はありません'),
        ).toBeInTheDocument();
    });

    it('+ 追加 ボタンクリックでフォームを表示する', async () => {
        const user = userEvent.setup();
        render(<OtherItemAdminPanel items={MOCK_ITEMS} eventId='event-1' />);

        await user.click(screen.getByRole('button', { name: '+ 追加' }));

        expect(screen.getByText('新しい情報を追加')).toBeInTheDocument();
        expect(screen.getByLabelText(/タイトル/)).toBeInTheDocument();
        expect(screen.getByLabelText(/内容/)).toBeInTheDocument();
    });

    it('キャンセルボタンでフォームを閉じる', async () => {
        const user = userEvent.setup();
        render(<OtherItemAdminPanel items={MOCK_ITEMS} eventId='event-1' />);

        await user.click(screen.getByRole('button', { name: '+ 追加' }));
        expect(screen.getByText('新しい情報を追加')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'キャンセル' }));
        expect(
            screen.queryByText('新しい情報を追加'),
        ).not.toBeInTheDocument();
    });

    it('編集ボタンで既存データがフォームに入力済みになる', async () => {
        const user = userEvent.setup();
        render(<OtherItemAdminPanel items={MOCK_ITEMS} eventId='event-1' />);

        const editButtons = screen.getAllByRole('button', { name: '編集' });
        await user.click(editButtons[0]);

        expect(
            screen.getByRole('dialog', { name: '情報を編集' }),
        ).toBeInTheDocument();
        expect(screen.getByText('情報を編集')).toBeInTheDocument();
        expect(screen.getByLabelText(/タイトル/)).toHaveValue('緊急連絡先');
        expect(screen.getByLabelText(/内容/)).toHaveValue('内線123');
    });

    it('フォーム送信で createOtherItemAction を呼ぶ', async () => {
        const user = userEvent.setup();
        render(<OtherItemAdminPanel items={[]} eventId='event-1' />);

        await user.click(screen.getByRole('button', { name: '+ 追加' }));
        await user.type(screen.getByLabelText(/タイトル/), '新しいタイトル');
        await user.type(screen.getByLabelText(/内容/), '新しい内容');

        await act(async () => {
            await user.click(screen.getByRole('button', { name: '保存' }));
        });

        await waitFor(() => {
            expect(mockCreate).toHaveBeenCalledWith(
                'event-1',
                expect.objectContaining({
                    title: '新しいタイトル',
                    content: '新しい内容',
                }),
            );
        });
    });

    it('編集フォーム送信で updateOtherItemAction を呼ぶ', async () => {
        const user = userEvent.setup();
        render(<OtherItemAdminPanel items={MOCK_ITEMS} eventId='event-1' />);

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

    it('削除ボタンクリック + confirm で deleteOtherItemAction を呼ぶ', async () => {
        const user = userEvent.setup();
        render(<OtherItemAdminPanel items={MOCK_ITEMS} eventId='event-1' />);

        const deleteButtons = screen.getAllByRole('button', { name: '削除' });
        await act(async () => {
            await user.click(deleteButtons[0]);
        });

        await waitFor(() => {
            expect(mockDelete).toHaveBeenCalledWith('event-1', '1');
        });
    });

    it('confirm キャンセル時は deleteOtherItemAction を呼ばない', async () => {
        const user = userEvent.setup();
        global.confirm = jest.fn<typeof confirm>().mockReturnValue(false);
        render(<OtherItemAdminPanel items={MOCK_ITEMS} eventId='event-1' />);

        const deleteButtons = screen.getAllByRole('button', { name: '削除' });
        await user.click(deleteButtons[0]);

        expect(mockDelete).not.toHaveBeenCalled();
    });

    it('アクション失敗時にエラーメッセージを表示する', async () => {
        const user = userEvent.setup();
        mockCreate.mockResolvedValue({
            success: false,
            error: '登録に失敗しました',
        });
        render(<OtherItemAdminPanel items={[]} eventId='event-1' />);

        await user.click(screen.getByRole('button', { name: '+ 追加' }));
        await user.type(screen.getByLabelText(/タイトル/), 'タイトル');
        await user.type(screen.getByLabelText(/内容/), '内容');

        await act(async () => {
            await user.click(screen.getByRole('button', { name: '保存' }));
        });

        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent(
                '登録に失敗しました',
            );
        });
    });

    it('必須項目が空の場合にバリデーションエラーを表示する', async () => {
        const user = userEvent.setup();
        render(<OtherItemAdminPanel items={[]} eventId='event-1' />);

        await user.click(screen.getByRole('button', { name: '+ 追加' }));
        await user.click(screen.getByRole('button', { name: '保存' }));

        expect(screen.getByRole('alert')).toHaveTextContent(
            'タイトルと内容は必須です',
        );
        expect(mockCreate).not.toHaveBeenCalled();
    });

    it('画像を選択して保存すると uploadOtherItemImageAction を呼ぶ', async () => {
        const user = userEvent.setup();
        render(<OtherItemAdminPanel items={[]} eventId='event-1' />);

        await user.click(screen.getByRole('button', { name: '+ 追加' }));
        await user.type(screen.getByLabelText(/タイトル/), '画像付きお知らせ');
        await user.type(screen.getByLabelText(/内容/), '本文');
        const fileInput = screen.getByLabelText(/画像ファイル/);
        const file = new File(['dummy'], 'other.png', { type: 'image/png' });
        await user.upload(fileInput, file);

        await act(async () => {
            await user.click(screen.getByRole('button', { name: '保存' }));
        });

        await waitFor(() => {
            expect(mockUploadImage).toHaveBeenCalledTimes(1);
        });
    });
});
