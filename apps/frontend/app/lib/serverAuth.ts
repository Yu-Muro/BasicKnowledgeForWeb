import { cookies } from 'next/headers';
import { cache } from 'react';
import { AuthLookupError, fetchCurrentUser } from './authLookup';

export type AuthPayload = {
    id: string;
    name: string;
    email: string;
    role: string;
    departmentId?: string | null;
    exp?: number;
};
export type AccessPayload = { event_id: string; exp?: number };

const textDecoder = new TextDecoder();

function normalizeBase64(input: string): string {
    const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
    const padding = (4 - (normalized.length % 4)) % 4;
    return normalized.padEnd(normalized.length + padding, '=');
}

export function decodeJwtPayload<T>(token: string): T | null {
    try {
        const segment = token.split('.')[1];
        if (!segment) return null;
        const base64 = normalizeBase64(segment);
        const binary = atob(base64);
        const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
        const json = textDecoder.decode(bytes);
        return JSON.parse(json) as T;
    } catch {
        return null;
    }
}

function isTokenExpired(payload: { exp?: number } | null): boolean {
    if (!payload?.exp) {
        return false;
    }
    const now = Math.floor(Date.now() / 1000);
    return payload.exp <= now;
}

export type ResolvedAuth = {
    eventId: string | null;
    authToken: string | null;
    accessToken: string | null;
    role: string;
    user?: AuthPayload | null;
};

const resolveSession = cache(async () => {
    const cookieStore = await cookies();
    const rawAuthToken = cookieStore.get('auth_token')?.value ?? null;
    const rawAccessToken = cookieStore.get('access_token')?.value ?? null;

    const authPayload = rawAuthToken
        ? decodeJwtPayload<AuthPayload>(rawAuthToken)
        : null;
    const accessPayload = rawAccessToken
        ? decodeJwtPayload<AccessPayload>(rawAccessToken)
        : null;

    const validAuthPayload =
        authPayload && !isTokenExpired(authPayload) ? authPayload : null;
    const validAccessPayload =
        accessPayload && !isTokenExpired(accessPayload) ? accessPayload : null;

    let currentUser: AuthPayload | null = null;
    let authError: AuthLookupError | null = null;
    if (validAuthPayload && rawAuthToken) {
        try {
            currentUser = await fetchCurrentUser(rawAuthToken);
        } catch (error) {
            authError =
                error instanceof AuthLookupError
                    ? error
                    : new AuthLookupError();
        }
    }
    const authToken = currentUser ? rawAuthToken : null;
    const accessToken = validAccessPayload ? rawAccessToken : null;

    const role = currentUser?.role ?? 'user';
    return {
        authToken,
        accessToken,
        role,
        user: currentUser,
        accessPayload: validAccessPayload,
        authError,
    };
});

export async function resolveAuth(
    searchParamEventId?: string,
    options: { allowAccessFallback?: boolean } = {},
): Promise<ResolvedAuth> {
    const { authToken, accessToken, role, user, accessPayload, authError } =
        await resolveSession();
    if (authError && !(options.allowAccessFallback && accessToken))
        throw authError;
    const eventId =
        role === 'admin'
            ? (searchParamEventId ?? null)
            : (accessPayload?.event_id ?? null);
    return { eventId, authToken, accessToken, role, user };
}

export function buildContentFetchHeaders(
    eventId: string,
    authToken: string | null,
    accessToken: string | null,
    role: string,
): HeadersInit {
    const isPrivileged = role === 'admin';
    const headers: HeadersInit = {
        'x-event-id': eventId,
    };

    if (isPrivileged) {
        if (authToken) {
            headers.Cookie = `auth_token=${authToken}`;
        }
    } else if (accessToken) {
        headers.Cookie = `access_token=${accessToken}`;
    }

    return headers;
}
