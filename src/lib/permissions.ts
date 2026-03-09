import type { UserRole } from './auth.types';

export type ProtectedRoute = 
  | '/words/add'
  | '/words/all'
  | '/words/admin'
  | '/words/prompts'
  | '/words/results'
  | '/words/review'
  | '/words/review/flashcard'
  | '/words/review/fill-test';

/**
 * Checks if the current user can access a given route.
 * Platform admin bypasses all restrictions.
 * 
 * Permission matrix:
 * - Child: review (flashcard + fill-test), all, results
 * - Parent: add, admin, all, results, review, flashcard (NO fill-test)
 */
export function canAccessRoute(
  route: string,
  role: UserRole | undefined,
  isPlatformAdmin: boolean
): boolean {
  if (isPlatformAdmin) return true;
  if (!role) return false;

  switch (route) {
    case '/words/add':
    case '/words/admin':
    case '/words/prompts':
      return role === 'parent';
    
    case '/words/review/fill-test':
      return role === 'child';
    
    case '/words/all':
    case '/words/results':
    case '/words/review':
    case '/words/review/flashcard':
      return true; // Both roles allowed
    
    default:
      return true; // Unknown routes pass through
  }
}
