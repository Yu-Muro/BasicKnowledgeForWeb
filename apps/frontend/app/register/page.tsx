'use client';

import { createUserSchema } from '@backend/src/infrastructure/validators/userValidator';
import { fetchFromBackend } from '@frontend/app/lib/backendFetch';
import { client } from '@frontend/app/utils/client';
import { Button } from '@frontend/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@frontend/components/ui/card';
import { Input } from '@frontend/components/ui/input';
import { Label } from '@frontend/components/ui/label';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

// バックエンドのスキーマを拡張してパスワード確認フィールドを追加
const registerSchema = createUserSchema
    .extend({ confirmPassword: z.string() })
    .refine((data) => data.password === data.confirmPassword, {
        message: 'パスワードが一致しません',
        path: ['confirmPassword'],
    });

// z.infer はデフォルト適用後の出力型、z.input はフォーム入力の型
type RegisterFormValues = z.input<typeof registerSchema>;

export default function RegisterPage() {
    const [departments, setDepartments] = useState<
        { id: string; name: string }[]
    >([]);
    const [departmentLoading, setDepartmentLoading] = useState(true);
    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const res = await fetchFromBackend('/api/departments');
                if (!res.ok) throw new Error();
                const body = (await res.json()) as {
                    departments: { id: string; name: string }[];
                };
                if (!Array.isArray(body.departments)) throw new Error();
                if (active) setDepartments(body.departments);
            } catch {
                if (active)
                    setServerError(
                        '部署一覧を取得できませんでした。ページを再読み込みしてください',
                    );
            } finally {
                if (active) setDepartmentLoading(false);
            }
        })();
        return () => {
            active = false;
        };
    }, []);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [serverError, setServerError] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
        reset,
        setError,
    } = useForm<RegisterFormValues>({
        resolver: zodResolver(registerSchema),
    });

    const onSubmit = async (data: RegisterFormValues) => {
        setServerError(null);
        try {
            const res = await client.api.users.$post({
                json: {
                    name: data.name,
                    email: data.email,
                    password: data.password,
                    departmentId: data.departmentId,
                },
            });
            const body = await res.json();

            if (res.ok) {
                reset();
                setSuccessMessage('登録が完了しました！');
                return;
            }

            if ('error' in body) {
                if (body.error === 'このメールアドレスは既に使用されています') {
                    setError('email', { message: body.error });
                } else {
                    setServerError(body.error);
                }
            }
        } catch {
            setServerError(
                '登録結果を確認できませんでした。時間をおいて再試行してください',
            );
        }
    };

    if (successMessage) {
        return (
            <div className='flex min-h-screen items-center justify-center p-4'>
                <Card className='w-full max-w-md'>
                    <CardContent className='pt-6 text-center'>
                        <p className='text-green-600'>{successMessage}</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className='flex min-h-screen items-center justify-center p-4'>
            <Card className='w-full max-w-md'>
                <CardHeader>
                    <CardTitle>ユーザー登録</CardTitle>
                    <CardDescription>
                        アカウントを作成してください
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form
                        onSubmit={handleSubmit(onSubmit)}
                        className='flex flex-col gap-4'
                    >
                        {serverError && (
                            <p className='text-destructive text-sm'>
                                {serverError}
                            </p>
                        )}

                        <div className='flex flex-col gap-1.5'>
                            <Label htmlFor='name'>名前</Label>
                            <Input
                                id='name'
                                {...register('name')}
                                aria-invalid={!!errors.name}
                            />
                            {errors.name && (
                                <p className='text-destructive text-xs'>
                                    {errors.name.message}
                                </p>
                            )}
                        </div>

                        <div className='flex flex-col gap-1.5'>
                            <Label htmlFor='departmentId'>所属部署</Label>
                            <select
                                id='departmentId'
                                {...register('departmentId')}
                                disabled={departmentLoading}
                                aria-invalid={!!errors.departmentId}
                                className='rounded-md border border-input bg-background px-3 py-2 text-sm'
                            >
                                <option value=''>
                                    {departmentLoading
                                        ? '読み込み中...'
                                        : '部署を選択してください'}
                                </option>
                                {departments.map((department) => (
                                    <option
                                        key={department.id}
                                        value={department.id}
                                    >
                                        {department.name}
                                    </option>
                                ))}
                            </select>
                            {errors.departmentId && (
                                <p className='text-destructive text-xs'>
                                    {errors.departmentId.message}
                                </p>
                            )}
                            {!departmentLoading && departments.length === 0 && (
                                <p className='text-destructive text-xs'>
                                    登録できる部署がありません。管理者にお問い合わせください。
                                </p>
                            )}
                        </div>
                        <div className='flex flex-col gap-1.5'>
                            <Label htmlFor='email'>メールアドレス</Label>
                            <Input
                                id='email'
                                type='email'
                                {...register('email')}
                                aria-invalid={!!errors.email}
                            />
                            {errors.email && (
                                <p className='text-destructive text-xs'>
                                    {errors.email.message}
                                </p>
                            )}
                        </div>

                        <div className='flex flex-col gap-1.5'>
                            <Label htmlFor='password'>パスワード</Label>
                            <Input
                                id='password'
                                type='password'
                                {...register('password')}
                                aria-invalid={!!errors.password}
                            />
                            {errors.password && (
                                <p className='text-destructive text-xs'>
                                    {errors.password.message}
                                </p>
                            )}
                        </div>

                        <div className='flex flex-col gap-1.5'>
                            <Label htmlFor='confirmPassword'>
                                パスワード（確認用）
                            </Label>
                            <Input
                                id='confirmPassword'
                                type='password'
                                {...register('confirmPassword')}
                                aria-invalid={!!errors.confirmPassword}
                            />
                            {errors.confirmPassword && (
                                <p className='text-destructive text-xs'>
                                    {errors.confirmPassword.message}
                                </p>
                            )}
                        </div>

                        <Button
                            type='submit'
                            disabled={
                                isSubmitting ||
                                departmentLoading ||
                                departments.length === 0
                            }
                            className='mt-2'
                        >
                            {isSubmitting ? '登録中...' : '登録する'}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
