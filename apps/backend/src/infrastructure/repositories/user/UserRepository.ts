import type { createDatabaseClient } from '@backend/src/db/connection';
import { authAccounts, authSessions, users } from '@backend/src/db/schema';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import type { IUserRepository, NewUser, User } from './IUserRepository';

type DatabaseClient = Pick<
    ReturnType<typeof createDatabaseClient>,
    'select' | 'insert' | 'update' | 'delete' | 'transaction' | 'execute'
>;

export class UserRepository implements IUserRepository {
    constructor(private readonly db: DatabaseClient) {}

    async findAll(): Promise<User[]> {
        return this.db
            .select()
            .from(users)
            .where(isNull(users.deletedAt))
            .orderBy(desc(users.createdAt));
    }

    async findById(id: string): Promise<User | null> {
        const [user] = await this.db
            .select()
            .from(users)
            .where(and(eq(users.id, id), isNull(users.deletedAt)))
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
        return this.db.transaction(async (tx) => {
            const [newUser] = await tx.insert(users).values(input).returning();
            await tx.insert(authAccounts).values({
                userId: newUser.id,
                accountId: newUser.id,
                providerId: 'credential',
                password: input.password,
            });
            return newUser;
        });
    }

    // Reconcile credentials written by the previous Worker during a rolling deployment.
    async ensureCredentialAccount(email: string): Promise<void> {
        await this.db.transaction(async (tx) => {
            // The previous Worker may have registered mixed-case email addresses.
            await tx.execute(sql`
                UPDATE users SET email = lower(email)
                WHERE lower(email) = ${email.toLowerCase()} AND email <> lower(email)
            `);
            await tx.execute(sql`
            INSERT INTO auth_accounts (user_id, account_id, provider_id, password)
            SELECT id, id::string, 'credential', password FROM users
            WHERE email = ${email.toLowerCase()} AND deleted_at IS NULL
            ON CONFLICT (provider_id, account_id) DO UPDATE SET password = excluded.password,
                updated_at = now()
            WHERE auth_accounts.password IS DISTINCT FROM excluded.password
        `);
        });
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
    async softDelete(id: string): Promise<boolean> {
        const now = new Date();
        const rows = await this.db
            .update(users)
            .set({ deletedAt: now, updatedAt: now })
            .where(and(eq(users.id, id), isNull(users.deletedAt)))
            .returning({ id: users.id });
        return rows.length > 0;
    }
    async updatePassword(id: string, hashedPassword: string): Promise<void> {
        await this.db.transaction(async (tx) => {
            const now = new Date();
            const changed = await tx
                .update(users)
                .set({ password: hashedPassword, updatedAt: now })
                .where(and(eq(users.id, id), isNull(users.deletedAt)))
                .returning({ id: users.id });
            if (changed.length === 0)
                throw new Error('ユーザーが見つかりません');
            await tx
                .update(authAccounts)
                .set({ password: hashedPassword, updatedAt: now })
                .where(
                    and(
                        eq(authAccounts.userId, id),
                        eq(authAccounts.providerId, 'credential'),
                    ),
                );
            await tx.delete(authSessions).where(eq(authSessions.userId, id));
        });
    }
}
