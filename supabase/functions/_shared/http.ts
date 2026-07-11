import { corsHeaders, type CorsHeaders } from "./cors.ts";

export function jsonResponse(body: unknown, status = 200, headers: CorsHeaders = corsHeaders) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
  });
}

export function createJsonResponder(headers: CorsHeaders = corsHeaders) {
  return (body: unknown, status = 200) => jsonResponse(body, status, headers);
}
