const DEFAULT_FOOTER_NOTE = "El pie institucional se agrega automáticamente: Correo creado con amor por Produ.";

export const TRANSACTIONAL_EMAIL_TEMPLATE_DEFINITIONS = [
  {
    key: "billing_invoice_collection",
    label: "Cobranza de documento",
    description: "Correo para seguimiento de cobro de una factura o invoice.",
    defaultSubject: "Cobranza invoice {{documentNumber}}",
    defaultBody: [
      "Hola {{entityLabel}},",
      "",
      "Te escribimos desde {{companyName}} por el documento {{documentNumber}} por {{totalFormatted}}, con vencimiento {{dueDate}}.",
      "",
      "¿Tendrás una fecha estimada para el pago de dicho documento?",
      "",
      "Quedamos atentos a tu respuesta.",
      "",
      "Saludos",
    ].join("\n"),
  },
  {
    key: "billing_invoice_payment_link",
    label: "Cobranza con link de pago",
    description: "Correo de cobranza con link directo de pago de la factura.",
    defaultSubject: "Pago disponible · {{documentNumber}}",
    defaultBody: [
      "Hola {{entityLabel}},",
      "",
      "Te escribimos desde {{companyName}} para informarte que la factura {{documentNumber}} por {{totalFormatted}} ya está disponible para pago directo.",
      "",
      "Puedes pagarla haciendo click en el siguiente link:",
      "{{paymentLink}}",
      "",
      "Fecha de vencimiento: {{dueDate}}",
      "",
      "Si tienes alguna duda, quedamos atentos.",
      "",
      "Saludos",
    ].join("\n"),
  },
  {
    key: "invoice_manual_delivery",
    label: "Envío manual de factura",
    description: "Correo manual para enviar una factura con su documento adjunto.",
    defaultSubject: "Notificación de {{companyName}}",
    defaultBody: [
      "Estimado equipo de {{entityLabel}},",
      "",
      "Junto con saludar, les informamos que con fecha {{issueDate}} se ha emitido la factura #{{documentNumber}} por un monto de {{totalFormatted}} {{currency}}, la cual se encuentra adjunta en este correo, si tienen alguna consulta, no duden en contactarnos.",
      "",
      "Documento #{{documentNumber}}",
      "",
      "Fecha de vencimiento\t{{dueDate}}",
      "Total\t{{totalFormatted}}",
      "Monto por pagar\t{{pendingFormatted}}",
      "",
      "",
      "Saludos Cordiales",
      "{{companyName}}",
    ].join("\n"),
  },
  {
    key: "budget_manual_delivery",
    label: "Envío manual de presupuesto",
    description: "Correo manual para enviar un presupuesto con su PDF adjunto.",
    defaultSubject: "Notificación de {{companyName}}",
    defaultBody: [
      "Hola {{entityLabel}},",
      "",
      "Junto con saludar, te compartimos el presupuesto {{documentNumber}} emitido por {{companyName}}, por un monto total de {{totalFormatted}}.",
      "",
      "El documento va adjunto en este correo para tu revisión.",
      "",
      "Vigencia: {{validityLabel}}",
      "Referencia: {{referenceLabel}}",
      "",
      "Si tienes comentarios o quieres avanzar con la aprobación, quedamos atentos.",
      "",
      "Saludos cordiales,",
      "{{companyName}}",
    ].join("\n"),
  },
  {
    key: "contract_manual_delivery",
    label: "Envío manual de contrato",
    description: "Correo manual para enviar un contrato o acuerdo comercial.",
    defaultSubject: "Notificación de {{companyName}}",
    defaultBody: [
      "Hola {{entityLabel}},",
      "",
      "Junto con saludar, te compartimos el contrato {{documentNumber}} emitido por {{companyName}}.",
      "",
      "Tipo: {{contractType}}",
      "Vigencia: {{validityLabel}}",
      "Monto de referencia: {{totalFormatted}}",
      "",
      "Si tienes observaciones o necesitas coordinación adicional, quedamos atentos.",
      "",
      "Saludos cordiales,",
      "{{companyName}}",
    ].join("\n"),
  },
  {
    key: "billing_statement",
    label: "Estado de cuenta",
    description: "Resumen de documentos pendientes para clientes o auspiciadores.",
    defaultSubject: "Estado de cuenta {{entityLabel}}",
    defaultBody: [
      "Hola {{contactName}},",
      "",
      "Te compartimos tu estado de cuenta con {{companyName}}.",
      "",
      "{{documentLines}}",
      "",
      "Total pendiente: {{pendingTotalFormatted}}",
      "",
      "{{bankInfo}}",
    ].join("\n"),
  },
  {
    key: "crm_followup",
    label: "Seguimiento comercial CRM",
    description: "Correo de seguimiento comercial desde una oportunidad CRM.",
    defaultSubject: "Seguimiento comercial · {{companyLabel}}",
    defaultBody: [
      "Hola {{contactName}},",
      "",
      "Te escribimos desde {{companyName}} para dar seguimiento a {{opportunityName}}.",
      "",
      "Quedamos atentos.",
      "",
      "{{companyName}}",
    ].join("\n"),
  },
  {
    key: "client_contact",
    label: "Contacto desde clientes",
    description: "Correo directo desde la ficha de cliente.",
    defaultSubject: "Notificación de {{companyName}}",
    defaultBody: [
      "Hola {{contactName}},",
      "",
      "Te escribimos desde {{companyName}}.",
      "",
      "{{messageBody}}",
      "",
      "Quedamos atentos.",
    ].join("\n"),
  },
  {
    key: "payables_supplier_contact",
    label: "Seguimiento a proveedor",
    description: "Correo para coordinar pago o seguimiento de una cuenta por pagar.",
    defaultSubject: "Seguimiento de pago {{documentNumber}}",
    defaultBody: [
      "Hola {{contactName}},",
      "",
      "Te escribimos desde {{companyName}} por el documento {{documentNumber}} asociado a {{supplierName}}.",
      "",
      "Fecha estimada de pago: {{paymentDate}}.",
      "",
      "Monto de referencia: {{totalFormatted}}",
      "",
      "Quedamos atentos.",
    ].join("\n"),
  },
  {
    key: "payables_supplier_statement",
    label: "Estado de cuenta proveedor",
    description: "Correo para compartir el estado de pago consolidado de los documentos de un proveedor.",
    defaultSubject: "Estado de cuenta {{supplierName}}",
    defaultBody: [
      "Hola {{contactName}},",
      "",
      "Te compartimos el estado de cuenta vigente de {{supplierName}} con {{companyName}}.",
      "",
      "{{documentLines}}",
      "",
      "Total documental: {{documentTotalFormatted}}",
      "Total pagado: {{paidTotalFormatted}}",
      "Saldo pendiente: {{pendingTotalFormatted}}",
      "",
      "Si necesitas revisar algún documento en particular, quedamos atentos.",
      "",
      "Saludos",
    ].join("\n"),
  },
  {
    key: "issued_purchase_order_supplier",
    label: "Envío de OC a proveedor",
    description: "Correo para enviar una orden de compra emitida al proveedor.",
    defaultSubject: "Orden de compra {{documentNumber}}",
    defaultBody: [
      "Hola {{contactName}},",
      "",
      "Te compartimos la orden de compra {{documentNumber}} emitida por {{companyName}} para {{supplierName}}.",
      "",
      "Fecha de emisión: {{issueDate}}.",
      "Monto de referencia: {{totalFormatted}}",
      "",
      "Adjuntamos la orden de compra para tu revisión.",
      "",
      "Quedamos atentos.",
    ].join("\n"),
  },
  {
    key: "password_reset",
    label: "Recuperación de acceso",
    description: "Mensaje base para restablecimiento de contraseña.",
    defaultSubject: "Recuperación de acceso Produ",
    defaultBody: [
      "Hola {{contactName}},",
      "",
      "Recibimos una solicitud de recuperación de acceso para tu cuenta en Produ.",
      "",
      "{{resetInstructions}}",
      "",
      "Si no solicitaste este cambio, puedes ignorar este correo.",
    ].join("\n"),
  },
  {
    key: "access_updated",
    label: "Acceso actualizado",
    description: "Notificación de credenciales o acceso temporal.",
    defaultSubject: "Acceso actualizado en Produ",
    defaultBody: [
      "Hola {{contactName}},",
      "",
      "Tu acceso en Produ fue actualizado.",
      "",
      "{{accessInstructions}}",
      "",
      "Quedamos atentos.",
    ].join("\n"),
  },
];

export function getTransactionalEmailTemplateDefinitions() {
  return TRANSACTIONAL_EMAIL_TEMPLATE_DEFINITIONS.slice();
}

export function getTransactionalEmailTemplateDefinition(templateKey = "") {
  return TRANSACTIONAL_EMAIL_TEMPLATE_DEFINITIONS.find(item => item.key === templateKey) || null;
}

export function getTenantTransactionalEmailTemplates(empresa = null) {
  const configured = empresa?.emailTemplates;
  if (!configured || typeof configured !== "object") return {};
  return configured;
}

function fillTemplateString(source = "", vars = {}) {
  return String(source || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const value = vars[key];
    return value === undefined || value === null ? "" : String(value);
  });
}

export function resolveTransactionalEmailTemplate(empresa = null, templateKey = "", vars = {}) {
  const definition = getTransactionalEmailTemplateDefinition(templateKey);
  const tenantTemplates = getTenantTransactionalEmailTemplates(empresa);
  const tenantConfig = tenantTemplates?.[templateKey] || {};
  const subjectSource = tenantConfig.subject || definition?.defaultSubject || "";
  const bodySource = tenantConfig.body || definition?.defaultBody || "";
  return {
    key: templateKey,
    label: definition?.label || templateKey,
    description: definition?.description || "",
    footerNote: DEFAULT_FOOTER_NOTE,
    subject: fillTemplateString(subjectSource, vars).trim(),
    body: fillTemplateString(bodySource, vars).trim(),
  };
}
