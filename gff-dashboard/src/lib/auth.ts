import { getServerSession } from "next-auth";
import { authOptions } from "./auth-options";
import type { AuditUser } from "./audit";

export async function getSession() {
  return getServerSession(authOptions);
}

export async function requireSession() {
  const session = await getSession();
  if (!session) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return session;
}

export function sessionToAuditUser(session: {
  user?: { id?: string; name?: string | null };
}): AuditUser {
  return {
    userId: session.user?.id ? Number(session.user.id) : null,
    username: session.user?.name ?? null,
  };
}
