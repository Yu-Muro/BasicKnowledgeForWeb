import type { createDatabaseClient } from '@backend/src/db/connection';
import {
    departments,
    timetableItemDepartments,
    timetableItems,
} from '@backend/src/db/schema';
import { createIlikePattern } from '@backend/src/infrastructure/repositories/utils/escapeIlikePattern';
import { and, asc, eq, ilike, inArray, or } from 'drizzle-orm';
import type {
    CreateTimetableItemInput,
    ITimetableRepository,
    TimetableItem,
    UpdateTimetableItemInput,
} from './ITimetableRepository';
import {
    InvalidTimetableDepartmentIdsError as InvalidDepartmentIdsError,
    InvalidTimetableLaneSelectionError,
    InvalidTimetableTimeRangeError,
} from './ITimetableRepository';

type DatabaseClient = ReturnType<typeof createDatabaseClient>;
type DepartmentLinkExecutor = Pick<DatabaseClient, 'delete' | 'insert'>;
type DepartmentLookupExecutor = Pick<DatabaseClient, 'select'>;
type TimetableRecord = typeof timetableItems.$inferSelect;
type TimetableRow = TimetableRecord & {
    departmentId: string | null;
    departmentName: string | null;
};

function buildTimetableItems(rows: TimetableRow[]): TimetableItem[] {
    const map = new Map<string, TimetableItem>();
    for (const row of rows) {
        const item =
            map.get(row.id) ??
            ({
                id: row.id,
                eventId: row.eventId,
                title: row.title,
                startTime: row.startTime,
                endTime: row.endTime,
                location: row.location,
                description: row.description,
                isPublic: row.isPublic,
                createdAt: row.createdAt,
                updatedAt: row.updatedAt,
                departments: [],
            } satisfies TimetableItem);

        if (row.departmentId && row.departmentName) {
            item.departments.push({
                id: row.departmentId,
                name: row.departmentName,
            });
        }
        map.set(row.id, item);
    }
    return Array.from(map.values());
}

export class TimetableRepository implements ITimetableRepository {
    constructor(private readonly db: DatabaseClient) {}

    async findByEventId(eventId: string): Promise<TimetableItem[]> {
        const rows = await this.db
            .select({
                id: timetableItems.id,
                eventId: timetableItems.eventId,
                title: timetableItems.title,
                startTime: timetableItems.startTime,
                endTime: timetableItems.endTime,
                location: timetableItems.location,
                description: timetableItems.description,
                isPublic: timetableItems.isPublic,
                createdAt: timetableItems.createdAt,
                updatedAt: timetableItems.updatedAt,
                departmentId: departments.id,
                departmentName: departments.name,
            })
            .from(timetableItems)
            .leftJoin(
                timetableItemDepartments,
                and(
                    eq(
                        timetableItemDepartments.timetableItemId,
                        timetableItems.id,
                    ),
                    eq(
                        timetableItemDepartments.eventId,
                        timetableItems.eventId,
                    ),
                ),
            )
            .leftJoin(
                departments,
                and(
                    eq(departments.id, timetableItemDepartments.departmentId),
                    eq(departments.eventId, timetableItems.eventId),
                ),
            )
            .where(eq(timetableItems.eventId, eventId))
            .orderBy(asc(timetableItems.startTime), asc(departments.name));
        return buildTimetableItems(rows);
    }

    async findById(id: string, eventId: string): Promise<TimetableItem | null> {
        const rows = await this.db
            .select({
                id: timetableItems.id,
                eventId: timetableItems.eventId,
                title: timetableItems.title,
                startTime: timetableItems.startTime,
                endTime: timetableItems.endTime,
                location: timetableItems.location,
                description: timetableItems.description,
                isPublic: timetableItems.isPublic,
                createdAt: timetableItems.createdAt,
                updatedAt: timetableItems.updatedAt,
                departmentId: departments.id,
                departmentName: departments.name,
            })
            .from(timetableItems)
            .leftJoin(
                timetableItemDepartments,
                and(
                    eq(
                        timetableItemDepartments.timetableItemId,
                        timetableItems.id,
                    ),
                    eq(
                        timetableItemDepartments.eventId,
                        timetableItems.eventId,
                    ),
                ),
            )
            .leftJoin(
                departments,
                and(
                    eq(departments.id, timetableItemDepartments.departmentId),
                    eq(departments.eventId, timetableItems.eventId),
                ),
            )
            .where(
                and(
                    eq(timetableItems.id, id),
                    eq(timetableItems.eventId, eventId),
                ),
            );
        return buildTimetableItems(rows)[0] ?? null;
    }

    async search(keyword: string, eventId: string): Promise<TimetableItem[]> {
        const pattern = createIlikePattern(keyword);
        const rows = await this.db
            .select({
                id: timetableItems.id,
                eventId: timetableItems.eventId,
                title: timetableItems.title,
                startTime: timetableItems.startTime,
                endTime: timetableItems.endTime,
                location: timetableItems.location,
                description: timetableItems.description,
                isPublic: timetableItems.isPublic,
                createdAt: timetableItems.createdAt,
                updatedAt: timetableItems.updatedAt,
                departmentId: departments.id,
                departmentName: departments.name,
            })
            .from(timetableItems)
            .leftJoin(
                timetableItemDepartments,
                and(
                    eq(
                        timetableItemDepartments.timetableItemId,
                        timetableItems.id,
                    ),
                    eq(
                        timetableItemDepartments.eventId,
                        timetableItems.eventId,
                    ),
                ),
            )
            .leftJoin(
                departments,
                and(
                    eq(departments.id, timetableItemDepartments.departmentId),
                    eq(departments.eventId, timetableItems.eventId),
                ),
            )
            .where(
                and(
                    eq(timetableItems.eventId, eventId),
                    or(
                        ilike(timetableItems.title, pattern),
                        ilike(timetableItems.location, pattern),
                        ilike(timetableItems.description, pattern),
                    ),
                ),
            )
            .orderBy(asc(timetableItems.startTime), asc(departments.name));
        return buildTimetableItems(rows);
    }

    async create(input: CreateTimetableItemInput): Promise<TimetableItem> {
        const { departmentIds = [], ...itemInput } = input;
        const created = await this.db.transaction(async (tx) => {
            if (itemInput.endTime < itemInput.startTime) {
                throw new InvalidTimetableTimeRangeError();
            }
            if (!itemInput.isPublic && departmentIds.length === 0) {
                throw new InvalidTimetableLaneSelectionError();
            }
            await this.assertDepartmentsExist(
                tx,
                itemInput.eventId,
                departmentIds,
            );
            const [createdItem] = await tx
                .insert(timetableItems)
                .values(itemInput)
                .returning();
            await this.replaceDepartmentLinks(
                tx,
                createdItem.id,
                createdItem.eventId,
                departmentIds,
            );
            return createdItem;
        });
        const item = await this.findById(created.id, created.eventId);
        return item ?? { ...created, departments: [] };
    }

    async update(
        id: string,
        eventId: string,
        input: UpdateTimetableItemInput,
    ): Promise<TimetableItem | null> {
        const { departmentIds, ...itemInput } = input;
        const updated = await this.db.transaction(async (tx) => {
            const [existing] = await tx
                .select({
                    startTime: timetableItems.startTime,
                    endTime: timetableItems.endTime,
                    isPublic: timetableItems.isPublic,
                })
                .from(timetableItems)
                .where(
                    and(
                        eq(timetableItems.id, id),
                        eq(timetableItems.eventId, eventId),
                    ),
                )
                .for('update');
            if (!existing) return false;

            const existingDepartmentIds =
                departmentIds === undefined
                    ? (
                          await tx
                              .select({
                                  id: timetableItemDepartments.departmentId,
                              })
                              .from(timetableItemDepartments)
                              .where(
                                  and(
                                      eq(
                                          timetableItemDepartments.timetableItemId,
                                          id,
                                      ),
                                      eq(
                                          timetableItemDepartments.eventId,
                                          eventId,
                                      ),
                                  ),
                              )
                      ).map((row) => row.id)
                    : departmentIds;
            const effectiveStart = itemInput.startTime ?? existing.startTime;
            const effectiveEnd = itemInput.endTime ?? existing.endTime;
            if (effectiveEnd < effectiveStart) {
                throw new InvalidTimetableTimeRangeError();
            }
            if (
                !(itemInput.isPublic ?? existing.isPublic) &&
                existingDepartmentIds.length === 0
            ) {
                throw new InvalidTimetableLaneSelectionError();
            }

            if (departmentIds !== undefined) {
                await this.assertDepartmentsExist(tx, eventId, departmentIds);
            }
            await tx
                .update(timetableItems)
                .set({ ...itemInput, updatedAt: new Date() })
                .where(
                    and(
                        eq(timetableItems.id, id),
                        eq(timetableItems.eventId, eventId),
                    ),
                );
            if (departmentIds !== undefined) {
                await this.replaceDepartmentLinks(
                    tx,
                    id,
                    eventId,
                    departmentIds,
                );
            }
            return true;
        });
        if (!updated) return null;
        return this.findById(id, eventId);
    }

    async delete(id: string, eventId: string): Promise<boolean> {
        const deleted = await this.db
            .delete(timetableItems)
            .where(
                and(
                    eq(timetableItems.id, id),
                    eq(timetableItems.eventId, eventId),
                ),
            )
            .returning({ id: timetableItems.id });
        return deleted.length > 0;
    }

    private async replaceDepartmentLinks(
        db: DepartmentLinkExecutor,
        timetableItemId: string,
        eventId: string,
        departmentIds: string[],
    ): Promise<void> {
        await db
            .delete(timetableItemDepartments)
            .where(
                and(
                    eq(
                        timetableItemDepartments.timetableItemId,
                        timetableItemId,
                    ),
                    eq(timetableItemDepartments.eventId, eventId),
                ),
            );

        const uniqueDepartmentIds = Array.from(new Set(departmentIds));
        if (uniqueDepartmentIds.length === 0) return;

        await db.insert(timetableItemDepartments).values(
            uniqueDepartmentIds.map((departmentId) => ({
                eventId,
                timetableItemId,
                departmentId,
            })),
        );
    }

    private async assertDepartmentsExist(
        db: DepartmentLookupExecutor,
        eventId: string,
        departmentIds: string[],
    ): Promise<void> {
        const uniqueDepartmentIds = Array.from(new Set(departmentIds));
        if (uniqueDepartmentIds.length === 0) return;

        const rows = await db
            .select({ id: departments.id })
            .from(departments)
            .where(
                and(
                    eq(departments.eventId, eventId),
                    inArray(departments.id, uniqueDepartmentIds),
                ),
            );

        if (rows.length !== uniqueDepartmentIds.length) {
            throw new InvalidDepartmentIdsError();
        }
    }
}
