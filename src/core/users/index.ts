export type User = { id: string; name: string; email: string; active: boolean };

export type PlatformUser = User & { roleCodes: readonly string[]; identityProvider: "chatgpt" };

/** Plantilla base de usuario inicial para inicialización de estado en cliente antes de cargar perfil real. */
export const initialAdministrator: PlatformUser = {
  id: "user-system",
  name: "Usuario Autorizado",
  email: "usuario@empresa.com",
  active: true,
  roleCodes: ["administrator"],
  identityProvider: "chatgpt",
};
