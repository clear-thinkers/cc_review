import type { ReactNode } from 'react';
import { RouteGuard } from './RouteGuard';

export default function WordsLayout({ children }: { children: ReactNode }) {
  return (
    <RouteGuard>
      {children}
    </RouteGuard>
  );
}
