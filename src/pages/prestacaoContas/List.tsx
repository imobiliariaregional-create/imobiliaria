import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { PageHeader, Card, Table, Th, Td, EmptyState, Badge, Button, Field, Select, Input, LoadingState } from "@/components/ui";
import { formatBRL, formatMonth, todayISO } from "@/lib/format";
import type { Proprietario, PagamentoMensal } from "@/lib/types";
import { useAuth } from "@/lib/auth";

function mesAtualISO() {
  return todayISO().slice(0, 7);
}

export function PrestacaoContasListPage() {
  const { papel } = useAuth();
  const [proprietarios, setProprietarios] = useState<Proprietario[]>([]);
  const [proprietarioId, setProprietarioId] = useState<string>("");
  const [mes, setMes] = useState<string>(mesAtualISO());
  const [linhas, setLinhas] = useState<PagamentoMensal[] | null>(null);

  useEffect(() => {
    supabase
      .from("proprietarios")
      .select("*")
      .order("nome")
      .returns<Proprietario[]>()
      .then(({ data }) => {
        setProprietarios(data ?? []);
        if (data && data.length > 0 && !proprietarioId) setProprietarioId(data[0].id);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function reload() {
    if (!proprietarioId) return;
    setLinhas(null);
    const { data, error } = await supabase
      .from("pagamentos_mensais")
      .select("*, contratos!inner(*, imoveis!inner(*, proprietarios!inner(*)))")
      .eq("mes_referencia", `${mes}-01`)
      .eq("contratos.tipo", "administracao")
      .eq("contratos.imoveis.proprietario_id", proprietarioId)
      .order("created_at", { ascending: true })
      .returns<PagamentoMensal[]>();
    if (error) {
      alert(error.message);
      setLinhas([]);
      return;
    }
    setLinhas(data ?? []);
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proprietarioId, mes]);

  async function marcarRepassado(p: PagamentoMensal, liquido: number) {
    const jaRepassado = p.valor_repassado !== null;
    if (!jaRepassado && p.status !== "pago") {
      alert("Registre primeiro o recebimento do aluguel antes de marcar o repasse.");
      return;
    }
    const { error } = await supabase
      .from("pagamentos_mensais")
      .update({
        valor_repassado: jaRepassado ? null : liquido,
        data_repasse: jaRepassado ? null : todayISO(),
      })
      .eq("id", p.id);
    if (error) {
      alert(error.message);
      return;
    }
    reload();
  }

  const totalBruto = (linhas ?? []).reduce((acc, p) => acc + Number(p.valor_bruto), 0);
  const totalComissao = (linhas ?? []).reduce((acc, p) => acc + Number(p.valor), 0);
  const totalLiquido = totalBruto - totalComissao;

  return (
    <div>
      <PageHeader title="Prestação de Contas" />
      <Card className="p-4 mb-6">
        <div className="grid max-w-lg grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Proprietário" htmlFor="proprietario">
            <Select id="proprietario" value={proprietarioId} onChange={(e) => setProprietarioId(e.target.value)}>
              {proprietarios.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Mês" htmlFor="mes">
            <Input id="mes" type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
          </Field>
        </div>
      </Card>

      {linhas === null ? (
        <LoadingState />
      ) : linhas.length > 0 ? (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card className="p-5">
              <p className="text-sm text-slate-500">Aluguel bruto recebido</p>
              <p className="text-2xl font-semibold text-slate-900 mt-1">{formatBRL(totalBruto)}</p>
            </Card>
            <Card className="p-5">
              <p className="text-sm text-slate-500">Comissão da imobiliária (10%)</p>
              <p className="text-2xl font-semibold text-slate-900 mt-1">{formatBRL(totalComissao)}</p>
            </Card>
            <Card className="p-5">
              <p className="text-sm text-slate-500">Líquido a repassar ao proprietário</p>
              <p className="text-2xl font-semibold text-slate-900 mt-1">{formatBRL(totalLiquido)}</p>
            </Card>
          </div>

          <Card>
            <Table>
              <thead>
                <tr>
                  <Th>Imóvel</Th>
                  <Th>Aluguel do inquilino</Th>
                  <Th>Bruto</Th>
                  <Th>Comissão</Th>
                  <Th>Líquido</Th>
                  <Th>Repasse</Th>
                  <Th>Ação</Th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((p) => {
                  const bruto = Number(p.valor_bruto);
                  const comissao = Number(p.valor);
                  const liquido = bruto - comissao;
                  const repassado = p.valor_repassado !== null;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <Td>
                        <Link to={`/contratos/${p.contrato_id}`} className="text-brand-700 hover:underline font-medium">
                          {p.contratos?.imoveis?.rua}, {p.contratos?.imoveis?.numero}
                        </Link>
                      </Td>
                      <Td>
                        <Badge color={p.status === "pago" ? "green" : "yellow"}>{p.status}</Badge>
                      </Td>
                      <Td>{formatBRL(bruto)}</Td>
                      <Td>{formatBRL(comissao)}</Td>
                      <Td className="font-medium">{formatBRL(liquido)}</Td>
                      <Td>
                        {repassado ? (
                          <Badge color="green">repassado em {p.data_repasse?.split("-").reverse().join("/")}</Badge>
                        ) : (
                          <Badge color="yellow">pendente</Badge>
                        )}
                      </Td>
                      <Td>
                        {(papel === "admin" || papel === "financeiro") ? <Button
                          type="button"
                          variant="secondary"
                          disabled={!repassado && p.status !== "pago"}
                          title={!repassado && p.status !== "pago" ? "Marque primeiro o pagamento como recebido" : undefined}
                          onClick={() => marcarRepassado(p, liquido)}
                        >
                          {repassado ? "Desfazer" : "Marcar repassado"}
                        </Button> : <span className="text-xs text-slate-400">Somente leitura</span>}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </Card>
        </>
      ) : (
        <EmptyState message={`Nenhum imóvel de administração com pagamento gerado para ${formatMonth(mes)}.`} />
      )}
    </div>
  );
}
