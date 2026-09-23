'use server';

import { logAction, logActionError } from '@frontend/app/lib/actionLogger';
import {
    buildBackendUrl,
    fetchFromBackend,
} from '@frontend/app/lib/backendFetch';
import { cookies } from 'next/headers';

type Department = { id: string; name: string };

type ActionResult =
    | { success: true; data: Department[] }
    | { success: false; error: string };

async function getAuthToken(): Promise<string | null> {
    const store = await cookies();
    return store.get('auth_token')?.value ?? null;
}

export async function createDepartmentAction(
    eventId: string,
    data: { name: string },
): Promise<ActionResult> {
    const authToken = await getAuthToken();
    if (!authToken) return { success: false, error: '認証が必要です' };

    const endpoint = '/api/departments';
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
            'createDepartmentAction',
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
        const snapshot = await fetchDepartmentsSnapshot(eventId, authToken);
        if (!snapshot.success) {
            return snapshot;
        }
        return snapshot;
    } catch (err) {
        logActionError(
            'createDepartmentAction',
            'POST',
            buildBackendUrl(endpoint),
            err,
        );
        return { success: false, error: '登録に失敗しました' };
    }
}

export async function updateDepartmentAction(
    eventId: string,
    id: string,
    data: { name?: string },
): Promise<ActionResult> {
    const authToken = await getAuthToken();
    if (!authToken) return { success: false, error: '認証が必要です' };

    const endpoint = `/api/departments/${id}`;
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
            'updateDepartmentAction',
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
        const snapshot = await fetchDepartmentsSnapshot(eventId, authToken);
        if (!snapshot.success) {
            return snapshot;
        }
        return snapshot;
    } catch (err) {
        logActionError(
            'updateDepartmentAction',
            'PUT',
            buildBackendUrl(endpoint),
            err,
        );
        return { success: false, error: '更新に失敗しました' };
    }
}

export async function deleteDepartmentAction(
    eventId: string,
    id: string,
): Promise<ActionResult> {
    const authToken = await getAuthToken();
    if (!authToken) return { success: false, error: '認証が必要です' };

    const endpoint = `/api/departments/${id}`;
    try {
        const res = await fetchFromBackend(endpoint, {
            method: 'DELETE',
            headers: {
                Cookie: `auth_token=${authToken}`,
                'x-event-id': eventId,
            },
        });
        logAction(
            'deleteDepartmentAction',
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
        const snapshot = await fetchDepartmentsSnapshot(eventId, authToken);
        if (!snapshot.success) {
            return snapshot;
        }
        return snapshot;
    } catch (err) {
        logActionError(
            'deleteDepartmentAction',
            'DELETE',
            buildBackendUrl(endpoint),
            err,
        );
        return { success: false, error: '削除に失敗しました' };
    }
}

export async function copyDepartmentsFromEventAction(
    eventId: string,
    sourceEventId: string,
): Promise<ActionResult> {
    const authToken = await getAuthToken();
    if (!authToken) return { success: false, error: '認証が必要です' };

    const endpoint = '/api/departments/copy';
    try {
        const res = await fetchFromBackend(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Cookie: `auth_token=${authToken}`,
                'x-event-id': eventId,
            },
            body: JSON.stringify({ source_event_id: sourceEventId }),
        });
        logAction(
            'copyDepartmentsFromEventAction',
            'POST',
            buildBackendUrl(endpoint),
            res.status,
        );
        if (!res.ok) {
            const body = (await res.json()) as { error?: string };
            return {
                success: false,
                error: body.error ?? '部署のコピーに失敗しました',
            };
        }
        const snapshot = await fetchDepartmentsSnapshot(eventId, authToken);
        if (!snapshot.success) {
            return snapshot;
        }
        return snapshot;
    } catch (err) {
        logActionError(
            'copyDepartmentsFromEventAction',
            'POST',
            buildBackendUrl(endpoint),
            err,
        );
        return { success: false, error: '部署のコピーに失敗しました' };
    }
}

async function fetchDepartmentsSnapshot(
    eventId: string,
    authToken: string,
): Promise<ActionResult> {
    const endpoint = '/api/departments';
    try {
        const res = await fetchFromBackend(endpoint, {
            headers: {
                Cookie: `auth_token=${authToken}`,
                'x-event-id': eventId,
            },
        });
        logAction(
            'fetchDepartmentsSnapshot',
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
                error: errorBody?.error ?? '最新の部署一覧の取得に失敗しました',
            };
        }
        const list = (body as { departments?: Department[] } | null)
            ?.departments;
        if (!Array.isArray(list)) {
            return {
                success: false,
                error: '最新の部署一覧の取得に失敗しました',
            };
        }
        return { success: true, data: list };
    } catch (err) {
        logActionError(
            'fetchDepartmentsSnapshot',
            'GET',
            buildBackendUrl(endpoint),
            err,
        );
        return {
            success: false,
            error: '最新の部署一覧の取得に失敗しました',
        };
    }
}
