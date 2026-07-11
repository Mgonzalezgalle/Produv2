import { assertEquals } from "jsr:@std/assert@1";
import {
  buildUsersIndex,
  normalizeCompanyUrl,
  normalizeMeetingToInteraction,
  normalizePhoneCallToInteraction,
  normalizeTenantDiioConfig,
} from "./mapping.ts";

Deno.test("normalizeCompanyUrl keeps only the origin", () => {
  assertEquals(normalizeCompanyUrl("demo.diio.com/workspace/abc"), "https://demo.diio.com");
  assertEquals(normalizeCompanyUrl("https://demo.diio.com/meetings"), "https://demo.diio.com");
});

Deno.test("normalizeTenantDiioConfig preserves defaults and numeric counters", () => {
  const config = normalizeTenantDiioConfig({
    companyUrl: "demo.diio.com",
    clientId: " client ",
    lastImportCount: "7",
  });

  assertEquals(config.status, "disconnected");
  assertEquals(config.companyUrl, "https://demo.diio.com");
  assertEquals(config.clientId, "client");
  assertEquals(config.lastImportCount, 7);
});

Deno.test("normalizeMeetingToInteraction maps Diio meeting details", () => {
  const usersIndex = buildUsersIndex([{ id: "u1", name: "Ana Soto", email: "ana@demo.cl" }]);
  const interaction = normalizeMeetingToInteraction({
    id: "meeting-1",
    detail: {
      title: "Reunion comercial",
      ended_at: "2026-07-10T12:00:00.000Z",
      tracker_values: {
        summary: { value: "Resumen ejecutivo" },
      },
      participants: [{ user_id: "u1", role: "owner" }],
      commitments: [{ title: "Enviar propuesta", deadline: "2026-07-15" }],
    },
    transcriptDetail: {
      transcript: [{ speaker: "Ana", text: "Hola equipo" }],
    },
  }, "tenant-1", "https://demo.diio.com", usersIndex);

  assertEquals(interaction.id, "diio_meeting_meeting-1");
  assertEquals(interaction.tenantId, "tenant-1");
  assertEquals(interaction.sourceType, "meeting.finished");
  assertEquals(interaction.title, "Reunion comercial");
  assertEquals(interaction.summary, "Resumen ejecutivo");
  assertEquals(interaction.transcript, "Ana: Hola equipo");
  assertEquals(interaction.participants, [{
    name: "Ana Soto",
    email: "ana@demo.cl",
    phone: "",
    role: "owner",
    userId: "u1",
    show: false,
    speakTime: 0,
    arriveTime: "",
  }]);
});

Deno.test("normalizePhoneCallToInteraction maps Diio call details", () => {
  const interaction = normalizePhoneCallToInteraction({
    id: "call-1",
    detail: {
      name: "Llamada de seguimiento",
      occurred_at: "2026-07-10T13:00:00.000Z",
      transcript_text: "Cliente confirma avance",
      attendees: {
        customers: [{ name: "Cliente Demo", email: "cliente@demo.cl" }],
      },
    },
  }, "tenant-1", "https://demo.diio.com");

  assertEquals(interaction.id, "diio_phone_call_call-1");
  assertEquals(interaction.sourceType, "phone_call.finished");
  assertEquals(interaction.title, "Llamada de seguimiento");
  assertEquals(interaction.transcript, "Cliente confirma avance");
  assertEquals(interaction.participants.length, 1);
  assertEquals(interaction.participants[0].email, "cliente@demo.cl");
});
