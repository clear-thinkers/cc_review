import type { UserRole } from './auth.types';

export type ProtectedRoute = 
  | '/words'
  | '/words/add'
  | '/words/all'
  | '/words/admin'
  | '/words/prompts'
  | '/words/results'
  | '/words/shop'
  | '/words/review'
  | '/words/review/flashcard'
  | '/words/review/fill-test'
  | '/words/debug';

/**
 * Checks if the current user can access a given route.
 * Platform admin bypasses all restrictions.
 * 
 * Permission matrix:
 * - Child: app flow, review (flashcard + fill-test), all, results
 * - Parent: app flow, add, admin, all, results, review, flashcard (NO fill-test)
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
    case '/words/shop':
      return role === 'child';
    
    case '/words':
    case '/words/all':
    case '/words/results':
    case '/words/review':
    case '/words/review/flashcard':
      return true; // Both roles allowed

    case '/words/debug':
      return isPlatformAdmin;
    
    default:
      return true; // Unknown routes pass through
  }
}
