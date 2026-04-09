import { useAuthAccess } from "./useAuthAccess";
import { LAB_AUTH_CONFIG } from "../lib/auth/authConfig";

export function useLabAuth({ users, empresas, sessionKey }) {
  return useAuthAccess({ users, empresas, sessionKey, strategy: LAB_AUTH_CONFIG.strategy });
}
