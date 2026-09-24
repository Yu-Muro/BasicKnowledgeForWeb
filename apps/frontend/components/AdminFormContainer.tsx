'use client';

import { Dialog } from '@base-ui/react/dialog';
import type { ReactNode } from 'react';

type Props = {
    children: ReactNode;
    editing: boolean;
    error: string | null;
    isPending: boolean;
    onClose: () => void;
    title: string;
};

const titleClassName = 'mb-4 font-medium text-foreground text-sm';

function ErrorMessage({ error }: Pick<Props, 'error'>) {
    if (!error) return null;

    return (
        <p
            role='alert'
            className='mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-red-700 text-sm dark:border-red-800 dark:bg-red-950/40 dark:text-red-400'
        >
            {error}
        </p>
    );
}

export function AdminFormContainer({
    children,
    editing,
    error,
    isPending,
    onClose,
    title,
}: Props) {
    if (!editing) {
        return (
            <div className='mb-6 rounded-xl border border-border bg-card p-4 shadow-sm'>
                <h2 className={titleClassName}>{title}</h2>
                {children}
            </div>
        );
    }

    return (
        <Dialog.Root
            open
            disablePointerDismissal={isPending}
            onOpenChange={(open) => {
                if (!open && !isPending) onClose();
            }}
        >
            <Dialog.Portal>
                <Dialog.Backdrop className='fixed inset-0 z-50 min-h-dvh bg-black/55' />
                <Dialog.Viewport className='fixed inset-0 z-50 flex items-center justify-center p-4'>
                    <Dialog.Popup className='relative max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-card p-4 shadow-xl sm:p-6'>
                        <Dialog.Title className={titleClassName}>
                            {title}
                        </Dialog.Title>
                        <Dialog.Close
                            aria-label='閉じる'
                            disabled={isPending}
                            className='absolute top-3 right-3 flex size-8 items-center justify-center rounded-md text-muted-foreground text-xl leading-none hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50'
                        >
                            <span aria-hidden='true'>×</span>
                        </Dialog.Close>
                        <ErrorMessage error={error} />
                        {children}
                    </Dialog.Popup>
                </Dialog.Viewport>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
