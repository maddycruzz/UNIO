"use client";

import { ReactNode } from "react";
import { useAuth } from "@/lib/auth";

export type Role = "developer" | "president" | "mate";

export type PermissionAction =
  | "events.view"
  | "events.create"
  | "events.update"
  | "events.delete"
  | "tasks.view"
  | "tasks.create"
  | "tasks.update"
  | "tasks.delete"
  | "meetings.create"
  | "meetings.update"
  | "meetings.delete"
  | "participants.view"
  | "participants.create_walkin"
  | "participants.checkin"
  | "participants.delete"
  | "certificates.issue"
  | "team.invite"
  | "team.remove_member"
  | "settings.club"
  | "admin.cross_tenant";

/**
 * The SINGLE SOURCE OF TRUTH for UI-level permissions.
 * Note: Scoped constraints (like "mate can only update IF assigned")
 * are enforced at the data/RLS layer. If a role is in this list,
 * the UI buttons for that action are visible.
 */
export const PERMISSIONS: Record<PermissionAction, Role[]> = {
  "events.view": ["developer", "president", "mate"],
  "events.create": ["developer", "president"],
  "events.update": ["developer", "president", "mate"],
  "events.delete": ["developer", "president"],
  "tasks.view": ["developer", "president", "mate"],
  "tasks.create": ["developer", "president"],
  "tasks.update": ["developer", "president", "mate"],
  "tasks.delete": ["developer", "president"],
  "meetings.create": ["developer", "president"],
  "meetings.update": ["developer", "president", "mate"],
  "meetings.delete": ["developer", "president"],
  "participants.view": ["developer", "president", "mate"],
  "participants.create_walkin": ["developer", "president", "mate"],
  "participants.checkin": ["developer", "president", "mate"],
  "participants.delete": ["developer", "president"],
  "certificates.issue": ["developer", "president"],
  "team.invite": ["developer", "president"],
  "team.remove_member": ["developer", "president"],
  "settings.club": ["developer", "president"],
  "admin.cross_tenant": ["developer"],
};

/**
 * Core utility to check if a role has permission to perform an action.
 */
export function can(role: string | undefined | null, action: PermissionAction): boolean {
  if (!role) return false;
  const allowedRoles = PERMISSIONS[action];
  return allowedRoles.includes(role as Role);
}

/**
 * Hook to check permissions using the current authenticated user's role.
 */
export function useCan(action: PermissionAction): boolean {
  const { user } = useAuth();
  return can(user?.role, action);
}

/**
 * React Component to conditionally render UI based on the current user's permissions.
 */
export function PermissionGate({
  action,
  children,
  fallback = null,
}: {
  action: PermissionAction;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const isAllowed = useCan(action);
  return isAllowed ? <>{children}</> : <>{fallback}</>;
}
