/**
 * Conversation Flow Schemas — Phase 12.7
 *
 * Schemas declarativos por intent. Sem NLP, sem IA: apenas
 * descrição de campos requeridos, validações puras e prompts
 * que a ORKYM usa como hint.
 */

export type FieldType =
  | "string"
  | "uuid"
  | "date"
  | "time"
  | "datetime"
  | "integer"
  | "decimal"
  | "enum"
  | "boolean";

export interface FlowField {
  name: string;
  type: FieldType;
  required: boolean;
  enum_values?: string[];
  min?: number;
  max?: number;
  prompt: string;
  validate?: (v: unknown, ctx: Record<string, unknown>) => string | null;
}

export interface FlowDef {
  intent: string;
  action_type: string;
  fields: FlowField[];
  ttl_minutes?: number;
  summarize: (ctx: Record<string, unknown>) => string;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function validateField(
  field: FlowField,
  value: unknown,
  ctx: Record<string, unknown>,
): string | null {
  if (value === undefined || value === null || value === "") {
    return field.required ? `${field.name}_required` : null;
  }
  switch (field.type) {
    case "string":
      if (typeof value !== "string") return `${field.name}_must_be_string`;
      if (field.min && value.length < field.min) return `${field.name}_too_short`;
      if (field.max && value.length > field.max) return `${field.name}_too_long`;
      break;
    case "uuid":
      if (typeof value !== "string" || !UUID_RE.test(value))
        return `${field.name}_invalid_uuid`;
      break;
    case "date":
      if (typeof value !== "string" || !DATE_RE.test(value))
        return `${field.name}_invalid_date`;
      break;
    case "time":
      if (typeof value !== "string" || !TIME_RE.test(value))
        return `${field.name}_invalid_time`;
      break;
    case "datetime":
      if (typeof value !== "string" || isNaN(Date.parse(value as string)))
        return `${field.name}_invalid_datetime`;
      break;
    case "integer": {
      const n = typeof value === "number" ? value : Number(value);
      if (!Number.isInteger(n)) return `${field.name}_must_be_integer`;
      if (field.min !== undefined && n < field.min) return `${field.name}_below_min`;
      if (field.max !== undefined && n > field.max) return `${field.name}_above_max`;
      break;
    }
    case "decimal": {
      const n = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(n)) return `${field.name}_must_be_decimal`;
      if (field.min !== undefined && n < field.min) return `${field.name}_below_min`;
      if (field.max !== undefined && n > field.max) return `${field.name}_above_max`;
      break;
    }
    case "enum":
      if (!field.enum_values?.includes(String(value)))
        return `${field.name}_not_in_enum`;
      break;
    case "boolean":
      if (typeof value !== "boolean") return `${field.name}_must_be_boolean`;
      break;
  }
  return field.validate ? field.validate(value, ctx) : null;
}

export interface ValidationOutcome {
  validation_errors: { field: string; message: string }[];
  missing_fields: FlowField[];
  ready: boolean;
}

export function evaluateFlow(
  flow: FlowDef,
  context: Record<string, unknown>,
): ValidationOutcome {
  const errors: { field: string; message: string }[] = [];
  const missing: FlowField[] = [];

  for (const field of flow.fields) {
    const v = context[field.name];
    if (v === undefined || v === null || v === "") {
      if (field.required) missing.push(field);
      continue;
    }
    const err = validateField(field, v, context);
    if (err) errors.push({ field: field.name, message: err });
  }

  return {
    validation_errors: errors,
    missing_fields: missing,
    ready: errors.length === 0 && missing.length === 0,
  };
}

/**
 * Canonical JSON: chaves ordenadas, sem espaços, para hash estável.
 */
export function canonicalJson(obj: unknown): string {
  if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) {
    return "[" + obj.map((x) => canonicalJson(x)).join(",") + "]";
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  return (
    "{" +
    keys
      .map(
        (k) =>
          JSON.stringify(k) +
          ":" +
          canonicalJson((obj as Record<string, unknown>)[k]),
      )
      .join(",") +
    "}"
  );
}

export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ===========================================================
// Catálogo de fluxos
// ===========================================================

const FLOWS: FlowDef[] = [
  {
    intent: "reserve_court",
    action_type: "book_court", // handler ainda não implementado → falha graceful
    ttl_minutes: 15,
    fields: [
      {
        name: "arena_id",
        type: "uuid",
        required: true,
        prompt: "Em qual arena você quer reservar?",
      },
      {
        name: "court_id",
        type: "uuid",
        required: true,
        prompt: "Qual quadra?",
      },
      {
        name: "date",
        type: "date",
        required: true,
        prompt: "Para qual data? (formato AAAA-MM-DD)",
      },
      {
        name: "start_time",
        type: "time",
        required: true,
        prompt: "Que horas começa? (HH:MM)",
      },
      {
        name: "duration_hours",
        type: "integer",
        required: true,
        min: 1,
        max: 6,
        prompt: "Quantas horas?",
      },
    ],
    summarize: (ctx) =>
      `Reserva: quadra ${ctx.court_id} em ${ctx.date} às ${ctx.start_time} por ${ctx.duration_hours}h`,
  },
  {
    intent: "create_class",
    action_type: "create_class",
    ttl_minutes: 15,
    fields: [
      { name: "arena_id", type: "uuid", required: true, prompt: "Em qual arena?" },
      { name: "title", type: "string", required: true, min: 3, max: 120, prompt: "Qual o nome da aula?" },
      { name: "modality", type: "string", required: true, min: 2, max: 60, prompt: "Qual modalidade?" },
      { name: "start_at", type: "datetime", required: true, prompt: "Quando começa? (ISO datetime)" },
      { name: "end_at", type: "datetime", required: true, prompt: "Quando termina? (ISO datetime)" },
      { name: "capacity", type: "integer", required: true, min: 1, max: 200, prompt: "Capacidade máxima?" },
    ],
    summarize: (ctx) =>
      `Aula: "${ctx.title}" (${ctx.modality}) de ${ctx.start_at} a ${ctx.end_at}, ${ctx.capacity} vagas`,
  },
  {
    intent: "enroll_student",
    action_type: "enroll_athlete_in_plan", // handler futuro
    ttl_minutes: 15,
    fields: [
      { name: "arena_id", type: "uuid", required: true, prompt: "Em qual arena?" },
      { name: "student_id", type: "uuid", required: true, prompt: "Qual aluno?" },
      { name: "plan_id", type: "uuid", required: true, prompt: "Em qual plano?" },
      { name: "start_date", type: "date", required: true, prompt: "Data de início? (AAAA-MM-DD)" },
    ],
    summarize: (ctx) =>
      `Matrícula: aluno ${ctx.student_id} no plano ${ctx.plan_id} a partir de ${ctx.start_date}`,
  },
  {
    intent: "create_tournament",
    action_type: "create_tournament",
    ttl_minutes: 20,
    fields: [
      { name: "name", type: "string", required: true, min: 3, max: 120, prompt: "Qual o nome do torneio?" },
      { name: "start_date", type: "date", required: true, prompt: "Data de início? (AAAA-MM-DD)" },
      { name: "end_date", type: "date", required: true, prompt: "Data de término? (AAAA-MM-DD)" },
      { name: "location", type: "string", required: true, min: 3, max: 200, prompt: "Onde será realizado?" },
      { name: "max_participants", type: "integer", required: true, min: 2, max: 1024, prompt: "Quantos participantes no máximo?" },
      { name: "entry_fee", type: "decimal", required: true, min: 0, max: 100000, prompt: "Qual o valor de inscrição? (em R$)" },
    ],
    summarize: (ctx) =>
      `Torneio "${ctx.name}" de ${ctx.start_date} a ${ctx.end_date} em ${ctx.location}, até ${ctx.max_participants} atletas, R$ ${ctx.entry_fee}`,
  },
  {
    intent: "generate_billing_cycle",
    action_type: "generate_billing_cycle",
    ttl_minutes: 10,
    fields: [
      { name: "subscription_id", type: "uuid", required: true, prompt: "Qual matrícula?" },
    ],
    summarize: (ctx) =>
      `Gerar próxima cobrança da matrícula ${ctx.subscription_id}`,
  },
];

const FLOW_INDEX: Record<string, FlowDef> = Object.fromEntries(
  FLOWS.map((f) => [f.intent, f]),
);

export function getFlow(intent: string): FlowDef | null {
  return FLOW_INDEX[intent] ?? null;
}

export function listSupportedIntents(): string[] {
  return Object.keys(FLOW_INDEX);
}
