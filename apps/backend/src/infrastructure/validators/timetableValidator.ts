import { z } from 'zod';

const titleSchema = z.string().min(1).max(255);
const startTimeSchema = z.string().datetime();
const endTimeSchema = z.string().datetime();
const locationSchema = z.string().max(255);
const descriptionSchema = z.string().max(2000).nullable().optional();
const departmentIdsSchema = z.array(z.string().uuid()).optional().default([]);

export const createTimetableItemSchema = z
    .object({
        event_id: z.string().uuid(),
        title: titleSchema,
        start_time: startTimeSchema,
        end_time: endTimeSchema.optional(),
        location: locationSchema.optional().default(''),
        description: descriptionSchema,
        is_public: z.boolean().optional().default(true),
        department_ids: departmentIdsSchema,
    })
    .refine(
        (data) =>
            data.end_time === undefined ||
            new Date(data.start_time) <= new Date(data.end_time),
        {
            message: '終了時刻は開始時刻以降にしてください',
            path: ['end_time'],
        },
    );

export const updateTimetableItemSchema = z
    .object({
        title: titleSchema.optional(),
        start_time: startTimeSchema.optional(),
        end_time: endTimeSchema.optional(),
        location: locationSchema.optional(),
        description: descriptionSchema,
        is_public: z.boolean().optional(),
        department_ids: z.array(z.string().uuid()).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
        message: '更新項目を1つ以上指定してください',
    })
    .refine(
        (data) =>
            data.start_time === undefined ||
            data.end_time === undefined ||
            new Date(data.start_time) <= new Date(data.end_time),
        {
            message: '終了時刻は開始時刻以降にしてください',
            path: ['end_time'],
        },
    );
