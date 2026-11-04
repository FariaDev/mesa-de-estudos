/* Fake nomeado do `which` da jaula: cada teste declara só os binários que a
   plataforma dele teria. Nenhum teste unitário consulta o PATH real. */
export function whichFor(binaries) {
  const found = new Map(Object.entries(binaries));
  return (binary) => found.get(binary) ?? null;
}

export function whichThatThrows() {
  throw Error('PATH indisponível de propósito');
}
