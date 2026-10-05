import { describe, expect, it, jest } from '@jest/globals';
import { Hono } from 'hono';
import { sign } from 'hono/jwt';
import type { Env } from '@backend/src/db/connection';
import type { IUserRepository, User } from '@backend/src/infrastructure/repositories/user/IUserRepository';
import { createUserRoutes } from '@backend/src/presentation/routes/userRoutes';
import { createSessionValidation } from '@backend/src/presentation/routes/sessionValidation';
import { createDepartmentRoutes } from '@backend/src/presentation/routes/departmentRoutes';
import { department, departmentRepository } from '../helpers/departmentRepository';
const env = { JWT_SECRET: 'test-secret' } as Env;
const id = '00000000-0000-4000-8000-000000000001';
const admin: User = { id, name: '管理者', email: 'admin@test.com', password: 'hash', role: 'admin', departmentId: null, createdAt: null, updatedAt: null, deletedAt: null };
function repository(overrides: Partial<IUserRepository> = {}): IUserRepository {
 return { findAll: async () => [], findById: async () => admin, findByEmail: async () => null, create: async () => admin, updateRole: async () => admin, updateDepartment: async () => admin, softDelete: async () => true, updatePassword: async () => {}, ...overrides };
}
async function cookie(role = 'admin') { return `auth_token=${await sign({ id, role, exp: Math.floor(Date.now()/1000)+3600 }, env.JWT_SECRET)}`; }
function app(repo: IUserRepository) {
 const app = new Hono<{ Bindings: Env }>();
 app.use('/api/*', createSessionValidation(() => repo));
 app.route('/api', createUserRoutes(() => repo, () => departmentRepository));
 app.route('/api', createDepartmentRoutes(() => departmentRepository));
 return app;
}
const target = '00000000-0000-4000-8000-000000000002';
describe('ユーザー管理とセッションの失効', () => {
 it('管理者だけが他のユーザーを論理削除できる', async () => {
  const softDelete = jest.fn<IUserRepository['softDelete']>().mockResolvedValue(true);
  const res = await app(repository({ softDelete })).request(`/api/users/${target}`, { method: 'DELETE', headers: { Cookie: await cookie() } }, env);
  expect(res.status).toBe(200); expect(softDelete).toHaveBeenCalledWith(target);
 });
 it('自分自身は削除できない', async () => {
  const softDelete = jest.fn<IUserRepository['softDelete']>();
  const res = await app(repository({ softDelete })).request(`/api/users/${id}`, { method: 'DELETE', headers: { Cookie: await cookie() } }, env);
  expect(res.status).toBe(400); expect(softDelete).not.toHaveBeenCalled();
 });
 it.each(['DELETE', 'PUT'])('一般ユーザーの管理操作 %s を拒否する', async (method) => {
  const repo = repository({ findById: async () => ({ ...admin, role: 'user', departmentId: department.id }) });
  const res = await app(repo).request(`/api/users/${target}${method === 'PUT' ? '/department' : ''}`, { method, headers: { Cookie: await cookie('user') } }, env);
  expect(res.status).toBe(403);
 });
 it('削除済みユーザーの有効な古いトークンを拒否する', async () => {
  const res = await app(repository({ findById: async () => ({ ...admin, deletedAt: new Date() }) })).request('/api/users', { headers: { Cookie: await cookie() } }, env);
  expect(res.status).toBe(401);
 });
 it('管理者から降格後の古い管理者トークンを拒否する', async () => {
  const repo = repository({ findById: async () => ({ ...admin, role: 'user', departmentId: department.id }) });
  const res = await app(repo).request('/api/departments', { method: 'POST', headers: { Cookie: await cookie(), 'Content-Type': 'application/json' }, body: JSON.stringify({ name: '新部署' }) }, env);
  expect(res.status).toBe(403);
 });
 it('所属未設定の既存一般ユーザーを拒否する', async () => {
  const res = await app(repository({ findById: async () => ({ ...admin, role: 'user' }) })).request('/api/users', { headers: { Cookie: await cookie('user') } }, env);
  expect(res.status).toBe(403);
 });
 it('DBが取得できない場合は管理操作を通さない', async () => {
  const res = await app(repository({ findById: async () => { throw new Error('offline'); } })).request('/api/users', { headers: { Cookie: await cookie() } }, env);
  expect(res.status).toBe(503);
 });
 it('一般ユーザーへのロール変更は部署が必要', async () => {
  const res = await app(repository()).request(`/api/users/${target}/role`, { method: 'PUT', headers: { Cookie: await cookie(), 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'user' }) }, env);
  expect(res.status).toBe(400);
 });
 it('ロールと部署を一緒に更新する', async () => {
  const updateRole = jest.fn<IUserRepository['updateRole']>().mockResolvedValue(admin);
  const res = await app(repository({ updateRole })).request(`/api/users/${target}/role`, { method: 'PUT', headers: { Cookie: await cookie(), 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'user', departmentId: department.id }) }, env);
  expect(res.status).toBe(200); expect(updateRole).toHaveBeenCalledWith(target, 'user', department.id);
 });
 it('管理者が既存ユーザーの部署を指定できる', async () => {
  const updateDepartment = jest.fn<IUserRepository['updateDepartment']>().mockResolvedValue(admin);
  const res = await app(repository({ updateDepartment })).request(`/api/users/${target}/department`, { method: 'PUT', headers: { Cookie: await cookie(), 'Content-Type': 'application/json' }, body: JSON.stringify({ departmentId: department.id }) }, env);
  expect(res.status).toBe(200); expect(updateDepartment).toHaveBeenCalledWith(target, department.id);
 });
 it('存在しない部署への所属変更を拒否する', async () => {
  const res = await app(repository()).request(`/api/users/${target}/department`, { method: 'PUT', headers: { Cookie: await cookie(), 'Content-Type': 'application/json' }, body: JSON.stringify({ departmentId: target }) }, env);
  expect(res.status).toBe(400);
 });
 it('管理者として自己登録できない', async () => {
  const res = await app(repository()).request('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: '攻撃者', email: 'new@test.com', password: 'password123', departmentId: department.id, role: 'admin' }) }, env);
  expect(res.status).toBe(400);
 });
});
