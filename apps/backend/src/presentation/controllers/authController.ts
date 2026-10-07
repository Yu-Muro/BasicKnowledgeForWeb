import type { Env } from '@backend/src/db/connection';
import {
    changePasswordSchema,
    loginSchema,
} from '@backend/src/infrastructure/validators/authValidator';
import type { IChangePasswordUseCase } from '@backend/src/use-cases/auth/IChangePasswordUseCase';
import type { ILoginUseCase } from '@backend/src/use-cases/auth/ILoginUseCase';
import type { Context } from 'hono';
import { deleteCookie, setCookie } from 'hono/cookie';
import type { AuthVariables } from '../middleware/authMiddleware';

type AppContext = Context<{ Bindings: Env; Variables: AuthVariables }>;

const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax' as const,
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
};

export async function login(c: AppContext, useCase: ILoginUseCase) {
    const body = await c.req.json().catch(() => null);
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(
            { error: 'バリデーションエラー', details: parsed.error.issues },
            400,
        );
    }

    const result = await useCase.execute({
        ...parsed.data,
        jwtSecret: c.env.JWT_SECRET,
    });

    if (!result.success) {
        return c.json({ error: result.error }, 401);
    }

    setCookie(c, 'auth_token', result.token, COOKIE_OPTIONS);
    return c.json({ message: 'ログインしました' }, 200);
}

export function logout(c: AppContext) {
    deleteCookie(c, 'auth_token', { path: '/' });
    return c.json({ message: 'ログアウトしました' }, 200);
}

export function me(c: AppContext) {
    const user = c.get('user');
    return c.json(
        {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            departmentId: user.departmentId ?? null,
        },
        200,
    );
}

export async function changePassword(
    c: AppContext,
    useCase: IChangePasswordUseCase,
) {
    const body = await c.req.json().catch(() => null);
    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) {
        return c.json(
            { error: 'バリデーションエラー', details: parsed.error.issues },
            400,
        );
    }

    const user = c.get('user');
    const result = await useCase.execute({
        userId: user.id,
        currentPassword: parsed.data.currentPassword,
        newPassword: parsed.data.newPassword,
    });

    if (!result.success) {
        return c.json({ error: result.error }, result.status as 400 | 404);
    }

    return c.json({ message: 'パスワードを変更しました' }, 200);
}
