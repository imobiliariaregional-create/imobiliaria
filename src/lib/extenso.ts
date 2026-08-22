const UNIDADES = [
  "zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove",
  "dez", "onze", "doze", "treze", "catorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove",
];

const DEZENAS: Record<number, string> = {
  2: "vinte", 3: "trinta", 4: "quarenta", 5: "cinquenta", 6: "sessenta", 7: "setenta", 8: "oitenta", 9: "noventa",
};

const CENTENAS: Record<number, string> = {
  2: "duzentos", 3: "trezentos", 4: "quatrocentos", 5: "quinhentos", 6: "seiscentos", 7: "setecentos", 8: "oitocentos", 9: "novecentos",
};

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** 0-999 por extenso (sem tratar milhar/milhão). */
function tresDigitosPorExtenso(n: number): string {
  if (n === 0) return "";
  if (n < 20) return UNIDADES[n];
  if (n < 100) {
    const dezena = Math.floor(n / 10);
    const unidade = n % 10;
    return unidade === 0 ? DEZENAS[dezena] : `${DEZENAS[dezena]} e ${UNIDADES[unidade]}`;
  }
  if (n === 100) return "cem";
  const centena = Math.floor(n / 100);
  const resto = n % 100;
  const centenaStr = centena === 1 ? "cento" : CENTENAS[centena];
  return resto === 0 ? centenaStr : `${centenaStr} e ${tresDigitosPorExtenso(resto)}`;
}

function juntarGrupos(partes: string[], ultimoValor: number): string {
  if (partes.length <= 1) return partes.join("");
  const anteriores = partes.slice(0, -1);
  const ultimo = partes[partes.length - 1];
  const usaE = ultimoValor < 100 || ultimoValor % 100 === 0;
  return `${anteriores.join(", ")}${usaE ? " e " : ", "}${ultimo}`;
}

/** Converte um inteiro (0 a 999.999.999) para texto por extenso em PT-BR. */
export function numeroPorExtenso(n: number): string {
  const valor = Math.trunc(Math.abs(n));
  if (valor === 0) return "zero";

  const milhoes = Math.floor(valor / 1_000_000);
  const resto1 = valor % 1_000_000;
  const milhares = Math.floor(resto1 / 1000);
  const unidades3 = resto1 % 1000;

  const partes: string[] = [];
  if (milhoes > 0) {
    partes.push(milhoes === 1 ? "um milhão" : `${tresDigitosPorExtenso(milhoes)} milhões`);
  }
  if (milhares > 0) {
    partes.push(milhares === 1 ? "mil" : `${tresDigitosPorExtenso(milhares)} mil`);
  }
  if (unidades3 > 0 || partes.length === 0) {
    partes.push(tresDigitosPorExtenso(unidades3));
  }

  const ultimoValor = unidades3 > 0 || partes.length === 1 ? unidades3 : milhares;
  return juntarGrupos(partes, ultimoValor);
}

/** "1234.5" -> "mil, duzentos e trinta e quatro reais e cinquenta centavos" */
export function valorPorExtensoBRL(valor: number): string {
  const centavosTotal = Math.round(Math.abs(valor) * 100);
  const reais = Math.floor(centavosTotal / 100);
  const centavos = centavosTotal % 100;

  const reaisStr = `${numeroPorExtenso(reais)} ${reais === 1 ? "real" : "reais"}`;
  if (centavos === 0) return reaisStr;

  const centavosStr = `${numeroPorExtenso(centavos)} ${centavos === 1 ? "centavo" : "centavos"}`;
  if (reais === 0) return centavosStr;

  return `${reaisStr} e ${centavosStr}`;
}

/** "2026-08-22" -> "vinte e dois de agosto de dois mil e vinte e seis" */
export function dataPorExtenso(iso: string): string {
  const [ano, mes, dia] = iso.split("-").map(Number);
  return `${numeroPorExtenso(dia)} de ${MESES[mes - 1]} de ${numeroPorExtenso(ano)}`;
}
