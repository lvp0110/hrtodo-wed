import type { OrgNodeType } from "#/types/api";

/** Типы из общего справочника, не подходящие для организационных узлов. */
const EXCLUDED_TYPE_CODES = new Set(["CITY", "COUNTRY"]);

export function isSelectableOrgNodeType(type: OrgNodeType): boolean {
  return !EXCLUDED_TYPE_CODES.has(type.code.toUpperCase());
}

/**
 * Типы для выбора в форме отдела: без город/страна.
 * При редактировании сохраняем текущий type_code, даже если он в исключениях.
 */
export function selectableOrgNodeTypes(
  types: OrgNodeType[],
  currentTypeCode?: string,
): OrgNodeType[] {
  const current = currentTypeCode?.toUpperCase();
  return types.filter(
    (t) =>
      isSelectableOrgNodeType(t) || t.code.toUpperCase() === current,
  );
}
