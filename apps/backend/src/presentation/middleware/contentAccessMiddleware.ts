import type { Env } from '@backend/src/db/connection';
import { getCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import { verify } from 'hono/jwt';
import type { AuthVariables } from './authMiddleware';

/**
 * コンテンツ閲覧用ミドルウェア。
 *
 * 以下のいずれかを満たす場合にリクエストを通過させる:
 * - access_token が有効、かつ JWT 内の event_id が x-event-id ヘッダーと一致する
 * - DBセッションが有効で、管理者または部署スタッフである
 *
 * 閲覧のみの一般ユーザーは access_token が必要。
 */
export const contentAccessMiddleware = createMiddleware<{
    Bindings: Env;
    Variables: AuthVariables;
}>(async (c, next) => {
    const xEventId = c.req.header('x-event-id');
    const accessToken = getCookie(c, 'access_token');
    const authToken = getCookie(c, 'auth_token');

    // access_token 認証: JWT が有効かつ event_id が x-event-id と一致すること
    if (accessToken) {
        try {
            const payload = await verify(
                accessToken,
                c.env.JWT_SECRET,
                'HS256',
            );
            if (payload.event_id === xEventId) {
                await next();
                return;
            }
            console.log('[contentAccess] access_token event_id mismatch', {
                path: c.req.path,
                tokenEventId: payload.event_id,
                headerEventId: xEventId,
            });
        } catch (err) {
            console.log('[contentAccess] access_token verification failed', {
                path: c.req.path,
                error: err instanceof Error ? err.message : String(err),
            });
        }
    }

    // Account sessions are resolved from Better Auth and the current user row.
    if (['admin', 'user'].includes(c.get('user')?.role ?? '')) {
        await next();
        return;
    }

    if (!accessToken && !authToken) {
        console.log('[contentAccess] Unauthorized: no tokens present', {
            path: c.req.path,
        });
    }

    return c.json({ error: 'Unauthorized' }, 401);
});
