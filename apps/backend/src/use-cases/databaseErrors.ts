export function hasDatabaseError(error: unknown, code: string): boolean {
    let current = error;
    for (
        let depth = 0;
        depth < 5 && current && typeof current === 'object';
        depth++
    ) {
        const value = current as {
            code?: string;
            message?: string;
            cause?: unknown;
        };
        if (
            value.code === code ||
            value.message?.includes(`SQLSTATE ${code}`) ||
            (code === '23503' && value.message?.includes('foreign key'))
        )
            return true;
        current = value.cause;
    }
    return false;
}
