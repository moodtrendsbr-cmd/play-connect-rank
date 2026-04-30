/**
 * Returns the dashboard path for a given user role.
 * Used by "Voltar" buttons across the app to land users on their own dashboard.
 */
export function dashboardPathFor(role?: string | null): string {
  switch (role) {
    case "admin":
      return "/admin";
    case "tenant":
      return "/tenant/dashboard";
    case "arena":
      return "/arena/dashboard";
    case "organizer":
      return "/organizer/dashboard";
    case "company":
      return "/company/dashboard";
    case "athlete":
      return "/athlete/feed";
    default:
      return "/dashboard";
  }
}
