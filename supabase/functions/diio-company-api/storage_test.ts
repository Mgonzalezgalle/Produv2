import { assertEquals } from "jsr:@std/assert@1";
import {
  getEmpresasStorageKey,
  getIncomingStorageKey,
  resolveStorageNamespace,
  upsertQueue,
} from "./storage.ts";

Deno.test("storage keys use the configured namespace", () => {
  const env = (key: string) => key === "APP_STORAGE_NAMESPACE" ? "produ-prod" : undefined;

  assertEquals(resolveStorageNamespace(env), "produ-prod");
  assertEquals(getEmpresasStorageKey(env), "produ-prod:produ:empresas");
  assertEquals(getIncomingStorageKey("tenant-1", env), "produ-prod:produ:diio:tenant-1:incoming");
});

Deno.test("storage keys fall back to produ-lab namespace", () => {
  const emptyEnv = () => undefined;

  assertEquals(resolveStorageNamespace(emptyEnv), "produ-lab");
  assertEquals(getIncomingStorageKey("", emptyEnv), "produ-lab:produ:diio:global:incoming");
});

Deno.test("upsertQueue inserts new interactions first", () => {
  const queue = upsertQueue([{ id: "old", matchStatus: "pending" }], { id: "new", matchStatus: "pending" });

  assertEquals(queue.map((item) => item.id), ["new", "old"]);
});

Deno.test("upsertQueue preserves confirmed matches", () => {
  const queue = upsertQueue([
    {
      id: "diio_meeting_1",
      sourceId: "1",
      matchStatus: "confirmed",
      entityType: "client",
      entityId: "client-1",
      entityLabel: "Cliente 1",
      matchConfidence: 95,
      confirmedAt: "2026-07-10T12:00:00.000Z",
    },
  ], {
    id: "diio_meeting_1",
    sourceId: "1",
    title: "Actualizado",
    matchStatus: "pending",
    matchConfidence: 20,
  });

  assertEquals(queue[0].title, "Actualizado");
  assertEquals(queue[0].matchStatus, "confirmed");
  assertEquals(queue[0].entityId, "client-1");
  assertEquals(queue[0].matchConfidence, 95);
});
