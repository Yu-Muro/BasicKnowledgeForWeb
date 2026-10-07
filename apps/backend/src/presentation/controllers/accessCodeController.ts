import type { Env } from '@backend/src/db/connection';
import {
    createAccessCodeSchema,
    verifyAccessCodeSchema,
} from '@backend/src/infrastructure/validators/accessCodeValidator';
import type { ICreateAccessCodeUseCase } from '@backend/src/use-cases/access-code/ICreateAccessCodeUseCase';
import type { IDeleteAccessCodeUseCase } from '@backend/src/use-cases/access-code/IDeleteAccessCodeUseCase';
import type { IGetAccessCodesUseCase } from '@backend/src/use-cases/access-code/IGetAccessCodesUseCase';
import type { IGetAccessCodeUseCase } from '@backend/src/use-cases/access-code/IGetAccessCodeUseCase';
import type { IVerifyAccessCodeUseCase } from '@backend/src/use-cases/access-code/IVerifyAccessCodeUseCase';
import type { Context } from 'hono';
import { setCookie } from 'hono/cookie';
import type { AuthVariables } from '../middleware/authMiddleware';

type AppContext = Context<{ Bindings: Env; Variables: AuthVariables }>;

const ACCESS_COOKIE_OPTIONS = {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax' as const,
    path: '/',
};

export async function verifyAccessCode(
    c: AppContext,
    useCase: IVerifyAccessCodeUseCase,
) {
    const body = await c.req.json().catch(() => null);
    const parsed = verifyAccessCodeSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(
            { error: 'バリデーションエラー', details: parsed.error.issues },
            400,
        );
    }

    const result = await useCase.execute({
        code: parsed.data.code,
        jwtSecret: c.env.JWT_SECRET,
    });

    if (!result.success) {
        return c.json({ error: result.error }, 401);
    }

    setCookie(c, 'access_token', result.token, ACCESS_COOKIE_OPTIONS);
    return c.json({ message: 'アクセスコードを確認しました' }, 200);
}

export async function getAccessCode(
    c: AppContext,
    useCase: IGetAccessCodeUseCase,
) {
    const id = c.req.param('id') ?? '';
    if (
        c.get('user')?.role !== 'admin' &&
        id.toLowerCase() !== c.req.header('x-event-id')?.toLowerCase()
    )
        return c.json({ error: 'Forbidden' }, 403);
    const result = await useCase.execute(id);
    if (!result.success) {
        return c.json({ error: result.error }, 404);
    }
    return c.json({ code: result.data }, 200);
}

export async function getAccessCodes(
    c: AppContext,
    useCase: IGetAccessCodesUseCase,
) {
    const result = await useCase.execute();
    if (!result.success) {
        return c.json({ error: result.error }, 500);
    }
    return c.json({ codes: result.data }, 200);
}

export async function createAccessCode(
    c: AppContext,
    useCase: ICreateAccessCodeUseCase,
) {
    const body = await c.req.json().catch(() => null);
    const parsed = createAccessCodeSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(
            { error: 'バリデーションエラー', details: parsed.error.issues },
            400,
        );
    }

    const user = c.get('user');
    const result = await useCase.execute({
        ...parsed.data,
        createdBy: user.id,
    });

    if (!result.success) {
        return c.json({ error: result.error }, 400);
    }
    return c.json({ code: result.data }, 201);
}

export async function deleteAccessCode(
    c: AppContext,
    useCase: IDeleteAccessCodeUseCase,
) {
    const id = c.req.param('id') ?? '';
    const result = await useCase.execute(id);
    if (!result.success) {
        return c.json({ error: result.error }, result.status ?? 500);
    }
    return c.json({ message: '削除しました' }, 200);
}
