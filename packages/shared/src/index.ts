import { z } from "zod";
export const certaintySchema = z.enum([
  "pending",
  "approximate",
  "inferred",
  "confirmed",
  "contradictory",
]);
export type Certainty = z.infer<typeof certaintySchema>;
export const segmentSchema = z.object({
  id: z.string(),
  start: z.number().nonnegative(),
  end: z.number().nonnegative(),
  text: z.string(),
  speaker: z.string().nullable(),
});
export type Segment = z.infer<typeof segmentSchema>;
export const extractionSchema = z.object({
  summary: z.string(),
  people: z.array(
    z.object({
      key: z.string(),
      name: z.string(),
      aliases: z.array(z.string()),
    }),
  ),
  claims: z.array(
    z.object({
      key: z.string(),
      personKey: z.string().nullable(),
      segmentId: z.string(),
      quote: z.string(),
      statement: z.string(),
      certainty: certaintySchema,
    }),
  ),
  relationships: z.array(
    z.object({
      fromKey: z.string(),
      toKey: z.string(),
      type: z.string(),
      claimKey: z.string(),
    }),
  ),
  events: z.array(
    z.object({
      key: z.string(),
      description: z.string(),
      type: z.string(),
      year: z.number().int().nullable(),
      place: z.string().nullable(),
      certainty: certaintySchema,
      personKeys: z.array(z.string()),
      claimKeys: z.array(z.string()),
    }),
  ),
});
export type Extraction = z.infer<typeof extractionSchema>;
export type Person = {
  id: string;
  name: string;
  aliases: string[];
  candidateIds: string[];
};
export type Claim = {
  id: string;
  conversationId: string;
  personId: string | null;
  segmentId: string;
  quote: string;
  statement: string;
  certainty: Certainty;
};
export type FamilyEvent = {
  id: string;
  conversationId: string;
  description: string;
  type: string;
  year: number | null;
  place: string | null;
  certainty: Certainty;
  personIds: string[];
  claimIds: string[];
};
export type ConversationStatus =
  "local" | "queued" | "transcribing" | "extracting" | "ready" | "failed";
export type Conversation = {
  id: string;
  title: string;
  createdAt: string;
  duration: number;
  status: ConversationStatus;
  summary: string;
  error: string | null;
  audioUri?: string;
  mimeType?: string;
  segments: Segment[];
  claims: Claim[];
  events: FamilyEvent[];
  bookmarks: number[];
  demo?: boolean;
};
export type Relationship = {
  id: string;
  fromId: string;
  toId: string;
  type: string;
  claimId: string;
};
export type Library = {
  relationships?: Relationship[];
  conversations: Conversation[];
  people: Person[];
};
export const normalizeName = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
export function identityCandidates(name: string, people: Person[]) {
  const normalized = normalizeName(name);
  return people.filter((p) =>
    [p.name, ...p.aliases].some((alias) => normalizeName(alias) === normalized),
  );
}
/** Validate references and quotations against the actual transcript, not merely the JSON shape. */
export function validateEvidence(
  input: unknown,
  segments: Segment[],
): Extraction {
  const result = extractionSchema.parse(input);
  const unique = (values: string[]) => new Set(values).size === values.length;
  if (
    ![result.people, result.claims, result.events].every((list) =>
      unique(list.map((x) => x.key)),
    )
  )
    throw new Error("Claves duplicadas en la extracción");
  const people = new Set(result.people.map((p) => p.key));
  const claims = new Set(result.claims.map((c) => c.key));
  for (const claim of result.claims) {
    const source = segments.find((s) => s.id === claim.segmentId);
    if (!source || !claim.quote.trim() || !source.text.includes(claim.quote))
      throw new Error("La afirmación no tiene una cita literal válida");
    if (claim.personKey && !people.has(claim.personKey))
      throw new Error("Persona de afirmación inexistente");
    // Models cannot certify a recollection as a verified fact.
    if (claim.certainty === "confirmed") claim.certainty = "pending";
  }
  for (const relation of result.relationships) {
    if (
      !people.has(relation.fromKey) ||
      !people.has(relation.toKey) ||
      relation.fromKey === relation.toKey ||
      !claims.has(relation.claimKey)
    )
      throw new Error("Relación sin personas o evidencia válidas");
  }
  for (const event of result.events) {
    if (
      !event.claimKeys.length ||
      event.claimKeys.some((k) => !claims.has(k)) ||
      event.personKeys.some((k) => !people.has(k))
    )
      throw new Error("Acontecimiento sin evidencia válida");
    if (event.certainty === "confirmed") event.certainty = "pending";
  }
  return result;
}
export const formatTime = (seconds: number) =>
  `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0")}`;
export const certaintyLabels: Record<Certainty, string> = {
  pending: "Por confirmar",
  approximate: "Aproximado",
  inferred: "Inferido por IA",
  confirmed: "Confirmado por ti",
  contradictory: "Versiones diferentes",
};
