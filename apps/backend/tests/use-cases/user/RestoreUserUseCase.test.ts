import { RestoreUserUseCase } from '@backend/src/use-cases/user/RestoreUserUseCase';
import { describe, expect, it, jest } from '@jest/globals';
import { user, userRepository } from '../../helpers/userRepository';
import { departmentRepository } from '../../helpers/departmentRepository';
const deleted = { ...user, deletedAt: new Date(), departmentId: null };
describe('RestoreUserUseCase', () => {
 it('部署を指定して元のロール・IDで復元し秘密情報を返さない', async () => {
  const restore = jest.fn<ReturnType<typeof userRepository>['restore']>().mockResolvedValue({ ...user, sessionVersion: 1 });
  const result = await new RestoreUserUseCase(userRepository({ findById: async () => deleted, restore }), departmentRepository).execute(user.id, user.departmentId!);
  expect(restore).toHaveBeenCalledWith(user.id, user.departmentId);
  expect(result).toMatchObject({ success: true, data: { id: user.id, role: 'user' } });
  if(result.success) { expect(result.data).not.toHaveProperty('password'); expect(result.data).not.toHaveProperty('sessionVersion'); }
 });
 it.each([undefined, '00000000-0000-4000-8000-000000000099'])('一般ユーザーは未指定・存在しない部署を拒否する (%s)', async (departmentId) => {
  const restore = jest.fn<ReturnType<typeof userRepository>['restore']>();
  expect(await new RestoreUserUseCase(userRepository({ findById: async () => deleted, restore }), departmentRepository).execute(user.id, departmentId)).toMatchObject({ success: false, status: 400 });
  expect(restore).not.toHaveBeenCalled();
 });
 it('管理者は部署未指定で復元できる', async () => {
  const restore = jest.fn<ReturnType<typeof userRepository>['restore']>().mockResolvedValue({ ...user, role: 'admin', departmentId: null });
  expect(await new RestoreUserUseCase(userRepository({ findById: async () => ({ ...deleted, role: 'admin' }), restore }), departmentRepository).execute(user.id)).toMatchObject({ success: true });
  expect(restore).toHaveBeenCalledWith(user.id, null);
 });
 it.each([[null,404],[user,409]] as const)('未存在・有効なユーザーは復元しない', async (current,status) => {
  expect(await new RestoreUserUseCase(userRepository({ findById: async () => current }), departmentRepository).execute(user.id, user.departmentId!)).toMatchObject({ success:false, status });
 });
 it('競合して既に復元された場合は409', async () => {
  expect(await new RestoreUserUseCase(userRepository({ findById: async () => deleted, restore: async () => null }), departmentRepository).execute(user.id, user.departmentId!)).toMatchObject({ success:false, status:409 });
 });
 it('DBエラーをResultに変換する', async () => {
  expect(await new RestoreUserUseCase(userRepository({ findById: async () => { throw new Error('offline'); } }), departmentRepository).execute(user.id)).toMatchObject({ success:false, status:500 });
 });
});
