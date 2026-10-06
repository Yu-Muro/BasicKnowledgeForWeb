// src/db/schema.ts
import {
    boolean,
    cockroachTable,
    foreignKey,
    index,
    int4,
    int8,
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
    password: text('password').notNull().default(''),
    role: varchar('role', { length: 50 }).notNull().default('user'),
    departmentId: uuid('department_id').references(() => departments.id, {
        onDelete: 'restrict',
    }),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
    deletedAt: timestamp('deleted_at'),
    emailVerified: boolean('email_verified').notNull().default(false),
    image: text('image'),
});

export const authSessions = cockroachTable(
    'auth_sessions',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        token: text('token').notNull().unique(),
        expiresAt: timestamp('expires_at').notNull(),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at').notNull().defaultNow(),
        ipAddress: text('ip_address'),
        userAgent: text('user_agent'),
    },
    (table) => [index('auth_sessions_user_id_idx').on(table.userId)],
);

export const authAccounts = cockroachTable(
    'auth_accounts',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        accountId: text('account_id').notNull(),
        providerId: text('provider_id').notNull(),
        password: text('password'),
        accessToken: text('access_token'),
        refreshToken: text('refresh_token'),
        idToken: text('id_token'),
        accessTokenExpiresAt: timestamp('access_token_expires_at'),
        refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
        scope: text('scope'),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at').notNull().defaultNow(),
    },
    (table) => [
        index('auth_accounts_user_id_idx').on(table.userId),
        uniqueIndex('auth_accounts_provider_account_idx').on(
            table.providerId,
            table.accountId,
        ),
    ],
);

export const authVerifications = cockroachTable(
    'auth_verifications',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        identifier: text('identifier').notNull(),
        value: text('value').notNull(),
        expiresAt: timestamp('expires_at').notNull(),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at').notNull().defaultNow(),
    },
    (table) => [
        index('auth_verifications_identifier_idx').on(table.identifier),
    ],
);

export const authRateLimits = cockroachTable('auth_rate_limits', {
    id: uuid('id').primaryKey().defaultRandom(),
    key: text('key').notNull().unique(),
    count: int4('count').notNull(),
    lastRequest: int8('last_request', { mode: 'number' }).notNull(),
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
        name: varchar('name', { length: 255 }).notNull(),
        createdAt: timestamp('created_at').defaultNow(),
        updatedAt: timestamp('updated_at').defaultNow(),
    },
    (table) => [uniqueIndex('departments_name_idx').on(table.name)],
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
            columns: [table.departmentId],
            foreignColumns: [departments.id],
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
            columns: [table.preDayManagerId],
            foreignColumns: [departments.id],
        }).onDelete('restrict'),
        foreignKey({
            columns: [table.dayManagerId],
            foreignColumns: [departments.id],
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
