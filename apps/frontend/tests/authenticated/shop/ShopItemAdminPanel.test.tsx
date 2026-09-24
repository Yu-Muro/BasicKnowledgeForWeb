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

jest.mock('@frontend/app/actions/shop-items', () => ({
    createShopItemAction: jest.fn(),
    updateShopItemAction: jest.fn(),
    deleteShopItemAction: jest.fn(),
}));

jest.mock('@frontend/app/lib/imageUpload', () => ({
    uploadImage: jest.fn(),
}));

// next/image はテスト環境では通常の img タグにフォールバック
jest.mock('next/image', () => ({
    __esModule: true,
    default: ({ src, alt }: { src: string; alt: string }) => (
        // biome-ignore lint/a11y/useAltText: テスト用モック
        <img src={src} alt={alt} />
    ),
}));

const actions =
    require('@frontend/app/actions/shop-items') as typeof import('@frontend/app/actions/shop-items');
const imageUpload =
    require('@frontend/app/lib/imageUpload') as typeof import('@frontend/app/lib/imageUpload');
const ShopItemAdminPanel =
    require('@frontend/app/(authenticated)/shop/ShopItemAdminPanel')
        .default as typeof import('@frontend/app/(authenticated)/shop/ShopItemAdminPanel').default;

const mockCreate = jest.mocked(actions.createShopItemAction);
const mockUpdate = jest.mocked(actions.updateShopItemAction);
const mockDelete = jest.mocked(actions.deleteShopItemAction);
const mockUploadImage = jest.mocked(imageUpload.uploadImage);

const MOCK_ITEMS = [
    {
        id: '1',
        name: 'オリジナルTシャツ',
        price: 2000,
        description: null,
        imageUrl: 'https://assets.example.com/tshirt.webp',
    },
    {
        id: '2',
        name: '缶バッジセット',
        price: 500,
        description: '3個セット\n台紙付き',
        imageUrl: 'https://assets.example.com/badge.webp',
    },
];

const CREATED_ITEM = {
    id: 'created-id',
    name: '新商品',
    price: 0,
    description: null,
    imageUrl: 'https://assets.example.com/new.webp',
};

beforeEach(() => {
    jest.resetAllMocks();
    global.confirm = jest.fn<typeof confirm>().mockReturnValue(true);
    global.fetch = jest.fn<typeof fetch>().mockResolvedValue(
        new Response(null, { status: 200 }),
    );
    mockCreate.mockResolvedValue({
        success: true,
        data: [...MOCK_ITEMS, CREATED_ITEM],
    });
    mockUpdate.mockResolvedValue({ success: true, data: MOCK_ITEMS });
    mockDelete.mockResolvedValue({
        success: true,
        data: MOCK_ITEMS.slice(1),
    });
});

describe('ShopItemAdminPanel', () => {
    it('新規追加成功時にフォームを閉じて一覧を更新する', async () => {
        const user = userEvent.setup();
        mockUploadImage.mockResolvedValue({
            success: true,
            imageKey: 'shop-items/event-1/new.webp',
        });
        render(<ShopItemAdminPanel items={[]} eventId='event-1' />);

        await user.click(screen.getByRole('button', { name: '+ 追加' }));
        await user.type(screen.getByLabelText(/商品名/), '新商品');
        const fileInput = screen.getByLabelText(/画像ファイル/);
        const file = new File(['dummy'], 'dummy.png', { type: 'image/png' });
        await user.upload(fileInput, file);

        await user.click(screen.getByRole('button', { name: '保存' }));

        await waitFor(() => {
            expect(mockUploadImage).toHaveBeenCalledWith(
                '/api/shop-items/upload',
                'event-1',
                file,
            );
            expect(mockCreate).toHaveBeenCalledWith('event-1', {
                name: '新商品',
                price: 0,
                image_key: 'shop-items/event-1/new.webp',
                description: null,
            });
        });
        expect(
            screen.queryByText('新しい販売物を追加'),
        ).not.toBeInTheDocument();
        expect(screen.getAllByText('新商品').length).toBeGreaterThan(0);
    });

    it('販売物一覧を表示する', () => {
        render(<ShopItemAdminPanel items={MOCK_ITEMS} eventId='event-1' />);

        expect(screen.getAllByText('オリジナルTシャツ')[0]).toBeInTheDocument();
        expect(screen.getAllByText('缶バッジセット')[0]).toBeInTheDocument();
    });

    it('各アイテムに編集・削除ボタンを表示する', () => {
        render(<ShopItemAdminPanel items={MOCK_ITEMS} eventId='event-1' />);

        expect(screen.getAllByRole('button', { name: '編集' })).toHaveLength(4);
        expect(screen.getAllByRole('button', { name: '削除' })).toHaveLength(4);
    });

    it('アイテムがない場合に空メッセージを表示する', () => {
        render(<ShopItemAdminPanel items={[]} eventId='event-1' />);

        expect(
            screen.getByText('登録されている販売物はありません'),
        ).toBeInTheDocument();
    });

    it('+ 追加 ボタンクリックでフォームを表示する', async () => {
        const user = userEvent.setup();
        render(<ShopItemAdminPanel items={MOCK_ITEMS} eventId='event-1' />);

        await user.click(screen.getByRole('button', { name: '+ 追加' }));

        expect(screen.getByText('新しい販売物を追加')).toBeInTheDocument();
        expect(screen.getByLabelText(/商品名/)).toBeInTheDocument();
    });

    it('キャンセルボタンでフォームを閉じる', async () => {
        const user = userEvent.setup();
        render(<ShopItemAdminPanel items={MOCK_ITEMS} eventId='event-1' />);

        await user.click(screen.getByRole('button', { name: '+ 追加' }));
        await user.click(screen.getByRole('button', { name: 'キャンセル' }));

        expect(
            screen.queryByText('新しい販売物を追加'),
        ).not.toBeInTheDocument();
    });

    it('編集ボタンで既存データがフォームに入力済みになる', async () => {
        const user = userEvent.setup();
        render(<ShopItemAdminPanel items={MOCK_ITEMS} eventId='event-1' />);

        const editButtons = screen.getAllByRole('button', { name: '編集' });
        await user.click(editButtons[0]);

        expect(screen.getByText('販売物を編集')).toBeInTheDocument();
        expect(screen.getByLabelText(/商品名/)).toHaveValue('オリジナルTシャツ');
        expect(screen.getByLabelText(/価格/)).toHaveValue(2000);
    });

    it('商品名が空の場合にバリデーションエラーを表示する', async () => {
        const user = userEvent.setup();
        render(<ShopItemAdminPanel items={[]} eventId='event-1' />);

        await user.click(screen.getByRole('button', { name: '+ 追加' }));
        await user.click(screen.getByRole('button', { name: '保存' }));

        expect(screen.getByRole('alert')).toHaveTextContent(
            '商品名は必須です',
        );
        expect(mockCreate).not.toHaveBeenCalled();
    });

    it('新規追加時に画像未選択でエラーを表示する', async () => {
        const user = userEvent.setup();
        render(<ShopItemAdminPanel items={[]} eventId='event-1' />);

        await user.click(screen.getByRole('button', { name: '+ 追加' }));
        await user.type(screen.getByLabelText(/商品名/), 'テスト商品');

        await user.click(screen.getByRole('button', { name: '保存' }));

        expect(screen.getByRole('alert')).toHaveTextContent(
            '新規追加時は画像が必須です',
        );
    });

    it('削除ボタンクリック + confirm で deleteShopItemAction を呼び一覧を更新する', async () => {
        const user = userEvent.setup();
        render(<ShopItemAdminPanel items={MOCK_ITEMS} eventId='event-1' />);

        const deleteButtons = screen.getAllByRole('button', { name: '削除' });
        await act(async () => {
            await user.click(deleteButtons[0]);
        });

        await waitFor(() => {
            expect(mockDelete).toHaveBeenCalledWith('event-1', '1');
        });
        expect(screen.queryByText('オリジナルTシャツ')).not.toBeInTheDocument();
    });

    it('confirm キャンセル時は deleteShopItemAction を呼ばない', async () => {
        const user = userEvent.setup();
        global.confirm = jest.fn<typeof confirm>().mockReturnValue(false);
        render(<ShopItemAdminPanel items={MOCK_ITEMS} eventId='event-1' />);

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
        render(<ShopItemAdminPanel items={MOCK_ITEMS} eventId='event-1' />);

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

    it('価格を正しくフォーマットして表示する', () => {
        render(<ShopItemAdminPanel items={MOCK_ITEMS} eventId='event-1' />);

        expect(screen.getAllByText('¥2,000')[0]).toBeInTheDocument();
        expect(screen.getAllByText('¥500')[0]).toBeInTheDocument();
    });

    it('説明がある場合に表示する', () => {
        render(<ShopItemAdminPanel items={MOCK_ITEMS} eventId='event-1' />);

        const descriptions = screen.getAllByText(
            (_, element) =>
                element?.classList.contains('whitespace-pre-wrap') === true &&
                element.textContent?.includes('3個セット') === true &&
                element.textContent?.includes('台紙付き') === true,
        );
        expect(descriptions[0]).toBeInTheDocument();
        descriptions.forEach((element) => {
            expect(element).toHaveClass('whitespace-pre-wrap');
        });
    });
});
