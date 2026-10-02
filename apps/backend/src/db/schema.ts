// src/db/schema.ts
import {
    boolean,
    cockroachTable,
    foreignKey,
    int4,
    primaryKey,
    text,
    timestamp,
    uniqueIndex,
    uuid,
    varchar,
} from 'drizzle-orm/cockroach-core';

export const users = cockroachTable('users', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    password: text('password').notNull(),
    role: varchar('role', { length: 50 }).notNull().default('user'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
    deletedAt: timestamp('deleted_at'),
});

export const accessCodes = cockroachTable('access_codes', {
    id: uuid('id').primaryKey().defaultRandom(),
    code: varchar('code', { length: 50 }).notNull().unique(),
    eventName: varchar('event_name', { length: 255 }).notNull(),
    validFrom: timestamp('valid_from').notNull(),
    validTo: timestamp('valid_to').notNull(),
    createdBy: uuid('created_by').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
});

export const departments = cockroachTable(
    'departments',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        eventId: uuid('event_id')
            .notNull()
            .references(() => accessCodes.id, { onDelete: 'restrict' }),
        name: varchar('name', { length: 255 }).notNull(),
        createdAt: timestamp('created_at').defaultNow(),
        updatedAt: timestamp('updated_at').defaultNow(),
    },
    (table) => [
        uniqueIndex('departments_event_id_id_idx').on(table.eventId, table.id),
    ],
);

export const timetableItems = cockroachTable(
    'timetable_items',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        eventId: uuid('event_id')
            .notNull()
            .references(() => accessCodes.id, { onDelete: 'restrict' }),
        title: varchar('title', { length: 255 }).notNull(),
        startTime: timestamp('start_time').notNull(),
        endTime: timestamp('end_time').notNull(),
        location: varchar('location', { length: 255 }).notNull(),
        description: text('description'),
        isPublic: boolean('is_public').notNull().default(true),
        createdAt: timestamp('created_at').defaultNow(),
        updatedAt: timestamp('updated_at').defaultNow(),
    },
    (table) => [
        uniqueIndex('timetable_items_event_id_id_idx').on(
            table.eventId,
            table.id,
        ),
    ],
);

export const timetableItemDepartments = cockroachTable(
    'timetable_item_departments',
    {
        eventId: uuid('event_id')
            .notNull()
            .references(() => accessCodes.id, { onDelete: 'restrict' }),
        timetableItemId: uuid('timetable_item_id').notNull(),
        departmentId: uuid('department_id').notNull(),
    },
    (table) => [
        primaryKey({ columns: [table.timetableItemId, table.departmentId] }),
        foreignKey({
            columns: [table.eventId, table.timetableItemId],
            foreignColumns: [timetableItems.eventId, timetableItems.id],
        }).onDelete('cascade'),
        foreignKey({
            columns: [table.eventId, table.departmentId],
            foreignColumns: [departments.eventId, departments.id],
        }).onDelete('restrict'),
    ],
);

export const rooms = cockroachTable(
    'rooms',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        eventId: uuid('event_id')
            .notNull()
            .references(() => accessCodes.id, { onDelete: 'restrict' }),
        buildingName: varchar('building_name', { length: 255 }).notNull(),
        floor: varchar('floor', { length: 50 }).notNull(),
        roomName: varchar('room_name', { length: 255 }).notNull(),
        preDayManagerId: uuid('pre_day_manager_id'),
        preDayPurpose: varchar('pre_day_purpose', { length: 255 }),
        dayManagerId: uuid('day_manager_id').notNull(),
        dayPurpose: varchar('day_purpose', { length: 255 }).notNull(),
        notes: text('notes'),
        createdAt: timestamp('created_at').defaultNow(),
        updatedAt: timestamp('updated_at').defaultNow(),
    },
    (table) => [
        foreignKey({
            columns: [table.eventId, table.preDayManagerId],
            foreignColumns: [departments.eventId, departments.id],
        }).onDelete('restrict'),
        foreignKey({
            columns: [table.eventId, table.dayManagerId],
            foreignColumns: [departments.eventId, departments.id],
        }).onDelete('restrict'),
    ],
);

export const programs = cockroachTable('programs', {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
        .notNull()
        .references(() => accessCodes.id, { onDelete: 'restrict' }),
    name: varchar('name', { length: 255 }).notNull(),
    location: varchar('location', { length: 255 }).notNull(),
    startTime: timestamp('start_time').notNull(),
    endTime: timestamp('end_time').notNull(),
    description: text('description'),
    imageKey: varchar('image_key', { length: 512 }),
    imageUrl: text('image_url'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
});

export const shopItems = cockroachTable('shop_items', {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
        .notNull()
        .references(() => accessCodes.id, { onDelete: 'restrict' }),
    name: varchar('name', { length: 255 }).notNull(),
    price: int4('price').notNull(),
    description: text('description'),
    imageKey: varchar('image_key', { length: 512 }).notNull(),
    imageUrl: text('image_url').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
});

export const otherItems = cockroachTable('other_items', {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
        .notNull()
        .references(() => accessCodes.id, { onDelete: 'restrict' }),
    title: varchar('title', { length: 255 }).notNull(),
    content: text('content').notNull(),
    imageKey: varchar('image_key', { length: 512 }),
    imageUrl: text('image_url'),
    displayOrder: int4('display_order').notNull(),
    createdBy: uuid('created_by').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
});
