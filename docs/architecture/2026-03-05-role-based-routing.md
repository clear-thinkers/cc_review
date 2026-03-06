# Feature Spec — 2026-03-05 — Role-Based Routing

## Problem

Current navigation shows all routes to all users regardless of role. Children can access `/words/add` and `/words/admin` (content curation) when they should focus on learning only. Parents can access fill-test quiz when that mode is designed for child learners. All role restrictions must be enforced with UX clarity (hidden routes, not 403 errors).

---

## Scope

- Permission matrix by role (child/parent/admin)
- Nav item filtering based on session role
- Route protection via client-side RouteGuard
- Graceful redirect for blocked routes (no 403 errors)

---

## Out of Scope

- Server-side API route protection (already handled by RLS)
- Role editing or promotion UI
- Admin-only page template
- Bulk permission management
- Content pack purchase auth (deferred)

---

## Proposed Behavior

### Permission Matrix

| Route | Child | Parent | Platform Admin |
|---|---|---|---|
| `/words/add` | ❌ | ✅ | ✅ |
| `/words/all` | ✅ | ✅ | ✅ |
| `/words/admin` | ❌ | ✅ | ✅ |
| `/words/results` | ✅ | ✅ | ✅ |
| `/words/review` | ✅ | ✅ | ✅ |
| `/words/review/flashcard` | ✅ | ✅ | ✅ |
| `/words/review/fill-test` | ✅ | ❌ | ✅ |

**Key rules**:
- **Child accounts**: Can review (flashcard and fill-test), view all characters, view quiz results. Cannot add characters, cannot curate content.
- **Parent accounts**: Can add characters, curate content, view all data. Cannot take fill-test quiz (restricted to child learning mode).
- **Platform admin**: Full access (isPlatformAdmin flag bypasses all role restrictions).

**UX behavior**:
- Blocked routes are **hidden from navigation** (not shown as disabled or grayed out).
- Direct URL navigation to a blocked route → redirect to `/words/review` (no error message, no 403).
- Fill-test start button hidden from review page for parent accounts (fill-test is child-only).

---

## Layer Impact

### UI Layer
- **New file**: `src/lib/permissions.ts` — permission matrix and route access logic
- **New file**: `src/app/words/RouteGuard.tsx` — client-side route guard component
- **Modified**: `src/app/words/shared/words.shared.utils.tsx` — filter `getNavItems()` by role
- **Modified**: `src/app/words/shared/words.shared.state.ts` — pass session role to `getNavItems()`
- **Modified**: `src/app/words/layout.tsx` — wrap with RouteGuard
- **Modified**: `src/app/words/review/ReviewSection.tsx` — hide fill-test button for child accounts

### Domain Layer
No changes. Scheduler remains a pure function.

### Service Layer
No changes. RLS policies already enforce data isolation.

### AI Layer
No changes.

---

## Edge Cases

1. **Session expires mid-navigation**: SessionGuard handles this (redirects to `/login`).
2. **Role changes**: Users must sign out and sign back in for role changes to take effect.
3. **Platform admin with child role**: isPlatformAdmin flag wins (full access regardless of role field).
4. **Unauthenticated user**: SessionGuard catches this before RouteGuard runs.
5. **Parent navigates to fill-test then logs in as child**: RouteGuard triggers on mount, redirects child immediately.

---

## Risks

**Low risk**:
- No database schema changes
- No scheduler logic changes
- Client-side only (RLS already protects data)
- No API route changes

**Mitigation**:
- Manual testing with all three roles (child, parent, admin)
- Verify redirect behavior for each blocked route
- Ensure nav items update reactively when session changes

---

## Implementation Plan

### Phase 1: Create Permission Matrix Module

**File**: `src/lib/permissions.ts`

```typescript
import type { UserRole } from './auth.types';

export type ProtectedRoute = 
  | '/words/add'
  | '/words/all'
  | '/words/admin'
  | '/words/results'
  | '/words/review'
  | '/words/review/flashcard'
  | '/words/review/fill-test';

/**
 * Checks if the current user can access a given route.
 * Platform admin bypasses all restrictions.
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
```

---

### Phase 2: Create RouteGuard Component

**File**: `src/app/words/RouteGuard.tsx`

```typescript
'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSession } from '@/lib/authContext';
import { canAccessRoute } from '@/lib/permissions';

/**
 * RouteGuard — Role-Based Route Protection
 *
 * Enforces permission matrix by session role. Blocked routes redirect
 * to /words/review with no error message (not 403).
 *
 * Depends on SessionGuard running first (session must exist).
 */
export function RouteGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const session = useSession();

  useEffect(() => {
    if (!session) return; // SessionGuard handles auth
    
    const allowed = canAccessRoute(
      pathname,
      session.role,
      session.isPlatformAdmin
    );
    
    if (!allowed) {
      router.replace('/words/review');
    }
  }, [pathname, session, router]);

  return <>{children}</>;
}
```

---

### Phase 3: Update Navigation Filtering

**File**: `src/app/words/shared/words.shared.utils.tsx`

Update `getNavItems()` signature and implementation:

```typescript
export function getNavItems(
  str: WordsLocaleStrings,
  role: UserRole | undefined,
  isPlatformAdmin: boolean
): NavItem[] {
  const allItems: NavItem[] = [
    { href: "/words/add", label: str.nav.addCharacters, page: "add" },
    { href: "/words/all", label: str.nav.allCharacters, page: "all" },
    { href: "/words/admin", label: str.nav.contentAdmin, page: "admin" },
    { href: "/words/results", label: str.nav.quizResults, page: "results" },
    { href: "/words/review", label: str.nav.dueReview, page: "review" },
  ];

  return allItems.filter(item => 
    canAccessRoute(item.href, role, isPlatformAdmin)
  );
}
```

Add import:
```typescript
import { canAccessRoute } from '@/lib/permissions';
import type { UserRole } from '@/lib/auth.types';
```

---

### Phase 4: Update State Hook to Pass Role

**File**: `src/app/words/shared/words.shared.state.ts`

Update where `getNavItems()` is called (around line 2713):

```typescript
const session = useSession();
const navItems = getNavItems(
  str,
  session?.role,
  session?.isPlatformAdmin ?? false
);
```

Add import at top:
```typescript
import { useSession } from "@/lib/authContext";
```

---

### Phase 5: Wrap Layout with RouteGuard

**File**: `src/app/words/layout.tsx`

Add RouteGuard wrapper:

```typescript
import { RouteGuard } from './RouteGuard';

export default function WordsLayout({ children }: { children: ReactNode }) {
  return (
    <RouteGuard>
      {children}
    </RouteGuard>
  );
}
```

---

### Phase 6: Hide Fill-Test Button for Parents

**File**: `src/app/words/review/ReviewSection.tsx` (or wherever fill-test start button lives)

Add conditional rendering (fill-test is child-only):

```typescript
import { useSession } from '@/lib/authContext';
import { canAccessRoute } from '@/lib/permissions';

// Inside component:
const session = useSession();
const canAccessFillTest = canAccessRoute(
  '/words/review/fill-test',
  session?.role,
  session?.isPlatformAdmin ?? false
);

// In JSX:
{canAccessFillTest && (
  <button onClick={handleStartFillTest}>
    {str.review.startFillTest}
  </button>
)}
```

---

## Test Plan

### Manual Testing Checklist

**Child account**:
- [ ] Nav shows only: All Characters, Quiz Results, Due Review
- [ ] Direct URL to `/words/add` → redirect to `/words/review`
- [ ] Direct URL to `/words/admin` → redirect to `/words/review`
- [ ] Flashcard review works (`/words/review/flashcard`)
- [ ] Fill-test button visible and works
- [ ] Fill-test quiz accessible (`/words/review/fill-test`)

**Parent account**:
- [ ] Nav shows all 5 items (Add, All, Admin, Results, Review)
- [ ] All routes accessible except fill-test
- [ ] Fill-test button hidden from review page
- [ ] Direct URL to `/words/review/fill-test` → redirect to `/words/review`

**Platform admin**:
- [ ] Nav shows all items
- [ ] All routes accessible (same as parent but with admin flag)
- [ ] Can access all features regardless of role field value

### Integration Tests (deferred to post-ship)

Create `src/app/words/RouteGuard.test.tsx`:
- Test permission matrix against all role combinations
- Mock useSession with different roles
- Verify redirect behavior for blocked routes

---

## Acceptance Criteria

- [ ] Permission matrix module created and tested
- [ ] RouteGuard component enforces redirect for blocked routes
- [ ] Navigation items filtered by role (blocked routes hidden)
- [ ] Fill-test button hidden for child accounts
- [ ] Direct URL navigation to blocked routes redirects gracefully (no 403)
- [ ] All three roles tested manually (child, parent, admin)
- [ ] No console errors or warnings
- [ ] 0_ARCHITECTURE.md updated with routing rules
- [ ] 0_PRODUCT_ROADMAP.md Feature 6 marked complete

---

## Open Questions

None. All design decisions closed.

---

## Documentation Updates

### Update `docs/architecture/0_ARCHITECTURE.md`

Add new section under § 1) Product Rules:

```markdown
### Role-Based Routing Rules (`/words/*`)

Route access enforced by clien (flashcard and fill-test), all characters, quiz results. Cannot access add or admin (content curation restricted to parents).
- **Parent**: Can access add, admin, all, results, review, flashcard. Cannot access fill-test (learning mode restricted to children)rd, all characters, quiz results. Cannot access add, admin, or fill-test.
- **Parent**: Full access to all routes.
- **Platform admin**: Full access (isPlatformAdmin flag bypasses role restrictions).

Blocked routes are hidden from navigation (not shown as disabled). Direct URL access to blocked routes redirects to `/words/review` with no error message.

Role enforcement is UI-only; database operations protected by RLS policies at the data layer.
```

### Update `docs/architecture/0_PRODUCT_ROADMAP.md`

Change Feature 6 status:
```markdown
| 6 | **Role-Based Routing** | ... | ... | ✅ Done | 2026-03-XX |
```

---

## Estimated Effort

- Spec creation: 30 min ✅
- Implementation: 2-3 hours
- Testing: 1 hour
- Documentation: 30 min
- **Total: 4-5 hours** (can ship same day)

---

## Dependencies

- ✅ Feature 4 (Auth & User Model) — provides session.role and session.isPlatformAdmin
- ✅ SessionGuard — ensures authenticated session exists before RouteGuard runs

---

## Deliverables

**New files**:
- `docs/feature-specs/2026-03-05-role-based-routing.md` (this file)
- `src/lib/permissions.ts`
- `src/app/words/RouteGuard.tsx`

**Modified files**:
- `src/app/words/shared/words.shared.utils.tsx`
- `src/app/words/shared/words.shared.state.ts`
- `src/app/words/layout.tsx`
- `src/app/words/review/ReviewSection.tsx` (or similar — fill-test button location)
- `docs/architecture/0_ARCHITECTURE.md`
- `docs/architecture/0_PRODUCT_ROADMAP.md`

**Branch**: `feat/role-based-routing`

**Commit message**:
```
feat: implement role-based routing (Feature 6)

- Add permission matrix module (src/lib/permissions.ts)
- Create RouteGuard component for route protection
- Filter nav items by role in getNavItems()
- Block fill-test route for child accounts
- Hide blocked routes from navigation (not 403)
- Update 0_ARCHITECTURE.md with routing rules
- Mark Feature 6 complete in 0_PRODUCT_ROADMAP.md

Child: review/flashcard/all/results only
Parent: full access
Platform admin: full access

No server-side changes (RLS already enforces data isolation)
```

---

## Compliance Check

✅ Feature spec created (BUILD_CONVENTIONS § Feature Specs)  
✅ No hard stops violated (AI_CONTRACT § 2)  
✅ Docs updated in same commit (AI_CONTRACT § 4)  
✅ Layer boundaries preserved (UI-only changes)  
✅ No scheduler logic changes  
✅ No database schema changes  
✅ RLS policies remain unchanged
