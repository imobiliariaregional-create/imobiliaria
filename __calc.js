const MULTA_PERCENTUAL = 2;
const JUROS_MENSAL_PERCENTUAL = 1;
const DIAS_ATE_NOVO_VENCIMENTO = 5;

/** Data de hoje no fuso de Brasilia — o servidor roda em UTC e viraria o dia cedo demais. */
function hojeSaoPaulo() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

function somarDias(dataISO, dias) {
  const d = new Date(`${dataISO}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function diferencaEmDias(de, ate) {
  const ms = new Date(`${ate}T12:00:00Z`).getTime() - new Date(`${de}T12:00:00Z`).getTime();
  return Math.round(ms / 86400000);
}



/**
 * A Asaas recusa cobranca com vencimento retroativo, entao o aluguel atrasado vira
 * um boleto novo com multa e juros ja embutidos. A multa e aplicada uma unica vez;
 * os juros sao pro rata die, ate o vencimento do boleto novo.
 */
function calcularCorrecao(valorBruto, vencimentoOriginal) {
  const hoje = hojeSaoPaulo();
  const base = {
    valorOriginal: valorBruto,
    vencimentoOriginal,
    multa: 0,
    juros: 0,
    total: valorBruto,
  };
  if (vencimentoOriginal >= hoje) {
    return { ...base, vencido: false, diasAtraso: 0, novoVencimento: vencimentoOriginal };
  }

  const novoVencimento = somarDias(hoje, DIAS_ATE_NOVO_VENCIMENTO);
  const diasAtraso = diferencaEmDias(vencimentoOriginal, novoVencimento);
  const multa = Number((valorBruto * (MULTA_PERCENTUAL / 100)).toFixed(2));
  const juros = Number((valorBruto * (JUROS_MENSAL_PERCENTUAL / 100) * (diasAtraso / 30)).toFixed(2));
  return {
    vencido: true,
    diasAtraso,
    valorOriginal: valorBruto,
    vencimentoOriginal,
    multa,
    juros,
    total: Number((valorBruto + multa + juros).toFixed(2)),
    novoVencimento,
  };
}


module.exports={calcularCorrecao,hojeSaoPaulo,somarDias,diferencaEmDias};