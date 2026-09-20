'use client';

/**
 * Client-side RBAC helper for hiding UI based on the user's role.
 *
 * Use case: a button or section should not be rendered for users without the
 * required role. Pass an `allowed` list (or `group` shorthand from the server
 * `ROLE_GROUPS`) and the children render only if the role matches.
 *
 * Server-side authorization is still enforced at the route handler / server
 * component level; this is purely cosmetic for the UI.
 */
import { ReactNode } from 'react';
import { Role } from '@/lib/types';
import { ROLE_GROUPS } from '@/lib/rbac';

interface CanProps {
  allowed?: Role[];
  group?: keyof typeof ROLE_GROUPS;
  role: Role;
  fallback?: ReactNode;
  children: ReactNode;
}

export function Can({ allowed, group, role, fallback = null, children }: CanProps) {
  const allowedRoles = allowed ?? (group ? ROLE_GROUPS[group] : []);
  return allowedRoles.includes(role) ? <>{children}</> : <>{fallback}</>;
}

export function useCan(role: Role, allowed?: Role[], group?: keyof typeof ROLE_GROUPS): boolean {
  const allowedRoles = allowed ?? (group ? ROLE_GROUPS[group] : []);
  return allowedRoles.includes(role);
}
