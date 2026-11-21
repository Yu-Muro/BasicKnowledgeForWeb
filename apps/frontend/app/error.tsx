'use client';
export default function ErrorPage({
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <main className='mx-auto max-w-2xl space-y-4 px-4 py-12'>
            <h1 className='font-semibold text-xl'>
                ページを表示できませんでした
            </h1>
            <p>
                一時的に情報を取得できない可能性があります。時間をおいて再試行してください。
            </p>
            <button
                type='button'
                onClick={reset}
                className='rounded bg-primary px-4 py-2 text-primary-foreground'
            >
                再試行
            </button>
        </main>
    );
}
