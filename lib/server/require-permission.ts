import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { PERMISSIONS, type PermissionAction, type Role } from "@/lib/permissions";

/**
 * Ensures the authenticated user has permission to perform the requested action.
 * Throws an Error if unauthorized, which can be caught by Next.js Error Boundaries
 * or returned as a structured error in Server Actions.
 */
export async function requirePermission(action: PermissionAction) {
  const cookieStore = await cookies();
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized: User not logged in");
  }

  // Fetch the role from the profiles table
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = (profile?.role || "mate") as Role;

  const allowedRoles = PERMISSIONS[action];
  if (!allowedRoles.includes(role)) {
    // Ideally log to activity_log here
    await supabase.from("activity_log").insert({
      title: "Permission Denied",
      meta: `User attempted ${action} without required role`,
      organizer_id: user.id
    });
    
    throw new Error(`Forbidden: You do not have permission to perform ${action}`);
  }

  return { user, role, supabase };
}
