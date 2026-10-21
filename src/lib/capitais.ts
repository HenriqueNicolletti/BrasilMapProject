/**
 * State code to the code of its capital. The list comes from the IBGE: the municipal level of the
 * PNAD Contínua (table 4093) covers exactly the 27 capitals. Anything other than one known capital
 * per state fails loudly, so a change at the IBGE is looked at instead of drawn.
 */
export function capitalsByUf(
  localidades: readonly { id: string; nome: string }[],
  ufCodes: readonly string[],
  knownCodes: ReadonlySet<string>,
): Map<string, string> {
  const states = new Set(ufCodes);
  const capitals = new Map<string, string>();
  for (const { id, nome } of localidades) {
    if (!knownCodes.has(id)) throw new Error(`Capital ${id} (${nome}) is not in the locality list`);
    const uf = id.slice(0, 2);
    if (!states.has(uf)) throw new Error(`Capital ${id} (${nome}) belongs to state ${uf}, which is not in the state list`);
    const previous = capitals.get(uf);
    if (previous !== undefined) throw new Error(`State ${uf} has two capitals: ${previous} and ${id}`);
    capitals.set(uf, id);
  }
  const missing = ufCodes.filter((uf) => !capitals.has(uf));
  if (missing.length > 0) throw new Error(`No capital for state(s) ${missing.join(', ')}`);
  return capitals;
}
