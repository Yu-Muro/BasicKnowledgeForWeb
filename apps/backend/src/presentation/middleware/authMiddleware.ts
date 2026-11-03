import type { Env } from '@backend/src/db/connection';
import type {
    IValidateSessionUseCase,
    SessionResult,
    SessionUser,
} from '@backend/src/use-cases/auth/IValidateSessionUseCase';
import type { ICheckDepartmentWritesUseCase } from '@backend/src/use-cases/department/ICheckDepartmentWritesUseCase';
import { getCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import { verify } from 'hono/jwt';
export type AuthUser = SessionUser;
export type AuthVariables = {
    user: AuthUser;
    jwtSecret: string;
    sessionValidator: IValidateSessionUseCase;
    departmentWriteCheck: ICheckDepartmentWritesUseCase;
};
export const authMiddleware = createMiddleware<{
    Bindings: Env;
    Variables: AuthVariables;
}>(async (c, next) => {
    const token = getCookie(c, 'auth_token');
    if (!token) return c.json({ error: 'Unauthorized' }, 401);
    let claims: AuthUser;
    try {
        const payload = await verify(token, c.get('jwtSecret'), 'HS256');
        if (typeof payload.id !== 'string')
            return c.json({ error: 'Unauthorized' }, 401);
        claims = payload as AuthUser;
    } catch {
        return c.json({ error: 'Unauthorized' }, 401);
    }
    const validator = c.get('sessionValidator');
    if (!validator)
        return c.json({ error: '認証情報の確認に失敗しました' }, 503);
    let result: SessionResult;
    try {
        result = await validator.execute(claims);
    } catch {
        return c.json({ error: '認証情報の確認に失敗しました' }, 503);
    }
    if (!result.success) return c.json({ error: result.error }, result.status);
    c.set('user', result.data);
    await next();
});
