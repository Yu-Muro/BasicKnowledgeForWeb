'use client';

import {
    MAX_PASSWORD_LENGTH,
    PASSWORD_TOO_LONG_MESSAGE,
} from '@backend/src/infrastructure/validators/passwordPolicy';
import { changePasswordAction } from '@frontend/app/actions/dashboard';
import Link from 'next/link';
import { useState } from 'react';

export default function PasswordChangeForm() {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [isPending, setIsPending] = useState(false);

    const handleSubmit = async () => {
        setError(null);
        setSuccess(null);

        if (!currentPassword || !newPassword || !confirmPassword) {
            setError('すべての項目を入力してください');
            return;
        }
        if (newPassword.length < 8) {
            setError('新しいパスワードは8文字以上で入力してください');
            return;
        }
        if (newPassword.length > MAX_PASSWORD_LENGTH) {
            setError(PASSWORD_TOO_LONG_MESSAGE);
            return;
        }
        if (newPassword !== confirmPassword) {
            setError('新しいパスワードと確認用パスワードが一致しません');
            return;
        }

        setIsPending(true);
        try {
            const result = await changePasswordAction({
                currentPassword,
                newPassword,
            });
            if (!result.success) {
                setError(result.error);
            } else {
                setSuccess('パスワードを変更しました。再ログインしてください');
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
            }
        } finally {
            setIsPending(false);
        }
    };

    return (
        <section aria-labelledby='password-heading'>
            <h2
                id='password-heading'
                className='mb-4 font-semibold text-foreground text-lg'
            >
                パスワード変更
            </h2>
            <div className='rounded-lg border border-border bg-card p-6'>
                <div className='space-y-4'>
                    <div>
                        <label
                            htmlFor='currentPassword'
                            className='mb-1 block font-medium text-foreground text-sm'
                        >
                            現在のパスワード
                        </label>
                        <input
                            id='currentPassword'
                            type='password'
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            className='w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'
                            autoComplete='current-password'
                        />
                    </div>
                    <div>
                        <label
                            htmlFor='newPassword'
                            className='mb-1 block font-medium text-foreground text-sm'
                        >
                            新しいパスワード
                        </label>
                        <input
                            id='newPassword'
                            type='password'
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className='w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'
                            autoComplete='new-password'
                        />
                    </div>
                    <div>
                        <label
                            htmlFor='confirmPassword'
                            className='mb-1 block font-medium text-foreground text-sm'
                        >
                            確認
                        </label>
                        <input
                            id='confirmPassword'
                            type='password'
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className='w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring'
                            autoComplete='new-password'
                        />
                    </div>

                    {error && (
                        <p role='alert' className='text-destructive text-sm'>
                            {error}
                        </p>
                    )}
                    {success && (
                        <p
                            role='status'
                            className='rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-emerald-800 text-sm dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                        >
                            {success}
                            <Link href='/login' className='ml-2 underline'>
                                ログイン画面へ
                            </Link>
                        </p>
                    )}

                    <button
                        type='button'
                        onClick={handleSubmit}
                        disabled={isPending || Boolean(success)}
                        className='rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm transition-colors hover:bg-primary/90 disabled:opacity-50'
                    >
                        {isPending ? '変更中...' : '変更する'}
                    </button>
                </div>
            </div>
        </section>
    );
}
