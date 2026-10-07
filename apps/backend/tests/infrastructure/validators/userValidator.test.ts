import { describe, expect, it } from '@jest/globals';
import {
    createUserSchema,
    updateUserSchema,
} from '@backend/src/infrastructure/validators/userValidator';

// ---- createUserSchema ----

describe('createUserSchema', () => {
    const validInput = {
        name: 'テストユーザー',
        email: 'test@example.com',
        password: 'password123',
        departmentId: '60000000-0000-4000-8000-000000000001',
    };

    it('正常な入力を受け付ける', () => {
        const result = createUserSchema.safeParse(validInput);
        expect(result.success).toBe(true);
    });

    it('roleを省略した場合はデフォルト値userが設定される', () => {
        const result = createUserSchema.safeParse(validInput);
        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.data.role).toBe('user');
    });

    it('管理者としての自己登録を拒否する', () => {
        expect(createUserSchema.safeParse({ ...validInput, role: 'admin' }).success).toBe(false);
    });
    it('部署未指定での登録を拒否する', () => {
        expect(createUserSchema.safeParse({ ...validInput, departmentId: undefined }).success).toBe(false);
    });

    it('nameが空文字の場合はエラーになる', () => {
        const result = createUserSchema.safeParse({ ...validInput, name: '' });
        expect(result.success).toBe(false);
    });

    it('nameが256文字以上の場合はエラーになる', () => {
        const result = createUserSchema.safeParse({ ...validInput, name: 'a'.repeat(256) });
        expect(result.success).toBe(false);
    });

    it('nameが255文字の場合は許可される', () => {
        const result = createUserSchema.safeParse({ ...validInput, name: 'a'.repeat(255) });
        expect(result.success).toBe(true);
    });

    it('メールアドレスの形式が不正な場合はエラーになる', () => {
        const result = createUserSchema.safeParse({ ...validInput, email: 'invalid-email' });
        expect(result.success).toBe(false);
    });

    it('@がないメールアドレスはエラーになる', () => {
        const result = createUserSchema.safeParse({ ...validInput, email: 'testexample.com' });
        expect(result.success).toBe(false);
    });

    it('パスワードが7文字以下の場合はエラーになる', () => {
        const result = createUserSchema.safeParse({ ...validInput, password: '1234567' });
        expect(result.success).toBe(false);
    });

    it('パスワードが8文字の場合は許可される', () => {
        const result = createUserSchema.safeParse({ ...validInput, password: '12345678' });
        expect(result.success).toBe(true);
    });
});

// ---- updateUserSchema ----

describe('updateUserSchema', () => {
    it('全フィールドを省略できる（空オブジェクトが有効）', () => {
        const result = updateUserSchema.safeParse({});
        expect(result.success).toBe(true);
    });

    it('一部のフィールドのみ指定できる', () => {
        const result = updateUserSchema.safeParse({ name: '新しい名前' });
        expect(result.success).toBe(true);
        if (!result.success) return;
        expect(result.data.name).toBe('新しい名前');
    });

    it('不正なメールアドレスはエラーになる', () => {
        const result = updateUserSchema.safeParse({ email: 'not-an-email' });
        expect(result.success).toBe(false);
    });

    it('8文字未満のパスワードはエラーになる', () => {
        const result = updateUserSchema.safeParse({ password: 'short' });
        expect(result.success).toBe(false);
    });
});
