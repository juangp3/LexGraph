import { type ReactNode } from 'react';

interface WorkspaceLayoutProps {
  children: ReactNode;
}

export default function WorkspaceLayout({ children }: WorkspaceLayoutProps) {
  return (
    <div className="h-screen w-screen overflow-auto">
      <main className="h-full">{children}</main>
    </div>
  );
}
