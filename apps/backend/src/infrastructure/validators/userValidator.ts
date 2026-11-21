import { z } from 'zod';

export const createUserSchema = z.object({
    name: z
        .string()
        .min(1, '名前は必須です')
        .max(255, '名前は255文字以内で入力してください'),
    email: z
        .string()
        .regex(
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            '有効なメールアドレスを入力してください',
        )
        .max(255, 'メールアドレスは255文字以内で入力してください'),
    password: z.string().min(8, 'パスワードは8文字以上で入力してください'),
    departmentId: z.string().uuid('部署を選択してください'),
    role: z.literal('user').optional().default('user'),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
    name: z
        .string()
        .min(1, '名前は必須です')
        .max(255, '名前は255文字以内で入力してください')
        .optional(),
    email: z
        .string()
        .regex(
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            '有効なメールアドレスを入力してください',
        )
        .max(255, 'メールアドレスは255文字以内で入力してください')
        .optional(),
    password: z
        .string()
        .min(8, 'パスワードは8文字以上で入力してください')
        .optional(),
    role: z
        .string()
        .min(1, '権限は必須です')
        .max(50, '権限は50文字以内で入力してください')
        .optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
