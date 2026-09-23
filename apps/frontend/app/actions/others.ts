'use server';

import { logAction, logActionError } from '@frontend/app/lib/actionLogger';
import {
    buildBackendUrl,
    fetchFromBackend,
} from '@frontend/app/lib/backendFetch';
import { cookies } from 'next/headers';

type UploadImageResult =
    | { success: true; imageKey: string }
    | { success: false; error: string };

type OtherItemData = {
    id: string;
    title: string;
    content: string;
    imageUrl: string | null;
    displayOrder: number;
};

type OtherItemsResult =
    | { success: true; data: OtherItemData[] }
    | { success: false; error: string };

async function getAuthToken(): Promise<string | null> {
    const store = await cookies();
    return store.get('auth_token')?.value ?? null;
}

export async function uploadOtherItemImageAction(
    eventId: string,
    formData: FormData,
): Promise<UploadImageResult> {
    const authToken = await getAuthToken();
    if (!authToken) return { success: false, error: '認証が必要です' };

    const endpoint = '/api/others/upload';
    try {
        const res = await fetchFromBackend(endpoint, {
            method: 'POST',
            headers: {
                Cookie: `auth_token=${authToken}`,
                'x-event-id': eventId,
            },
            body: formData,
        });
        logAction(
            'uploadOtherItemImageAction',
            'POST',
            buildBackendUrl(endpoint),
            res.status,
        );
        if (!res.ok) {
            const body = (await res.json()) as { error?: string };
            return {
                success: false,
                error: body.error ?? '画像のアップロードに失敗しました',
            };
        }
        const body = (await res.json()) as { imageKey: string };
        return { success: true, imageKey: body.imageKey };
    } catch (err) {
        logActionError(
            'uploadOtherItemImageAction',
            'POST',
            buildBackendUrl(endpoint),
            err,
        );
        return { success: false, error: '画像のアップロードに失敗しました' };
    }
}

export async function createOtherItemAction(
    eventId: string,
    data: {
        title: string;
        content: string;
        image_key?: string | null;
        display_order: number;
    },
): Promise<OtherItemsResult> {
    const authToken = await getAuthToken();
    if (!authToken) return { success: false, error: '認証が必要です' };

    const endpoint = '/api/others';
    try {
        const res = await fetchFromBackend(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Cookie: `auth_token=${authToken}`,
                'x-event-id': eventId,
            },
            body: JSON.stringify({ event_id: eventId, ...data }),
        });
        logAction(
            'createOtherItemAction',
            'POST',
            buildBackendUrl(endpoint),
            res.status,
        );
        if (!res.ok) {
            const body = (await res.json()) as { error?: string };
            return {
                success: false,
                error: body.error ?? '登録に失敗しました',
            };
        }
        const snapshot = await fetchOtherItemsSnapshot(eventId, authToken);
        if (!snapshot.success) {
            return snapshot;
        }
        return snapshot;
    } catch (err) {
        logActionError(
            'createOtherItemAction',
            'POST',
            buildBackendUrl(endpoint),
            err,
        );
        return { success: false, error: '登録に失敗しました' };
    }
}

export async function updateOtherItemAction(
    eventId: string,
    id: string,
    data: {
        title?: string;
        content?: string;
        image_key?: string | null;
        display_order?: number;
    },
): Promise<OtherItemsResult> {
    const authToken = await getAuthToken();
    if (!authToken) return { success: false, error: '認証が必要です' };

    const endpoint = `/api/others/${id}`;
    try {
        const res = await fetchFromBackend(endpoint, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Cookie: `auth_token=${authToken}`,
                'x-event-id': eventId,
            },
            body: JSON.stringify(data),
        });
        logAction(
            'updateOtherItemAction',
            'PUT',
            buildBackendUrl(endpoint),
            res.status,
        );
        if (!res.ok) {
            const body = (await res.json()) as { error?: string };
            return {
                success: false,
                error: body.error ?? '更新に失敗しました',
            };
        }
        const snapshot = await fetchOtherItemsSnapshot(eventId, authToken);
        if (!snapshot.success) {
            return snapshot;
        }
        return snapshot;
    } catch (err) {
        logActionError(
            'updateOtherItemAction',
            'PUT',
            buildBackendUrl(endpoint),
            err,
        );
        return { success: false, error: '更新に失敗しました' };
    }
}

export async function deleteOtherItemAction(
    eventId: string,
    id: string,
): Promise<OtherItemsResult> {
    const authToken = await getAuthToken();
    if (!authToken) return { success: false, error: '認証が必要です' };

    const endpoint = `/api/others/${id}`;
    try {
        const res = await fetchFromBackend(endpoint, {
            method: 'DELETE',
            headers: {
                Cookie: `auth_token=${authToken}`,
                'x-event-id': eventId,
            },
        });
        logAction(
            'deleteOtherItemAction',
            'DELETE',
            buildBackendUrl(endpoint),
            res.status,
        );
        if (!res.ok) {
            const body = (await res.json()) as { error?: string };
            return {
                success: false,
                error: body.error ?? '削除に失敗しました',
            };
        }
        const snapshot = await fetchOtherItemsSnapshot(eventId, authToken);
        if (!snapshot.success) {
            return snapshot;
        }
        return snapshot;
    } catch (err) {
        logActionError(
            'deleteOtherItemAction',
            'DELETE',
            buildBackendUrl(endpoint),
            err,
        );
        return { success: false, error: '削除に失敗しました' };
    }
}

async function fetchOtherItemsSnapshot(
    eventId: string,
    authToken: string,
): Promise<OtherItemsResult> {
    const endpoint = '/api/others';
    try {
        const res = await fetchFromBackend(endpoint, {
            headers: {
                Cookie: `auth_token=${authToken}`,
                'x-event-id': eventId,
            },
        });
        logAction(
            'fetchOtherItemsSnapshot',
            'GET',
            buildBackendUrl(endpoint),
            res.status,
        );
        let body: unknown = null;
        try {
            body = await res.json();
        } catch {
            body = null;
        }
        if (!res.ok) {
            const errorBody = body as { error?: string } | null;
            return {
                success: false,
                error: errorBody?.error ?? '最新データの取得に失敗しました',
            };
        }
        const list = (body as { items?: OtherItemData[] } | null)?.items;
        if (!Array.isArray(list)) {
            return { success: false, error: '最新データの取得に失敗しました' };
        }
        return { success: true, data: list };
    } catch (err) {
        logActionError(
            'fetchOtherItemsSnapshot',
            'GET',
            buildBackendUrl(endpoint),
            err,
        );
        return { success: false, error: '最新データの取得に失敗しました' };
    }
}
