export type AuthenticatedUser = { userId: string; companyId: string; branchIds: string[]; permissions: string[] };

/** El Core delega la autenticación en Supabase Auth; los permisos siguen viviendo en la base de datos del ERP. */
export const authenticationProvider = "supabase" as const;
