export type User = { id: string; name: string; email: string; active: boolean };

export type PlatformUser = User & { roleCodes: readonly string[]; identityProvider: "chatgpt" };

/** Usuario inicial. La identidad se valida por el acceso privado de ChatGPT, no por contraseña local. */
export const initialAdministrator: PlatformUser = {
  id: "user-jaime-jaramillo",
  name: "Jaime Jaramillo",
  email: "jajl840316@gmail.com",
  active: true,
  roleCodes: ["administrator"],
  identityProvider: "chatgpt",
};
