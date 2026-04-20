import { useTenantContext } from "@/contexts/TenantContext";

export const useTenant = () => useTenantContext();

export const useTenantSettings = () => {
  const { settings } = useTenantContext();
  return settings;
};

export const useIsTenantAdmin = (): boolean => {
  const { tenant, memberships } = useTenantContext();
  if (!tenant) return false;
  return memberships.some(
    (m) => m.tenant_id === tenant.id && (m.role === "owner" || m.role === "admin")
  );
};

export const useIsTenantOwner = (): boolean => {
  const { tenant, memberships } = useTenantContext();
  if (!tenant) return false;
  return memberships.some((m) => m.tenant_id === tenant.id && m.role === "owner");
};

export const useIsTenantMember = (): boolean => {
  const { tenant, memberships } = useTenantContext();
  if (!tenant) return false;
  return memberships.some((m) => m.tenant_id === tenant.id);
};
