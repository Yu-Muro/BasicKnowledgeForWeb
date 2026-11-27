/**
 * Server Actions 用ログユーティリティ。
 * Cloudflare Workers 上の console.log は Workers Observability に記録される。
 */

export function logAction(
    action: string,
    method: string,
    url: string,
    status: number,
): void {
    console.log('[action]', { action, method, url, status });
}

export function logActionError(
    action: string,
    method: string,
    url: string,
    error: unknown,
): void {
    console.error('[action] ERROR', {
        action,
        method,
        url,
        error: error instanceof Error ? error.message : String(error),
    });
}
