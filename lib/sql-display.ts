/** SQL identifiers and statement text are displayed verbatim in the disclosure.
 * A short label is only a navigation aid, never a rewritten SQL statement. */
export function shortSqlHash(hash: string): string {
  const value = hash.trim();
  return value.length > 23 ? `${value.slice(0, 11)}…${value.slice(-7)}` : value;
}

export function sqlSourceLabel(source?: string): string {
  const value = (source ?? "").trim();
  if (!value) return "Kaynak belirtilmemiş";
  if (/^(?:SELECT|WITH|INSERT|UPDATE|DELETE|\/\*|--)/i.test(value) || value.length > 60)
    return "SQL ifadesi";
  return value;
}
