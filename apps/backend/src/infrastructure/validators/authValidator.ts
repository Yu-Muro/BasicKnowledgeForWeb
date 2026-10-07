import { z } from 'zod';
import {
    MAX_PASSWORD_LENGTH,
    PASSWORD_TOO_LONG_MESSAGE,
} from './passwordPolicy';

export const loginSchema = z.object({
    email: z.email().max(255),
    password: z.string().min(1),
});

export const changePasswordSchema = z.object({
    currentPassword: z.string().min(1),
    newPassword: z
        .string()
        .min(8)
        .max(MAX_PASSWORD_LENGTH, PASSWORD_TOO_LONG_MESSAGE),
});
