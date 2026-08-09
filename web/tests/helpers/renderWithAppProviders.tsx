import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';
import React from 'react';
import { vi } from 'vitest';
import { AuthSessionContext, AuthSessionProvider, type AuthSessionContextValue } from '@/features/auth/auth-session';

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
}

function TestAuthSessionProvider({ children, authenticated = true }: { children: React.ReactNode; authenticated?: boolean }) {
  const session = React.useMemo<AuthSessionContextValue>(() => ({
    user: authenticated
      ? {
          id: 'test-user',
          email: 'test@example.com',
          displayName: 'Test User',
          avatarUrl: null,
          status: 'active',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          lastLoginAt: null,
        }
      : null,
    token: authenticated ? 'test-token' : null,
    isLoading: false,
    isAuthenticated: authenticated,
    registerAndSignIn: vi.fn(async () => undefined),
    signIn: vi.fn(async () => undefined),
    signOut: vi.fn(async () => undefined),
    refreshMe: vi.fn(async () => undefined),
    removeAccount: vi.fn(async () => undefined),
  }), [authenticated]);

  return (
    <AuthSessionContext.Provider value={session}>
      {children}
    </AuthSessionContext.Provider>
  );
}

export function renderWithAppProviders(ui: React.ReactElement, options?: RenderOptions & { authenticated?: boolean }) {
  const queryClient = createTestQueryClient();
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <TestAuthSessionProvider authenticated={options?.authenticated ?? true}>{children}</TestAuthSessionProvider>
    </QueryClientProvider>
  );

  return render(ui, { wrapper: Wrapper, ...options });
}
