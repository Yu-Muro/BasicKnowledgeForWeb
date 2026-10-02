import type { Env } from '@backend/src/db/connection';
import { eventIdHeaderSchema } from '@backend/src/infrastructure/validators/eventIdValidator';
import {
    createTimetableItemSchema,
    updateTimetableItemSchema,
} from '@backend/src/infrastructure/validators/timetableValidator';
import type { ICreateTimetableItemUseCase } from '@backend/src/use-cases/timetable/ICreateTimetableItemUseCase';
import type { IDeleteTimetableItemUseCase } from '@backend/src/use-cases/timetable/IDeleteTimetableItemUseCase';
import type { IGetTimetableItemsUseCase } from '@backend/src/use-cases/timetable/IGetTimetableItemsUseCase';
import type { IUpdateTimetableItemUseCase } from '@backend/src/use-cases/timetable/IUpdateTimetableItemUseCase';
import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { z } from 'zod';
import type { ContentEditVariables } from '../middleware/contentEditMiddleware';

export async function getTimetableItems(
    c: Context,
    useCase: IGetTimetableItemsUseCase,
) {
    const parsed = eventIdHeaderSchema.safeParse(c.req.header());
    if (!parsed.success) {
        return c.json(
            { error: 'バリデーションエラー', details: parsed.error.issues },
            400,
        );
    }

    const result = await useCase.execute(parsed.data['x-event-id']);
    if (!result.success) {
        return c.json({ error: result.error }, 500);
    }
    c.header('Cache-Control', 'no-store, max-age=0, must-revalidate');
    c.header('Pragma', 'no-cache');
    c.header('Expires', '0');
    return c.json({ items: result.data }, 200);
}

const idSchema = z.string().uuid();
const toStatus = (code?: number): ContentfulStatusCode =>
    (code ?? 500) as ContentfulStatusCode;

type AdminContext = Context<{
    Bindings: Env;
    Variables: ContentEditVariables;
}>;

export async function createTimetableItem(
    c: AdminContext,
    useCase: ICreateTimetableItemUseCase,
) {
    const body = await c.req.json().catch(() => null);
    const parsed = createTimetableItemSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(
            { error: 'バリデーションエラー', details: parsed.error.issues },
            400,
        );
    }

    const eventId = c.get('eventId');
    if (parsed.data.event_id !== eventId) {
        return c.json({ error: 'event_id が一致しません' }, 400);
    }

    const result = await useCase.execute({
        eventId,
        title: parsed.data.title,
        startTime: parsed.data.start_time,
        endTime: parsed.data.end_time,
        location: parsed.data.location,
        description: parsed.data.description ?? null,
        isPublic: parsed.data.is_public,
        departmentIds: parsed.data.department_ids,
    });
    if (!result.success) {
        return c.json({ error: result.error }, toStatus(result.status));
    }
    return c.json({ item: result.data }, 201);
}

export async function updateTimetableItem(
    c: AdminContext,
    useCase: IUpdateTimetableItemUseCase,
) {
    const idParsed = idSchema.safeParse(c.req.param('id') ?? '');
    if (!idParsed.success) {
        return c.json(
            { error: 'バリデーションエラー', details: idParsed.error.issues },
            400,
        );
    }

    const body = await c.req.json().catch(() => null);
    const parsed = updateTimetableItemSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(
            { error: 'バリデーションエラー', details: parsed.error.issues },
            400,
        );
    }

    const result = await useCase.execute({
        id: idParsed.data,
        eventId: c.get('eventId'),
        payload: {
            title: parsed.data.title,
            startTime: parsed.data.start_time,
            endTime: parsed.data.end_time,
            location: parsed.data.location,
            description: parsed.data.description,
            isPublic: parsed.data.is_public,
            departmentIds: parsed.data.department_ids,
        },
    });
    if (!result.success) {
        return c.json({ error: result.error }, toStatus(result.status));
    }
    return c.json({ item: result.data }, 200);
}

export async function deleteTimetableItem(
    c: AdminContext,
    useCase: IDeleteTimetableItemUseCase,
) {
    const idParsed = idSchema.safeParse(c.req.param('id') ?? '');
    if (!idParsed.success) {
        return c.json(
            { error: 'バリデーションエラー', details: idParsed.error.issues },
            400,
        );
    }

    const result = await useCase.execute({
        id: idParsed.data,
        eventId: c.get('eventId'),
    });
    if (!result.success) {
        return c.json({ error: result.error }, toStatus(result.status));
    }
    return c.json({ id: result.data.id }, 200);
}
