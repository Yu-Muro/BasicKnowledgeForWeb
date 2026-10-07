import type { Env } from '@backend/src/db/connection';
import type { DepartmentWriteResult } from '@backend/src/use-cases/department/ICheckDepartmentWritesUseCase';
import { createMiddleware } from 'hono/factory';
import type { AuthVariables } from './authMiddleware';
export const departmentWriteMiddleware = createMiddleware<{
    Bindings: Env;
    Variables: AuthVariables;
}>(async (c, next) => {
    const check = c.get('departmentWriteCheck');
    if (!check)
        return c.json(
            { error: '部署データの移行状態を確認できませんでした' },
            503,
        );
    let result: DepartmentWriteResult;
    try {
        result = await check.execute();
    } catch {
        return c.json(
            { error: '部署データの移行状態を確認できませんでした' },
            503,
        );
    }
    if (!result.success) {
        c.header('Retry-After', '30');
        return c.json({ error: result.error }, result.status);
    }
    await next();
});
