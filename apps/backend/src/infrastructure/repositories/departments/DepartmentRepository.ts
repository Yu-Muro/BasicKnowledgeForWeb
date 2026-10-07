import type { createDatabaseClient } from '@backend/src/db/connection';
import { departments } from '@backend/src/db/schema';
import { asc, eq } from 'drizzle-orm';
import type {
    CreateDepartmentInput,
    Department,
    IDepartmentRepository,
    UpdateDepartmentInput,
} from './IDepartmentRepository';

type DatabaseClient = ReturnType<typeof createDatabaseClient>;

export class DepartmentRepository implements IDepartmentRepository {
    constructor(private readonly db: DatabaseClient) {}

    async findAll(): Promise<Department[]> {
        return this.db
            .select()
            .from(departments)
            .orderBy(asc(departments.name));
    }

    async create(input: CreateDepartmentInput): Promise<Department> {
        const [created] = await this.db
            .insert(departments)
            .values(input)
            .returning();
        return created;
    }

    async findById(id: string): Promise<Department | null> {
        const [row] = await this.db
            .select()
            .from(departments)
            .where(eq(departments.id, id))
            .limit(1);
        return row ?? null;
    }

    async update(
        id: string,
        input: UpdateDepartmentInput,
    ): Promise<Department | null> {
        const [updated] = await this.db
            .update(departments)
            .set({ ...input, updatedAt: new Date() })
            .where(eq(departments.id, id))
            .returning();
        return updated ?? null;
    }

    async delete(id: string): Promise<boolean> {
        const deleted = await this.db
            .delete(departments)
            .where(eq(departments.id, id))
            .returning({ id: departments.id });
        return deleted.length > 0;
    }
}
