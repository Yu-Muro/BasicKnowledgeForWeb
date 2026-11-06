const FALLBACK_API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

const MAX_LOG_BODY_LENGTH = 4000;
const REDACTED = '[REDACTED]';
const NO_STORE_CACHE_CONTROL_VALUE = 'no-store, no-cache, must-revalidate';

const isVerboseBackendFetchLogEnabled = () =>
    process.env.BACKEND_FETCH_LOG === '1' ||
    (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test');

type CloudflareContext = {
    env?: CloudflareEnv;
};

const CLOUDFLARE_CONTEXT_SYMBOL = Symbol.for('__cloudflare-context__');

const getCloudflareContext = (): CloudflareContext | undefined => {
    if (typeof globalThis === 'undefined') {
        return undefined;
    }
    const globalContext = globalThis as Record<string | symbol, unknown>;
    return globalContext[CLOUDFLARE_CONTEXT_SYMBOL] as
        | CloudflareContext
        | undefined;
};

const buildAbsoluteUrl = (target: string) => {
    const baseUrl = new URL(FALLBACK_API_BASE_URL);
    const url = new URL(target, baseUrl);
    if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.origin !== baseUrl.origin ||
        url.username ||
        url.password
    ) {
        throw new Error('Backend URL must use the configured API origin');
    }
    // 接続先は設定値から構築し、呼び出し元にはパスとクエリだけを許可する。
    baseUrl.pathname = url.pathname;
    baseUrl.search = url.search;
    baseUrl.hash = '';
    return baseUrl.toString();
};

export const getPublicApiBaseUrl = () => FALLBACK_API_BASE_URL;
export const buildBackendUrl = (target: string) => buildAbsoluteUrl(target);

export function withNoStoreRequestInit(init?: RequestInit): RequestInit {
    const headers = new Headers(init?.headers);
    if (!headers.has('Cache-Control')) {
        headers.set('Cache-Control', NO_STORE_CACHE_CONTROL_VALUE);
    }
    if (!headers.has('Pragma')) {
        headers.set('Pragma', 'no-cache');
    }
    if (!headers.has('Expires')) {
        headers.set('Expires', '0');
    }

    return {
        ...init,
        cache: 'no-store',
        // Backendのリダイレクト先へ認証情報を送信しない。
        redirect: 'error',
        headers,
    };
}

function isSensitiveKey(key: string): boolean {
    const lower = key.toLowerCase();
    return (
        lower.includes('password') ||
        lower.includes('token') ||
        lower.includes('secret') ||
        lower.includes('cookie') ||
        lower.includes('authorization')
    );
}

function maskSensitiveData(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map((entry) => maskSensitiveData(entry));
    }
    if (value && typeof value === 'object') {
        const objectValue = value as Record<string, unknown>;
        return Object.fromEntries(
            Object.entries(objectValue).map(([key, entryValue]) => [
                key,
                isSensitiveKey(key) ? REDACTED : maskSensitiveData(entryValue),
            ]),
        );
    }
    return value;
}

function truncateText(value: string): string {
    if (value.length <= MAX_LOG_BODY_LENGTH) return value;
    return `${value.slice(0, MAX_LOG_BODY_LENGTH)}... [truncated ${value.length - MAX_LOG_BODY_LENGTH} chars]`;
}

function parseJsonSafe(text: string): unknown {
    try {
        return JSON.parse(text);
    } catch {
        return truncateText(text);
    }
}

function serializeHeaders(headers?: HeadersInit): Record<string, string> {
    if (!headers) return {};
    const plain = Object.fromEntries(new Headers(headers).entries());
    return Object.fromEntries(
        Object.entries(plain).map(([key, value]) => [
            key,
            isSensitiveKey(key) ? REDACTED : value,
        ]),
    );
}

function serializeFormData(body: FormData) {
    const entries = Array.from(body.entries()).map(([key, value]) => {
        if (typeof value === 'string') {
            return {
                key,
                value: isSensitiveKey(key) ? REDACTED : truncateText(value),
            };
        }
        return {
            key,
            file: {
                name: value.name,
                size: value.size,
                type: value.type,
            },
        };
    });
    return { type: 'form-data', entries };
}

function serializeRequestBody(body: BodyInit | null | undefined): unknown {
    if (body == null) return null;

    if (typeof body === 'string') {
        return maskSensitiveData(parseJsonSafe(body));
    }
    if (
        typeof URLSearchParams !== 'undefined' &&
        body instanceof URLSearchParams
    ) {
        return {
            type: 'url-encoded',
            data: maskSensitiveData(Object.fromEntries(body.entries())),
        };
    }
    if (typeof FormData !== 'undefined' && body instanceof FormData) {
        return maskSensitiveData(serializeFormData(body));
    }
    if (
        typeof ArrayBuffer !== 'undefined' &&
        (body instanceof ArrayBuffer || ArrayBuffer.isView(body))
    ) {
        const size = body.byteLength;
        return { type: 'binary', size };
    }
    if (typeof Blob !== 'undefined' && body instanceof Blob) {
        return { type: 'blob', size: body.size, contentType: body.type };
    }
    return { type: 'unknown-body' };
}

async function serializeResponseBody(response: Response): Promise<unknown> {
    const contentType = response.headers.get('content-type') ?? '';
    const clone = response.clone();

    try {
        if (
            contentType.includes('application/json') ||
            contentType.includes('application/problem+json')
        ) {
            const text = await clone.text();
            return maskSensitiveData(parseJsonSafe(text));
        }
        if (contentType.startsWith('text/')) {
            const text = await clone.text();
            return truncateText(text);
        }
        return {
            type: 'non-text-response',
            contentType: contentType || 'unknown',
        };
    } catch {
        return {
            type: 'unreadable-response-body',
            contentType: contentType || 'unknown',
        };
    }
}

async function logBackendFetch(
    method: string,
    url: string,
    init: RequestInit | undefined,
    response: Response,
): Promise<void> {
    if (!isVerboseBackendFetchLogEnabled()) return;

    const requestHeaders = serializeHeaders(init?.headers);
    const requestBody = serializeRequestBody(init?.body);
    const responseHeaders = serializeHeaders(response.headers);
    const responseBody = await serializeResponseBody(response);

    console.log('[backendFetch]', {
        method,
        url,
        status: response.status,
        request: {
            headers: requestHeaders,
            body: requestBody,
        },
        response: {
            headers: responseHeaders,
            body: responseBody,
        },
    });
}

function logBackendFetchError(
    method: string,
    url: string,
    init: RequestInit | undefined,
    error: unknown,
): void {
    if (!isVerboseBackendFetchLogEnabled()) return;
    console.error('[backendFetch] ERROR', {
        method,
        url,
        request: {
            headers: serializeHeaders(init?.headers),
            body: serializeRequestBody(init?.body),
        },
        error: error instanceof Error ? error.message : String(error),
    });
}

export async function fetchFromBackend(
    target: string,
    init?: RequestInit,
): Promise<Response> {
    const url = buildAbsoluteUrl(target);
    const requestInit = withNoStoreRequestInit(init);
    const method = (requestInit.method ?? 'GET').toUpperCase();

    try {
        if (typeof window === 'undefined') {
            const context = getCloudflareContext();
            const backend = context?.env?.BACKEND;
            if (backend) {
                const request = new Request(url, requestInit);
                const backendFetch = backend.fetch.bind(
                    backend,
                ) as unknown as typeof fetch;
                const response = await backendFetch(request);
                await logBackendFetch(method, url, requestInit, response);
                return response;
            }
        }

        const response = await fetch(url, requestInit);
        await logBackendFetch(method, url, requestInit, response);
        return response;
    } catch (error) {
        logBackendFetchError(method, url, requestInit, error);
        throw error;
    }
}
