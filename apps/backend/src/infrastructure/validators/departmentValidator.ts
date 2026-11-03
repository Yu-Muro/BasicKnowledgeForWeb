import { z } from 'zod';
export const createDepartmentSchema = z.object({
    name: z.string().trim().min(1).max(255),
});
export const updateDepartmentSchema = createDepartmentSchema
    .partial()
    .refine((data) => Object.keys(data).length > 0, {
        message: '更新項目を1つ以上指定してください',
    });
