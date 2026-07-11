import {
  buildCorsHeaders,
  corsHeaders,
  diioWebhookCorsHeaders,
  handleCors,
  mercadoPagoCorsHeaders,
} from "./cors.ts";

Deno.test("buildCorsHeaders preserves the shared base CORS headers", () => {
  const headers = buildCorsHeaders();
  if (headers["Access-Control-Allow-Origin"] !== "*") {
    throw new Error("Expected wildcard origin");
  }
  if (headers["Access-Control-Allow-Headers"] !== corsHeaders["Access-Control-Allow-Headers"]) {
    throw new Error("Expected shared allowed headers");
  }
});

Deno.test("CORS presets preserve provider-specific allowed headers", () => {
  if (!mercadoPagoCorsHeaders["Access-Control-Allow-Headers"].includes("x-signature")) {
    throw new Error("Expected Mercado Pago signature header");
  }
  if (!diioWebhookCorsHeaders["Access-Control-Allow-Headers"].includes("DO-Signature")) {
    throw new Error("Expected Diio signature header");
  }
  if (!diioWebhookCorsHeaders["Access-Control-Allow-Headers"].includes("DO-Timestamp")) {
    throw new Error("Expected Diio timestamp header");
  }
});

Deno.test("handleCors returns the same preflight response shape used by functions", async () => {
  const response = handleCors(new Request("https://edge.local", { method: "OPTIONS" }));
  if (!response) throw new Error("Expected preflight response");
  if (response.status !== 200) throw new Error("Expected default 200 status");
  if (await response.text() !== "ok") throw new Error("Expected ok body");
  if (response.headers.get("Access-Control-Allow-Origin") !== "*") {
    throw new Error("Expected wildcard origin");
  }
});
