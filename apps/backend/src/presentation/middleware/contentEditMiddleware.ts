import type { Env } from '@backend/src/db/connection';
import { eventIdHeaderSchema } from '@backend/src/infrastructure/validators/eventIdValidator';
import { createMiddleware } from 'hono/factory';
import type { AuthVariables } from './authMiddleware';

export type ContentEditVariables = AuthVariables & {
    eventId: string;
};

export const contentEditMiddleware = createMiddleware<{
    Bindings: Env;
    Variables: ContentEditVariables;
}>(async (c, next) => {
    const headerResult = eventIdHeaderSchema.safeParse(c.req.header());
    if (!headerResult.success) {
        return c.json(
            {
                error: 'バリデーションエラー',
                details: headerResult.error.issues,
            },
            400,
        );
    }

    const user = c.get('user');
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    if (user.role !== 'admin') return c.json({ error: 'Forbidden' }, 403);
    c.set('eventId', headerResult.data['x-event-id']);
    await next();
});
