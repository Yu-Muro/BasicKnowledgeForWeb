import type { createDatabaseClient } from '@backend/src/db/connection';
import { users } from '@backend/src/db/schema';
import { and, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import type { IUserRepository, NewUser, User } from './IUserRepository';

type DatabaseClient = Omit<ReturnType<typeof createDatabaseClient>, '$client'>;

export class UserRepository implements IUserRepository {
    constructor(private readonly db: DatabaseClient) {}

    async findAll(deleted = false): Promise<User[]> {
        return this.db
            .select()
            .from(users)
            .where(
                deleted ? isNotNull(users.deletedAt) : isNull(users.deletedAt),
            )
            .orderBy(desc(users.createdAt));
    }

    async findById(id: string, includeDeleted = false): Promise<User | null> {
        const [user] = await this.db
            .select()
            .from(users)
            .where(
                and(
                    eq(users.id, id),
                    includeDeleted ? undefined : isNull(users.deletedAt),
                ),
            )
            .limit(1);
        return user ?? null;
    }

    async findByEmail(email: string): Promise<User | null> {
        const [user] = await this.db
            .select()
            .from(users)
            .where(eq(users.email, email))
            .limit(1);
        return user ?? null;
    }

    async create(input: NewUser): Promise<User> {
        const [newUser] = await this.db.insert(users).values(input).returning();
        return newUser;
    }

    async updateRole(
        id: string,
        role: string,
        departmentId?: string | null,
    ): Promise<User | null> {
        const [updated] = await this.db
            .update(users)
            .set({
                role,
                ...(departmentId !== undefined ? { departmentId } : {}),
                updatedAt: new Date(),
            })
            .where(and(eq(users.id, id), isNull(users.deletedAt)))
            .returning();
        return updated ?? null;
    }

    async updateDepartment(
        id: string,
        departmentId: string,
    ): Promise<User | null> {
        const [row] = await this.db
            .update(users)
            .set({ departmentId, updatedAt: new Date() })
            .where(and(eq(users.id, id), isNull(users.deletedAt)))
            .returning();
        return row ?? null;
    }
    async restore(
        id: string,
        departmentId: string | null,
        expectedSessionVersion: number,
    ): Promise<User | null> {
        const [row] = await this.db
            .update(users)
            .set({
                deletedAt: null,
                departmentId,
                updatedAt: new Date(),
                sessionVersion: sql`${users.sessionVersion} + 1`,
            })
            .where(
                and(
                    eq(users.id, id),
                    isNotNull(users.deletedAt),
                    eq(users.sessionVersion, expectedSessionVersion),
                ),
            )
            .returning();
        return row ?? null;
    }
    async softDelete(id: string): Promise<boolean> {
        const now = new Date();
        const rows = await this.db
            .update(users)
            .set({ deletedAt: now, updatedAt: now, departmentId: null })
            .where(and(eq(users.id, id), isNull(users.deletedAt)))
            .returning({ id: users.id });
        return rows.length > 0;
    }
    async updatePassword(id: string, hashedPassword: string): Promise<void> {
        await this.db
            .update(users)
            .set({ password: hashedPassword, updatedAt: new Date() })
            .where(and(eq(users.id, id), isNull(users.deletedAt)));
    }
}
