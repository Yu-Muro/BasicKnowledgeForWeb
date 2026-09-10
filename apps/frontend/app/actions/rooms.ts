'use server';

import { logAction, logActionError } from '@frontend/app/lib/actionLogger';
import {
    buildBackendUrl,
    fetchFromBackend,
} from '@frontend/app/lib/backendFetch';
import { cookies } from 'next/headers';

type RoomData = {
    id: string;
    buildingName: string;
    floor: string;
    roomName: string;
    preDayManagerId: string | null;
    preDayManagerName: string | null;
    preDayPurpose: string | null;
    dayManagerId: string;
    dayManagerName: string;
    dayPurpose: string;
    notes: string | null;
};

type RoomsResult =
    | { success: true; data: RoomData[] }
    | { success: false; error: string };

async function getAuthToken(): Promise<string | null> {
    const store = await cookies();
    return store.get('auth_token')?.value ?? null;
}

export async function createRoomAction(
    eventId: string,
    data: {
        building_name: string;
        floor: string;
        room_name: string;
        day_manager_id: string;
        day_purpose: string;
        pre_day_manager_id?: string | null;
        pre_day_purpose?: string | null;
        notes?: string | null;
    },
): Promise<RoomsResult> {
    const authToken = await getAuthToken();
    if (!authToken) return { success: false, error: '認証が必要です' };

    const endpoint = '/api/rooms';
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
            'createRoomAction',
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
        const snapshot = await fetchRoomsSnapshot(eventId, authToken);
        if (!snapshot.success) {
            return snapshot;
        }
        return snapshot;
    } catch (err) {
        logActionError(
            'createRoomAction',
            'POST',
            buildBackendUrl(endpoint),
            err,
        );
        return { success: false, error: '登録に失敗しました' };
    }
}

export async function updateRoomAction(
    eventId: string,
    id: string,
    data: {
        building_name?: string;
        floor?: string;
        room_name?: string;
        day_manager_id?: string;
        day_purpose?: string;
        pre_day_manager_id?: string | null;
        pre_day_purpose?: string | null;
        notes?: string | null;
    },
): Promise<RoomsResult> {
    const authToken = await getAuthToken();
    if (!authToken) return { success: false, error: '認証が必要です' };

    const endpoint = `/api/rooms/${id}`;
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
            'updateRoomAction',
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
        const snapshot = await fetchRoomsSnapshot(eventId, authToken);
        if (!snapshot.success) {
            return snapshot;
        }
        return snapshot;
    } catch (err) {
        logActionError(
            'updateRoomAction',
            'PUT',
            buildBackendUrl(endpoint),
            err,
        );
        return { success: false, error: '更新に失敗しました' };
    }
}

export async function deleteRoomAction(
    eventId: string,
    id: string,
): Promise<RoomsResult> {
    const authToken = await getAuthToken();
    if (!authToken) return { success: false, error: '認証が必要です' };

    const endpoint = `/api/rooms/${id}`;
    try {
        const res = await fetchFromBackend(endpoint, {
            method: 'DELETE',
            headers: {
                Cookie: `auth_token=${authToken}`,
                'x-event-id': eventId,
            },
        });
        logAction(
            'deleteRoomAction',
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
        const snapshot = await fetchRoomsSnapshot(eventId, authToken);
        if (!snapshot.success) {
            return snapshot;
        }
        return snapshot;
    } catch (err) {
        logActionError(
            'deleteRoomAction',
            'DELETE',
            buildBackendUrl(endpoint),
            err,
        );
        return { success: false, error: '削除に失敗しました' };
    }
}

async function fetchRoomsSnapshot(
    eventId: string,
    authToken: string,
): Promise<RoomsResult> {
    const endpoint = '/api/rooms';
    try {
        const res = await fetchFromBackend(endpoint, {
            headers: {
                Cookie: `auth_token=${authToken}`,
                'x-event-id': eventId,
            },
        });
        logAction(
            'fetchRoomsSnapshot',
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
        const list = (body as { rooms?: RoomData[] } | null)?.rooms;
        if (!Array.isArray(list)) {
            return { success: false, error: '最新データの取得に失敗しました' };
        }
        return { success: true, data: list };
    } catch (err) {
        logActionError(
            'fetchRoomsSnapshot',
            'GET',
            buildBackendUrl(endpoint),
            err,
        );
        return { success: false, error: '最新データの取得に失敗しました' };
    }
}
