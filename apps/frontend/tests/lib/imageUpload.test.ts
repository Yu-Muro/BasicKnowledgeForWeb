import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('@frontend/app/lib/backendFetch', () => ({
    fetchFromBackend: jest.fn(),
}));

const backendFetch =
    require('@frontend/app/lib/backendFetch') as typeof import('@frontend/app/lib/backendFetch');
const { uploadImage } =
    require('@frontend/app/lib/imageUpload') as typeof import('@frontend/app/lib/imageUpload');

const mockFetchFromBackend = jest.mocked(backendFetch.fetchFromBackend);

beforeEach(() => {
    jest.resetAllMocks();
});

describe('uploadImage', () => {
    it('画像をServer ActionではなくアップロードAPIへ直接送信する', async () => {
        mockFetchFromBackend.mockResolvedValue(
            new Response(
                JSON.stringify({
                    imageKey: 'shop-items/event-1/image.png',
                }),
                { headers: { 'Content-Type': 'application/json' } },
            ),
        );
        const file = new File(
            [new Uint8Array(1.5 * 1024 * 1024)],
            'image.png',
            { type: 'image/png' },
        );

        const result = await uploadImage(
            '/api/shop-items/upload',
            'event-1',
            file,
        );

        expect(result).toEqual({
            success: true,
            imageKey: 'shop-items/event-1/image.png',
        });
        expect(mockFetchFromBackend).toHaveBeenCalledWith(
            '/api/shop-items/upload',
            expect.objectContaining({
                method: 'POST',
                credentials: 'include',
                headers: { 'x-event-id': 'event-1' },
            }),
        );
        const request = mockFetchFromBackend.mock.calls[0]?.[1];
        const uploadedFile = (request?.body as FormData).get('file');
        expect(uploadedFile).toBeInstanceOf(File);
        expect((uploadedFile as File).size).toBe(file.size);
    });

    it('APIのエラーメッセージを返す', async () => {
        mockFetchFromBackend.mockResolvedValue(
            new Response(
                JSON.stringify({ error: '画像を保存できませんでした' }),
                {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' },
                },
            ),
        );

        const result = await uploadImage(
            '/api/programs/upload',
            'event-1',
            new File(['image'], 'image.png', { type: 'image/png' }),
        );

        expect(result).toEqual({
            success: false,
            error: '画像を保存できませんでした',
        });
    });

    it('成功レスポンスにimageKeyがなければエラーを返す', async () => {
        mockFetchFromBackend.mockResolvedValue(
            new Response(JSON.stringify({}), {
                headers: { 'Content-Type': 'application/json' },
            }),
        );

        const result = await uploadImage(
            '/api/others/upload',
            'event-1',
            new File(['image'], 'image.png', { type: 'image/png' }),
        );

        expect(result).toEqual({
            success: false,
            error: '画像のアップロード結果が不正です',
        });
    });
});
