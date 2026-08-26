import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { PageHeader, Card, Table, Th, Td, EmptyState, Badge, Button, LoadingState, TableToolbar } from "@/components/ui";
import { formatBRL, formatDate, formatMonth, todayISO } from "@/lib/format";
import type { PagamentoMensal } from "@/lib/types";
import { useAuth } from "@/lib/auth";
import { normalizeSearch } from "@/lib/forms";
import { enderecoImovel } from "@/lib/imovelLabel";

const tipoLabel: Record<string, string> = {
  aluguel: "Aluguel",
  administracao: "Administração",
  venda: "Venda",
};

export function PagamentosListPage() {
  const { papel } = useAuth();
  const [data, setData] = useState<PagamentoMensal[] | null>(null);
  const [search, setSearch] = useState("");
  const [tipo, setTipo] = useState("");
  const hoje = todayISO();
  const filtered = useMemo(() => (data ?? []).filter((item) => {
    const contrato = item.contratos;
    const haystack = normalizeSearch([contrato?.pessoas?.nome, contrato?.imoveis ? enderecoImovel(contrato.imoveis) : "", item.status, item.mes_referencia].join(" "));
    return (!tipo || contrato?.tipo === tipo) && haystack.includes(normalizeSearch(search));
  }), [data, search, tipo]);

  async function reload() {
    const { data } = await supabase
      .from("pagamentos_mensais")
      .select("*, contratos(*, imoveis(*), pessoas(*))")
      .order("mes_referencia", { ascending: false })
      .returns<PagamentoMensal[]>();
    setData(data ?? []);
  }

  useEffect(() => {
    reload();
  }, []);

  async function toggle(p: PagamentoMensal) {
    const pago = p.status === "pago";
    if (pago && p.valor_repassado !== null) {
      alert("Desfaça o repasse ao proprietário antes de marcar este pagamento como pendente.");
      return;
    }
    const { error } = await supabase
      .from("pagamentos_mensais")
      .update({ status: pago ? "pendente" : "pago", data_pagamento: pago ? null : todayISO() })
      .eq("id", p.id);
    if (error) {
      alert(error.message);
      return;
    }
    reload();
  }

  return (
    <div>
      <PageHeader title="Pagamentos (valores a receber pela imobiliária)" />
      <TableToolbar search={search} onSearch={setSearch} total={data?.length ?? 0} shown={filtered.length} filter={tipo} onFilter={setTipo} options={Object.entries(tipoLabel).map(([value, label]) => ({ value, label }))} />
      <Card>
        {data === null ? (
          <LoadingState />
        ) : filtered.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <Th>Locatário / comprador</Th>
                <Th>Endereço do imóvel</Th>
                <Th>Tipo</Th>
                <Th>Mês</Th>
                <Th>Valor de referência</Th>
                <Th>Receita da imobiliária</Th>
                <Th>Vencimento</Th>
                <Th>Status</Th>
                <Th>Ação</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const atrasado = p.status === "pendente" && p.data_vencimento < hoje;
                return (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <Td>
                      <Link to={`/contratos/${p.contrato_id}`} className="text-brand-700 hover:underline font-medium">
                        {p.contratos?.pessoas?.nome ?? "-"}
                      </Link>
                    </Td>
                    <Td>
                      <Link to={`/contratos/${p.contrato_id}`} className="text-brand-700 hover:underline font-medium">
                        {p.contratos?.imoveis ? enderecoImovel(p.contratos.imoveis) : "-"}
                      </Link>
                    </Td>
                    <Td>{p.contratos ? tipoLabel[p.contratos.tipo] : "-"}</Td>
                    <Td>{formatMonth(p.mes_referencia.slice(0, 7))}</Td>
                    <Td>{formatBRL(p.valor_bruto)}</Td>
                    <Td>{formatBRL(p.valor)}</Td>
                    <Td>{formatDate(p.data_vencimento)}</Td>
                    <Td>
                      <Badge color={p.status === "pago" ? "green" : atrasado ? "red" : "yellow"}>
                        {p.status === "pago"
                          ? p.contratos?.tipo === "administracao" && p.contratos.recebimento_aluguel === "imobiliaria" ? "aluguel recebido" : "receita recebida"
                          : atrasado ? "atrasado" : "pendente"}
                      </Badge>
                    </Td>
                    <Td>
                      {(papel === "admin" || papel === "financeiro") ? <Button
                        type="button"
                        variant="secondary"
                        disabled={p.status === "pago" && p.valor_repassado !== null}
                        onClick={() => toggle(p)}
                      >
                        {p.status === "pago"
                          ? "Desfazer recebimento"
                          : p.contratos?.tipo === "administracao" && p.contratos.recebimento_aluguel === "imobiliaria"
                            ? "Registrar aluguel recebido"
                            : "Registrar comissão recebida"}
                      </Button> : <span className="text-xs text-slate-400">Somente leitura</span>}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <EmptyState message={data.length ? "Nenhum pagamento corresponde aos filtros." : "Nenhum pagamento gerado ainda. Crie um contrato para começar."} />
        )}
      </Card>
    </div>
  );
}
