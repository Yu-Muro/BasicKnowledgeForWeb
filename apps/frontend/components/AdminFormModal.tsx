'use client';

import { Dialog } from '@base-ui/react/dialog';
import { Button } from '@frontend/components/ui/button';
import { type ReactNode, useRef } from 'react';

type Props = {
    title: string;
    onClose: () => void;
    isPending: boolean;
    error: string | null;
    children: ReactNode;
};

export default function AdminFormModal({
    title,
    onClose,
    isPending,
    error,
    children,
}: Props) {
    const returnFocus = useRef(
        typeof document !== 'undefined' ? document.activeElement : null,
    );

    return (
        <Dialog.Root
            open
            disablePointerDismissal={isPending}
            onOpenChange={(open, details) => {
                if (isPending) {
                    details.cancel();
                    return;
                }
                if (!open) onClose();
            }}
        >
            <Dialog.Portal>
                <Dialog.Backdrop
                    data-testid='admin-form-backdrop'
                    className='fixed inset-0 z-50 bg-black/50'
                />
                <Dialog.Popup
                    finalFocus={() =>
                        returnFocus.current instanceof HTMLElement
                            ? returnFocus.current
                            : null
                    }
                    className='fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border border-border bg-card text-foreground shadow-xl outline-none'
                >
                    <div className='flex shrink-0 items-center justify-between gap-4 border-border border-b p-4'>
                        <Dialog.Title className='font-semibold text-lg'>
                            {title}
                        </Dialog.Title>
                        <Dialog.Close
                            render={<Button size='sm' variant='ghost' />}
                            disabled={isPending}
                        >
                            閉じる
                        </Dialog.Close>
                    </div>
                    <div className='min-h-0 overflow-y-auto overscroll-contain p-4'>
                        {error && (
                            <p
                                role='alert'
                                className='mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-red-700 text-sm dark:border-red-800 dark:bg-red-950/40 dark:text-red-400'
                            >
                                {error}
                            </p>
                        )}
                        <fieldset disabled={isPending}>{children}</fieldset>
                    </div>
                </Dialog.Popup>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
