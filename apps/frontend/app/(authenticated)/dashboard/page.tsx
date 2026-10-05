import { fetchFromBackend } from '@frontend/app/lib/backendFetch';
import {
    type AuthPayload,
    decodeJwtPayload,
    resolveAuth,
} from '@frontend/app/lib/serverAuth';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import PasswordChangeForm from './PasswordChangeForm';
import UserRolePanel from './UserRolePanel';

type UserEntry = {
    id: string;
    name: string;
    email: string;
    role: 'user' | 'admin';
    departmentId?: string | null;
};

const ROLE_LABELS: Record<string, string> = {
    user: 'スタッフ',
    admin: '管理者',
};

async function fetchUsers(authToken: string): Promise<UserEntry[]> {
    try {
        const res = await fetchFromBackend('/api/users', {
            headers: { Cookie: `auth_token=${authToken}` },
            cache: 'no-store',
        });
        if (!res.ok) return [];
        const data = (await res.json()) as {
            users: Array<Omit<UserEntry, 'role'> & { role: string }>;
        };
        return (data.users ?? []).map((user) => ({
            ...user,
            role: user.role === 'admin' ? 'admin' : 'user',
        }));
    } catch {
        return [];
    }
}

async function fetchDepartments(): Promise<{ id: string; name: string }[]> {
    try {
        const res = await fetchFromBackend('/api/departments', {
            cache: 'no-store',
        });
        if (!res.ok) return [];
        const body = (await res.json()) as {
            departments?: { id: string; name: string }[];
        };
        return body.departments ?? [];
    } catch {
        return [];
    }
}

export default async function DashboardPage({
    searchParams,
}: {
    searchParams: Promise<{ event_id?: string }>;
}) {
    const resolvedParams = (await searchParams) ?? {};
    const preservedQuery = new URLSearchParams();
    if (resolvedParams.event_id) {
        preservedQuery.set('event_id', resolvedParams.event_id);
    }
    const queryString = preservedQuery.toString();
    const buildHref = (href: string) =>
        queryString ? `${href}?${queryString}` : href;

    const {
        authToken,
        role,
        user: currentUser,
    } = await resolveAuth(resolvedParams.event_id);

    if (!authToken) {
        redirect('/login');
    }

    const me = currentUser ?? decodeJwtPayload<AuthPayload>(authToken!);
    if (!me) {
        redirect('/login');
    }

    const isAdmin = role === 'admin';
    const users = isAdmin ? await fetchUsers(authToken!) : [];
    const departments = await fetchDepartments();

    return (
        <div className='space-y-8'>
            <h1 className='font-bold text-2xl text-foreground'>
                ダッシュボード
            </h1>

            {/* プロフィール */}
            <section aria-labelledby='profile-heading'>
                <h2
                    id='profile-heading'
                    className='mb-4 font-semibold text-foreground text-lg'
                >
                    プロフィール
                </h2>
                <div className='rounded-lg border border-border bg-card p-6'>
                    <dl className='space-y-3 text-sm'>
                        <div className='flex flex-col gap-1 sm:flex-row sm:gap-4'>
                            <dt className='w-24 font-medium text-muted-foreground'>
                                名前
                            </dt>
                            <dd className='text-foreground'>{me.name}</dd>
                        </div>
                        <div className='flex flex-col gap-1 sm:flex-row sm:gap-4'>
                            <dt className='w-24 font-medium text-muted-foreground'>
                                メール
                            </dt>
                            <dd className='break-all text-foreground'>
                                {me.email}
                            </dd>
                        </div>
                        <div className='flex flex-col gap-1 sm:flex-row sm:gap-4'>
                            <dt className='w-24 font-medium text-muted-foreground'>
                                所属部署
                            </dt>
                            <dd className='text-foreground'>
                                {departments.find(
                                    (department) =>
                                        department.id === me.departmentId,
                                )?.name ??
                                    (isAdmin ? '所属任意' : '所属未設定')}
                            </dd>
                        </div>
                        <div className='flex flex-col gap-1 sm:flex-row sm:gap-4'>
                            <dt className='w-24 font-medium text-muted-foreground'>
                                ロール
                            </dt>
                            <dd className='text-foreground'>
                                {ROLE_LABELS[me.role] ?? me.role}
                            </dd>
                        </div>
                    </dl>
                </div>
            </section>

            {/* パスワード変更 */}
            <PasswordChangeForm />

            {/* ユーザー管理（admin のみ） */}
            {isAdmin && (
                <UserRolePanel
                    initialUsers={users}
                    departments={departments}
                    currentUserId={me.id}
                />
            )}

            {/* 管理メニュー（admin のみ） */}
            {isAdmin && (
                <section aria-labelledby='admin-menu-heading'>
                    <h2
                        id='admin-menu-heading'
                        className='mb-4 font-semibold text-foreground text-lg'
                    >
                        管理メニュー
                    </h2>
                    <div className='rounded-lg border border-border bg-card p-6'>
                        <div className='flex flex-col gap-3'>
                            <Link
                                href={buildHref('/admin/access-codes')}
                                className='inline-flex items-center gap-2 font-medium text-primary text-sm hover:underline'
                            >
                                アクセスコード管理 →
                            </Link>
                            <Link
                                href='/departments'
                                className='inline-flex items-center gap-2 font-medium text-primary text-sm hover:underline'
                            >
                                部署管理 →
                            </Link>
                        </div>
                    </div>
                </section>
            )}
        </div>
    );
}
