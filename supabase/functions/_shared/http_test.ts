import { mercadoPagoCorsHeaders } from "./cors.ts";
import { createJsonResponder, jsonResponse } from "./http.ts";

Deno.test("jsonResponse preserves JSON body, status and content type", async () => {
  const response = jsonResponse({ ok: true }, 201);
  if (response.status !== 201) throw new Error("Expected custom status");
  if (response.headers.get("Content-Type") !== "application/json") {
    throw new Error("Expected JSON content type");
  }
  if (await response.text() !== JSON.stringify({ ok: true })) {
    throw new Error("Expected serialized JSON body");
  }
});

Deno.test("jsonResponse accepts provider-specific CORS headers", () => {
  const response = jsonResponse({ ok: true }, 200, mercadoPagoCorsHeaders);
  const allowedHeaders = response.headers.get("Access-Control-Allow-Headers") || "";
  if (!allowedHeaders.includes("x-signature")) {
    throw new Error("Expected Mercado Pago CORS header");
  }
});

Deno.test("createJsonResponder binds CORS headers once", () => {
  const json = createJsonResponder(mercadoPagoCorsHeaders);
  const response = json({ ok: true });
  const allowedHeaders = response.headers.get("Access-Control-Allow-Headers") || "";
  if (!allowedHeaders.includes("x-signature")) {
    throw new Error("Expected bound Mercado Pago CORS header");
  }
});
