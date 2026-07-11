import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { handleDiioCompanyRequest } from "./handlers.ts";

Deno.serve((req) => {
  const preflight = handleCors(req, corsHeaders);
  if (preflight) return preflight;
  return handleDiioCompanyRequest(req);
});
