import type {
  ResidentAppContext,
  ResidentProfile,
} from "@/services/mobile-app.types";

function cleanLabel(value: string | null | undefined) {
  return String(value ?? "").trim();
}

export function formatResidenceUnit(
  block?: string | null,
  apartment?: string | null,
  unitLabel?: string | null,
) {
  const normalizedUnitLabel = cleanLabel(unitLabel);
  const normalizedBlock = cleanLabel(block);
  const normalizedApartment = cleanLabel(apartment);

  if (normalizedUnitLabel) {
    return normalizedUnitLabel;
  }

  if (normalizedBlock && normalizedApartment) {
    return `Bloco ${normalizedBlock} · Apto ${normalizedApartment}`;
  }

  if (normalizedApartment) {
    return `Apto ${normalizedApartment}`;
  }

  if (normalizedBlock) {
    return `Bloco ${normalizedBlock}`;
  }

  return "Unidade não informada";
}

export function formatResidentCurrentAccess(resident: ResidentProfile) {
  if (resident.role === "SINDICO") {
    return cleanLabel(resident.unit_label) || "Painel de síndico";
  }

  return formatResidenceUnit(
    resident.residence_block,
    resident.residence_apartment,
    resident.unit_label,
  );
}

export function formatResidentContextMeta(
  resident: Pick<
    ResidentProfile,
    | "role"
    | "tenant_name"
    | "residence_block"
    | "residence_apartment"
    | "unit_label"
  >,
) {
  return [
    resident.role === "SINDICO"
      ? cleanLabel(resident.unit_label) || "Painel de síndico"
      : formatResidenceUnit(
          resident.residence_block,
          resident.residence_apartment,
          resident.unit_label,
        ),
    cleanLabel(resident.tenant_name),
  ]
    .filter((value) => value.length > 0)
    .join(" · ");
}

export function formatLookupContextTitle(context: ResidentAppContext) {
  return (
    cleanLabel(context.site_name) ||
    cleanLabel(context.context_label) ||
    cleanLabel(context.tenant_name) ||
    "Contexto disponível"
  );
}

export function formatLookupContextMeta(context: ResidentAppContext) {
  return [
    context.profile_type === "SYNDIC"
      ? "Painel de síndico"
      : formatResidenceUnit(
          context.residence_block,
          context.residence_apartment,
          context.unit_label,
        ),
    cleanLabel(context.tenant_name),
  ]
    .filter((value) => value.length > 0)
    .join(" · ");
}

export function resolveResidentContextKey(
  context: Pick<ResidentAppContext, "profile_type" | "person_id" | "site_id">,
) {
  if (context.profile_type === "SYNDIC") {
    return context.site_id ?? 0;
  }

  return context.person_id ?? 0;
}

export function countUniqueTenantContexts(contexts: ResidentAppContext[]) {
  return new Set(contexts.map((context) => context.tenant_uuid)).size;
}

export function countUniqueSiteContexts(contexts: ResidentAppContext[]) {
  return new Set(
    contexts.map((context) => `${context.tenant_uuid}:${context.site_id ?? "site-null"}`),
  ).size;
}
