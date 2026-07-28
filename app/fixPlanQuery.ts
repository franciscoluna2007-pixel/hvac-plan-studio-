export type FixPlanSearchAction = {
  id: string;
  title: string;
  location: string;
  problem: string;
  proposedFix: string;
  expectedResult: string;
  evidence: readonly string[];
  objectIds: readonly string[];
};

export type FixPlanMatchedField =
  | "title"
  | "location"
  | "problem"
  | "proposedFix"
  | "expectedResult"
  | "evidence"
  | "objectIds";

export type RankedFixPlanAction<T extends FixPlanSearchAction = FixPlanSearchAction> = {
  action: T;
  score: number;
  matchedFields: FixPlanMatchedField[];
};

const FIELD_WEIGHTS: ReadonlyArray<{
  field: FixPlanMatchedField;
  weight: number;
}> = [
  { field: "title", weight: 12 },
  { field: "location", weight: 10 },
  { field: "problem", weight: 8 },
  { field: "proposedFix", weight: 7 },
  { field: "expectedResult", weight: 6 },
  { field: "evidence", weight: 4 },
  { field: "objectIds", weight: 3 },
];

const GENERIC_QUERY_WORDS = new Set([
  "a",
  "an",
  "find",
  "fix",
  "for",
  "in",
  "issue",
  "of",
  "on",
  "please",
  "problem",
  "show",
  "the",
  "to",
]);

function normalizeSearchText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function fieldValues(
  action: FixPlanSearchAction,
  field: FixPlanMatchedField,
) {
  if (field === "evidence" || field === "objectIds") {
    return action[field].map(normalizeSearchText).filter(Boolean);
  }
  const value = normalizeSearchText(action[field]);
  return value ? [value] : [];
}

export function rankFixPlanActions<T extends FixPlanSearchAction>(
  actions: readonly T[],
  query: string,
): Array<RankedFixPlanAction<T>> {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return actions.map((action) => ({
      action,
      score: 0,
      matchedFields: [],
    }));
  }

  const tokens = [...new Set(normalizedQuery
    .split(" ")
    .filter((token) => token && !GENERIC_QUERY_WORDS.has(token)))];
  if (!tokens.length) return [];
  const meaningfulQuery = tokens.join(" ");
  return actions
    .map((action, index) => {
      const fieldRows = FIELD_WEIGHTS.map(({ field, weight }) => {
        const values = fieldValues(action, field);
        const matchedTokens = tokens.filter((token) =>
          values.some((value) => value.includes(token))
        );
        const phraseMatch = values.some((value) => value.includes(meaningfulQuery));
        const exactMatch = values.some((value) => value === meaningfulQuery);
        const score =
          matchedTokens.length * weight +
          (phraseMatch && tokens.length > 1 ? weight * 3 : 0) +
          (exactMatch ? weight * 5 : 0);
        return {
          field,
          matchedTokens,
          score,
        };
      });
      const matchedTokenSet = new Set(
        fieldRows.flatMap((row) => row.matchedTokens),
      );
      if (tokens.some((token) => !matchedTokenSet.has(token))) return null;
      return {
        index,
        action,
        score: fieldRows.reduce((total, row) => total + row.score, 0),
        matchedFields: fieldRows
          .filter((row) => row.score > 0)
          .map((row) => row.field),
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map(({ action, score, matchedFields }) => ({
      action,
      score,
      matchedFields,
    }));
}
