export type UserRole = "admin" | "user" | "lambo";

export function normalizeRole(role: string | undefined | null): UserRole {
  if (role === "user" || role === "lambo") return role;
  return "admin";
}

export function canAccessRoute(
  role: string | undefined | null,
  pathname: string,
): boolean {
  const r = normalizeRole(role);

  if (pathname.startsWith("/reports")) {
    return r === "admin";
  }

  if (pathname.startsWith("/activity")) {
    return r === "admin" || r === "user";
  }

  if (pathname.startsWith("/settings")) {
    return r === "admin" || r === "user";
  }

  if (pathname.startsWith("/daily-gffs")) {
    return false;
  }

  return true;
}

export function canAccessNav(
  role: string | undefined | null,
  href: string,
): boolean {
  return canAccessRoute(role, href);
}

export function canEditForecastParameters(role: string | undefined | null): boolean {
  return normalizeRole(role) === "admin";
}

export function canAccessWorkbookImportExport(
  role: string | undefined | null,
): boolean {
  const r = normalizeRole(role);
  return r === "admin" || r === "user";
}
