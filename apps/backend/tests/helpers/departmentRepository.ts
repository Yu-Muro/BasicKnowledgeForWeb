import type { IDepartmentRepository } from '@backend/src/infrastructure/repositories/departments/IDepartmentRepository';
export const department = { id: '60000000-0000-4000-8000-000000000001', name: '企画部', createdAt: null, updatedAt: null };
export const departmentRepository: IDepartmentRepository = {
 findAll: async () => [department], findById: async (id) => id === department.id ? department : null,
 create: async (input) => ({ ...department, ...input }), update: async () => department, delete: async () => true,
};
