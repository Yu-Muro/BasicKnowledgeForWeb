import { fetchFromBackend } from '@frontend/app/lib/backendFetch';

type ImageUploadEndpoint =
    | '/api/programs/upload'
    | '/api/shop-items/upload'
    | '/api/others/upload';

export type ImageUploadResult =
    | { success: true; imageKey: string }
    | { success: false; error: string };

export async function uploadImage(
    endpoint: ImageUploadEndpoint,
    eventId: string,
    file: File,
): Promise<ImageUploadResult> {
    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetchFromBackend(endpoint, {
            method: 'POST',
            credentials: 'include',
            headers: { 'x-event-id': eventId },
            body: formData,
        });

        let body: { imageKey?: unknown; error?: unknown } | null = null;
        try {
            body = (await response.json()) as {
                imageKey?: unknown;
                error?: unknown;
            };
        } catch {
            body = null;
        }

        if (!response.ok) {
            return {
                success: false,
                error:
                    typeof body?.error === 'string'
                        ? body.error
                        : '画像のアップロードに失敗しました',
            };
        }

        if (typeof body?.imageKey !== 'string' || !body.imageKey) {
            return {
                success: false,
                error: '画像のアップロード結果が不正です',
            };
        }

        return { success: true, imageKey: body.imageKey };
    } catch {
        return { success: false, error: '画像のアップロードに失敗しました' };
    }
}
