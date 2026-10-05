import { fetchFromBackend } from '@frontend/app/lib/backendFetch';
import { resolveAuth } from '@frontend/app/lib/serverAuth';
import { redirect } from 'next/navigation';
import DepartmentAdminPanel from './DepartmentAdminPanel';
export default async function DepartmentsPage() {
    const { role } = await resolveAuth();
    if (role !== 'admin') redirect('/dashboard');
    const res = await fetchFromBackend('/api/departments', {
        cache: 'no-store',
    });
    if (!res.ok) return <p role='alert'>部署一覧を取得できませんでした</p>;
    const { departments } = (await res.json()) as {
        departments: { id: string; name: string }[];
    };
    return <DepartmentAdminPanel departments={departments} />;
}
