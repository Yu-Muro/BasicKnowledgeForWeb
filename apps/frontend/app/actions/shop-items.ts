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

type ShopItemData = {
    id: string;
    name: string;
    price: number;
    description: string | null;
    imageUrl: string;
};

type ShopItemsResult =
    | { success: true; data: ShopItemData[] }
    | { success: false; error: string };

async function getAuthToken(): Promise<string | null> {
    const store = await cookies();
    return store.get('auth_token')?.value ?? null;
}

export async function uploadShopItemImageAction(
    eventId: string,
    formData: FormData,
): Promise<UploadImageResult> {
    const authToken = await getAuthToken();
    if (!authToken) return { success: false, error: '認証が必要です' };

    const endpoint = '/api/shop-items/upload';
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
            'uploadShopItemImageAction',
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
            'uploadShopItemImageAction',
            'POST',
            buildBackendUrl(endpoint),
            err,
        );
        return { success: false, error: '画像のアップロードに失敗しました' };
    }
}

export async function createShopItemAction(
    eventId: string,
    data: {
        name: string;
        price: number;
        image_key: string;
        description?: string | null;
    },
): Promise<ShopItemsResult> {
    const authToken = await getAuthToken();
    if (!authToken) return { success: false, error: '認証が必要です' };

    const endpoint = '/api/shop-items';
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
            'createShopItemAction',
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
        const snapshot = await fetchShopItemsSnapshot(eventId, authToken);
        if (!snapshot.success) {
            return snapshot;
        }
        return snapshot;
    } catch (err) {
        logActionError(
            'createShopItemAction',
            'POST',
            buildBackendUrl(endpoint),
            err,
        );
        return { success: false, error: '登録に失敗しました' };
    }
}

export async function updateShopItemAction(
    eventId: string,
    id: string,
    data: {
        name?: string;
        price?: number;
        image_key?: string;
        description?: string | null;
    },
): Promise<ShopItemsResult> {
    const authToken = await getAuthToken();
    if (!authToken) return { success: false, error: '認証が必要です' };

    const endpoint = `/api/shop-items/${id}`;
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
            'updateShopItemAction',
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
        const snapshot = await fetchShopItemsSnapshot(eventId, authToken);
        if (!snapshot.success) {
            return snapshot;
        }
        return snapshot;
    } catch (err) {
        logActionError(
            'updateShopItemAction',
            'PUT',
            buildBackendUrl(endpoint),
            err,
        );
        return { success: false, error: '更新に失敗しました' };
    }
}

export async function deleteShopItemAction(
    eventId: string,
    id: string,
): Promise<ShopItemsResult> {
    const authToken = await getAuthToken();
    if (!authToken) return { success: false, error: '認証が必要です' };

    const endpoint = `/api/shop-items/${id}`;
    try {
        const res = await fetchFromBackend(endpoint, {
            method: 'DELETE',
            headers: {
                Cookie: `auth_token=${authToken}`,
                'x-event-id': eventId,
            },
        });
        logAction(
            'deleteShopItemAction',
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
        const snapshot = await fetchShopItemsSnapshot(eventId, authToken);
        if (!snapshot.success) {
            return snapshot;
        }
        return snapshot;
    } catch (err) {
        logActionError(
            'deleteShopItemAction',
            'DELETE',
            buildBackendUrl(endpoint),
            err,
        );
        return { success: false, error: '削除に失敗しました' };
    }
}

async function fetchShopItemsSnapshot(
    eventId: string,
    authToken: string,
): Promise<ShopItemsResult> {
    const endpoint = '/api/shop-items';
    try {
        const res = await fetchFromBackend(endpoint, {
            headers: {
                Cookie: `auth_token=${authToken}`,
                'x-event-id': eventId,
            },
        });
        logAction(
            'fetchShopItemsSnapshot',
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
        const list = (body as { items?: ShopItemData[] } | null)?.items;
        if (!Array.isArray(list)) {
            return { success: false, error: '最新データの取得に失敗しました' };
        }
        return { success: true, data: list };
    } catch (err) {
        logActionError(
            'fetchShopItemsSnapshot',
            'GET',
            buildBackendUrl(endpoint),
            err,
        );
        return { success: false, error: '最新データの取得に失敗しました' };
    }
}
