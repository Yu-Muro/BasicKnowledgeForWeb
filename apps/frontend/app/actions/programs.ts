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

type ProgramData = {
    id: string;
    name: string;
    location: string;
    startTime: string;
    endTime: string;
    description: string | null;
    imageUrl: string | null;
};

type ProgramsResult =
    | { success: true; data: ProgramData[] }
    | { success: false; error: string };

async function getAuthToken(): Promise<string | null> {
    const store = await cookies();
    return store.get('auth_token')?.value ?? null;
}

export async function uploadProgramImageAction(
    eventId: string,
    formData: FormData,
): Promise<UploadImageResult> {
    const authToken = await getAuthToken();
    if (!authToken) return { success: false, error: '認証が必要です' };

    const endpoint = '/api/programs/upload';
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
            'uploadProgramImageAction',
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
            'uploadProgramImageAction',
            'POST',
            buildBackendUrl(endpoint),
            err,
        );
        return { success: false, error: '画像のアップロードに失敗しました' };
    }
}

export async function createProgramAction(
    eventId: string,
    data: {
        name: string;
        location: string;
        start_time: string;
        end_time: string;
        description?: string | null;
        image_key?: string | null;
    },
): Promise<ProgramsResult> {
    const authToken = await getAuthToken();
    if (!authToken) return { success: false, error: '認証が必要です' };

    const endpoint = '/api/programs';
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
            'createProgramAction',
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
        const snapshot = await fetchProgramsSnapshot(eventId, authToken);
        if (!snapshot.success) {
            return snapshot;
        }
        return snapshot;
    } catch (err) {
        logActionError(
            'createProgramAction',
            'POST',
            buildBackendUrl(endpoint),
            err,
        );
        return { success: false, error: '登録に失敗しました' };
    }
}

export async function updateProgramAction(
    eventId: string,
    id: string,
    data: {
        name?: string;
        location?: string;
        start_time?: string;
        end_time?: string;
        description?: string | null;
        image_key?: string | null;
    },
): Promise<ProgramsResult> {
    const authToken = await getAuthToken();
    if (!authToken) return { success: false, error: '認証が必要です' };

    const endpoint = `/api/programs/${id}`;
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
            'updateProgramAction',
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
        const snapshot = await fetchProgramsSnapshot(eventId, authToken);
        if (!snapshot.success) {
            return snapshot;
        }
        return snapshot;
    } catch (err) {
        logActionError(
            'updateProgramAction',
            'PUT',
            buildBackendUrl(endpoint),
            err,
        );
        return { success: false, error: '更新に失敗しました' };
    }
}

export async function deleteProgramAction(
    eventId: string,
    id: string,
): Promise<ProgramsResult> {
    const authToken = await getAuthToken();
    if (!authToken) return { success: false, error: '認証が必要です' };

    const endpoint = `/api/programs/${id}`;
    try {
        const res = await fetchFromBackend(endpoint, {
            method: 'DELETE',
            headers: {
                Cookie: `auth_token=${authToken}`,
                'x-event-id': eventId,
            },
        });
        logAction(
            'deleteProgramAction',
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
        const snapshot = await fetchProgramsSnapshot(eventId, authToken);
        if (!snapshot.success) {
            return snapshot;
        }
        return snapshot;
    } catch (err) {
        logActionError(
            'deleteProgramAction',
            'DELETE',
            buildBackendUrl(endpoint),
            err,
        );
        return { success: false, error: '削除に失敗しました' };
    }
}

async function fetchProgramsSnapshot(
    eventId: string,
    authToken: string,
): Promise<ProgramsResult> {
    const endpoint = '/api/programs';
    try {
        const res = await fetchFromBackend(endpoint, {
            headers: {
                Cookie: `auth_token=${authToken}`,
                'x-event-id': eventId,
            },
        });
        logAction(
            'fetchProgramsSnapshot',
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
        const list = (body as { programs?: ProgramData[] } | null)?.programs;
        if (!Array.isArray(list)) {
            return { success: false, error: '最新データの取得に失敗しました' };
        }
        return { success: true, data: list };
    } catch (err) {
        logActionError(
            'fetchProgramsSnapshot',
            'GET',
            buildBackendUrl(endpoint),
            err,
        );
        return { success: false, error: '最新データの取得に失敗しました' };
    }
}
