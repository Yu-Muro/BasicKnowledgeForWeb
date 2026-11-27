import { z } from 'zod';
export const updateUserRoleSchema = z
    .object({
        role: z.enum(['user', 'admin']),
        departmentId: z.string().uuid().optional(),
    })
    .refine((data) => data.role === 'admin' || !!data.departmentId, {
        message: '一般ユーザーには部署の指定が必要です',
        path: ['departmentId'],
    });
export const updateUserDepartmentSchema = z.object({
    departmentId: z.string().uuid(),
});
export type UpdateUserRoleBody = z.infer<typeof updateUserRoleSchema>;

export const restoreUserSchema = z.object({
    departmentId: z.string().uuid().optional(),
});
