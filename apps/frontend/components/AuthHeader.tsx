'use client';

import { EventSelector } from '@frontend/components/EventSelector';
import { ThemeToggle } from '@frontend/components/ThemeToggle';
import { AlignRight, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type AccessCode = { id: string; eventName: string };

type Props = {
    role: string;
    userName: string | null;
    userEventId: string | null;
    userEventName: string | null;
    accessCodes: AccessCode[];
    logoutAction: () => Promise<void>;
};

const NAV_ITEMS = [
    { href: '/timetable', label: 'タイムテーブル' },
    { href: '/rooms', label: '部屋割り' },
    { href: '/events', label: '企画一覧' },
    { href: '/shop', label: '販売物' },
    { href: '/others', label: '情報' },
    { href: '/search', label: '検索' },
] as const;

export function buildNavigationHref(href: string, rawSearchParams: string) {
    const sourceParams = new URLSearchParams(rawSearchParams);
    const selectedEventId = sourceParams.get('event_id')?.trim() ?? '';
    const searchQuery = sourceParams.get('q')?.trim() ?? '';
    const params = new URLSearchParams();

    if (selectedEventId) {
        params.set('event_id', selectedEventId);
    }

    // q は検索ページ専用のため、他ページ遷移では引き継がない
    if (href === '/search' && searchQuery) {
        params.set('q', searchQuery);
    }

    const query = params.toString();
    return query ? `${href}?${query}` : href;
}

export function AuthHeader({
    role,
    userName,
    userEventId,
    userEventName,
    accessCodes,
    logoutAction,
}: Props) {
    const pathname = usePathname() ?? '';
    const searchParams = useSearchParams();
    const [drawerOpen, setDrawerOpen] = useState(false);
    const drawerRef = useRef<HTMLDivElement>(null);

    const isPrivileged = ['admin', 'user'].includes(role);

    const paramsString = useMemo(
        () => searchParams?.toString() ?? '',
        [searchParams],
    );

    const buildHref = useCallback(
        (href: string) => buildNavigationHref(href, paramsString),
        [paramsString],
    );

    const isActive = (href: string) => {
        if (href === '/') return pathname === '/';
        return pathname.startsWith(href);
    };

    const navItems = useMemo(() => {
        if (!isPrivileged) return NAV_ITEMS;
        return [...NAV_ITEMS, { href: '/dashboard', label: 'ダッシュボード' }];
    }, [isPrivileged]);

    // Escape key closes the drawer
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setDrawerOpen(false);
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Prevent body scroll when drawer is open
    useEffect(() => {
        document.body.style.overflow = drawerOpen ? 'hidden' : '';
        return () => {
            document.body.style.overflow = '';
        };
    }, [drawerOpen]);

    // Close drawer on route change
    // biome-ignore lint/correctness/useExhaustiveDependencies: pathnameの変更時にドロワーを閉じる
    useEffect(() => {
        setDrawerOpen(false);
    }, [pathname]);

    return (
        <header
            className='sticky top-0 z-50 border-b'
            style={{
                background: 'var(--header-bg)',
                color: 'var(--header-fg)',
                borderColor: 'var(--header-border)',
            }}
        >
            <div className='mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6'>
                {/* Left: logo / home link */}
                <Link
                    href={buildHref('/')}
                    className='text-sm font-semibold tracking-wide opacity-90 transition-opacity hover:opacity-100'
                >
                    {isPrivileged ? 'イベント管理' : 'スタッフポータル'}
                </Link>

                {/* Center: desktop nav */}
                <nav
                    aria-label='メインナビゲーション'
                    className='hidden items-center gap-1 md:flex'
                >
                    {navItems.map(({ href, label }) => (
                        <Link
                            key={href}
                            href={buildHref(href)}
                            className={`relative rounded-sm px-3 py-1.5 text-sm transition-colors ${
                                isActive(href)
                                    ? 'opacity-100 after:absolute after:inset-x-3 after:bottom-0 after:h-px after:bg-current'
                                    : 'opacity-60 hover:opacity-90'
                            }`}
                        >
                            {label}
                        </Link>
                    ))}
                </nav>

                {/* Right: event selector (admin/dev) or event name (user) + theme toggle + logout */}
                <div className='hidden items-center gap-3 md:flex'>
                    {isPrivileged && (
                        <EventSelector accessCodes={accessCodes} />
                    )}
                    {!isPrivileged && userEventName && (
                        <span className='text-sm opacity-60'>
                            {userEventName}
                        </span>
                    )}
                    <ThemeToggle />
                    <form action={logoutAction}>
                        <button
                            type='submit'
                            className='rounded-sm px-3 py-1.5 text-sm opacity-60 transition-colors hover:opacity-90'
                        >
                            ログアウト
                        </button>
                    </form>
                </div>

                {/* Mobile: hamburger */}
                <button
                    type='button'
                    aria-label='メニューを開く'
                    aria-expanded={drawerOpen}
                    aria-controls='mobile-drawer'
                    className='rounded-sm p-1.5 opacity-80 transition-opacity hover:opacity-100 md:hidden'
                    onClick={() => setDrawerOpen(true)}
                >
                    <AlignRight size={20} />
                </button>
            </div>

            {/* Mobile drawer backdrop */}
            {drawerOpen && (
                <div
                    aria-hidden='true'
                    className='fixed inset-0 z-40 bg-black/40 md:hidden'
                    onClick={() => setDrawerOpen(false)}
                />
            )}

            {/* Mobile drawer */}
            <div
                id='mobile-drawer'
                ref={drawerRef}
                role='dialog'
                aria-modal='true'
                aria-label='ナビゲーションメニュー'
                className={`fixed inset-y-0 right-0 z-50 flex w-64 flex-col shadow-xl transition-transform duration-300 ease-in-out md:hidden ${
                    drawerOpen ? 'translate-x-0' : 'translate-x-full'
                }`}
                style={{
                    background: 'var(--header-bg)',
                    color: 'var(--header-fg)',
                }}
            >
                <div className='flex h-14 items-center justify-between border-b border-[var(--header-border)] px-4'>
                    <span className='text-sm font-semibold opacity-90'>
                        {userName ?? 'メニュー'}
                    </span>
                    <button
                        type='button'
                        aria-label='メニューを閉じる'
                        className='rounded-sm p-1.5 opacity-70 hover:opacity-100'
                        onClick={() => setDrawerOpen(false)}
                    >
                        <X size={18} />
                    </button>
                </div>

                <nav
                    aria-label='モバイルナビゲーション'
                    className='flex-1 overflow-y-auto py-4'
                >
                    {navItems.map(({ href, label }) => (
                        <Link
                            key={href}
                            href={buildHref(href)}
                            className={`flex items-center px-6 py-3 text-sm transition-colors ${
                                isActive(href)
                                    ? 'opacity-100'
                                    : 'opacity-60 hover:opacity-90'
                            }`}
                        >
                            {isActive(href) && (
                                <span className='mr-3 h-1 w-1 rounded-full bg-current' />
                            )}
                            {!isActive(href) && <span className='mr-3 w-1' />}
                            {label}
                        </Link>
                    ))}
                </nav>

                <div className='border-t border-[var(--header-border)] p-4 space-y-3'>
                    <div className='flex items-center justify-between px-1'>
                        <span className='text-xs opacity-50'>テーマ</span>
                        <ThemeToggle />
                    </div>
                    {isPrivileged && (
                        <div>
                            <p className='mb-1.5 px-1 text-xs opacity-50'>
                                会期を切り替え
                            </p>
                            <EventSelector
                                accessCodes={accessCodes}
                                variant='drawer'
                            />
                        </div>
                    )}
                    {!isPrivileged && userEventName && (
                        <p className='px-1 text-sm opacity-60'>
                            {userEventName}
                        </p>
                    )}
                    <form action={logoutAction}>
                        <button
                            type='submit'
                            className='w-full rounded-sm px-3 py-2 text-left text-sm opacity-60 transition-colors hover:opacity-90'
                        >
                            ログアウト
                        </button>
                    </form>
                </div>
            </div>
        </header>
    );
}
