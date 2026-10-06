'use client';

import { createContext, useContext } from 'react';

type AuthContextValue = {
    role: string;
    userEventId: string | null;
};

const AuthContext = createContext<AuthContextValue>({
    role: 'viewer',
    userEventId: null,
});

export function AuthProvider({
    value,
    children,
}: {
    value: AuthContextValue;
    children: React.ReactNode;
}) {
    return (
        <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    );
}

export function useAuthContext(): AuthContextValue {
    return useContext(AuthContext);
}
