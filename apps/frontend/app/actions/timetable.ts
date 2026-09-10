'use server';

import { logAction, logActionError } from '@frontend/app/lib/actionLogger';
import {
    buildBackendUrl,
    fetchFromBackend,
} from '@frontend/app/lib/backendFetch';
import { cookies } from 'next/headers';

type TimetableItemData = {
    id: string;
    title: string;
    startTime: string;
    location: string;
    description: string | null;
};

type TimetableResult =
    | { success: true; data: TimetableItemData[] }
    | { success: false; error: string };

async function getAuthToken(): Promise<string | null> {
    const store = await cookies();
    return store.get('auth_token')?.value ?? null;
}

export async function createTimetableItemAction(
    eventId: string,
    data: {
        title: string;
        start_time: string;
        location?: string;
        description?: string | null;
    },
): Promise<TimetableResult> {
    const authToken = await getAuthToken();
    if (!authToken) return { success: false, error: '認証が必要です' };

    const endpoint = '/api/timetable';
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
            'createTimetableItemAction',
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
        const snapshot = await fetchTimetableSnapshot(eventId, authToken);
        if (!snapshot.success) {
            return snapshot;
        }
        return snapshot;
    } catch (err) {
        logActionError(
            'createTimetableItemAction',
            'POST',
            buildBackendUrl(endpoint),
            err,
        );
        return { success: false, error: '登録に失敗しました' };
    }
}

export async function updateTimetableItemAction(
    eventId: string,
    id: string,
    data: {
        title?: string;
        start_time?: string;
        location?: string;
        description?: string | null;
    },
): Promise<TimetableResult> {
    const authToken = await getAuthToken();
    if (!authToken) return { success: false, error: '認証が必要です' };

    const endpoint = `/api/timetable/${id}`;
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
            'updateTimetableItemAction',
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
        const snapshot = await fetchTimetableSnapshot(eventId, authToken);
        if (!snapshot.success) {
            return snapshot;
        }
        return snapshot;
    } catch (err) {
        logActionError(
            'updateTimetableItemAction',
            'PUT',
            buildBackendUrl(endpoint),
            err,
        );
        return { success: false, error: '更新に失敗しました' };
    }
}

export async function deleteTimetableItemAction(
    eventId: string,
    id: string,
): Promise<TimetableResult> {
    const authToken = await getAuthToken();
    if (!authToken) return { success: false, error: '認証が必要です' };

    const endpoint = `/api/timetable/${id}`;
    try {
        const res = await fetchFromBackend(endpoint, {
            method: 'DELETE',
            headers: {
                Cookie: `auth_token=${authToken}`,
                'x-event-id': eventId,
            },
        });
        logAction(
            'deleteTimetableItemAction',
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
        const snapshot = await fetchTimetableSnapshot(eventId, authToken);
        if (!snapshot.success) {
            return snapshot;
        }
        return snapshot;
    } catch (err) {
        logActionError(
            'deleteTimetableItemAction',
            'DELETE',
            buildBackendUrl(endpoint),
            err,
        );
        return { success: false, error: '削除に失敗しました' };
    }
}

async function fetchTimetableSnapshot(
    eventId: string,
    authToken: string,
): Promise<TimetableResult> {
    const endpoint = '/api/timetable';
    try {
        const res = await fetchFromBackend(endpoint, {
            headers: {
                Cookie: `auth_token=${authToken}`,
                'x-event-id': eventId,
            },
        });
        logAction(
            'fetchTimetableSnapshot',
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
        const list = (body as { items?: TimetableItemData[] } | null)?.items;
        if (!Array.isArray(list)) {
            return { success: false, error: '最新データの取得に失敗しました' };
        }
        return { success: true, data: list };
    } catch (err) {
        logActionError(
            'fetchTimetableSnapshot',
            'GET',
            buildBackendUrl(endpoint),
            err,
        );
        return { success: false, error: '最新データの取得に失敗しました' };
    }
}
