import type { users } from '@backend/src/db/schema';

export type User = typeof users.$inferSelect;

export type UserPublic = Omit<User, 'password' | 'sessionVersion'>;

export type NewUser = {
    name: string;
    email: string;
    password: string;
    role: string;
    departmentId: string;
};

export interface IUserRepository {
    findAll(deleted?: boolean): Promise<User[]>;
    findById(id: string, includeDeleted?: boolean): Promise<User | null>;
    findByEmail(email: string): Promise<User | null>;
    create(input: NewUser): Promise<User>;
    updateRole(
        id: string,
        role: string,
        departmentId?: string | null,
    ): Promise<User | null>;
    updateDepartment(id: string, departmentId: string): Promise<User | null>;
    restore(id: string, departmentId: string | null): Promise<User | null>;
    softDelete(id: string): Promise<boolean>;
    updatePassword(id: string, hashedPassword: string): Promise<void>;
}
