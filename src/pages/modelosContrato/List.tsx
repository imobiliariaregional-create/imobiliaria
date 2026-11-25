import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { PageHeader, Card, Table, Th, Td, EmptyState, Badge, LoadingState, ErrorState, Button, TableToolbar } from "@/components/ui";
import { PapelTimbradoCard } from "@/components/PapelTimbradoCard";
import { DadosImobiliariaCard } from "@/components/DadosImobiliariaCard";
import { CATEGORIA_MODELO_LABEL } from "@/components/ModeloContratoForm";
import type { ModeloContrato } from "@/lib/types";
import { useAuth } from "@/lib/auth";
import { normalizeSearch } from "@/lib/forms";
import { Archive, ArchiveRestore, Copy, Trash2 } from "lucide-react";

const tipoLabel: Record<string, string> = {
  aluguel: "Aluguel",
  administracao: "Administração",
  venda: "Venda",
};

/** Mesma regra da trigger do banco: não deixar categoria + tipo sem nenhum modelo ativo. */
function ehUltimoAtivo(modelo: ModeloContrato, todos: ModeloContrato[]) {
  return (
    !modelo.arquivado &&
    !todos.some((m) => m.id !== modelo.id && !m.arquivado && m.categoria === modelo.categoria && m.tipo_operacao === modelo.tipo_operacao)
  );
}

export function ModelosContratoListPage() {
  const { papel } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<ModeloContrato[] | null>(null);
  const [usos, setUsos] = useState<Map<string, number>>(new Map());
  const [search, setSearch] = useState("");
  const [tipo, setTipo] = useState("");
  const [mostrarArquivados, setMostrarArquivados] = useState(false);
  const [ocupadoId, setOcupadoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const podeEditar = papel === "admin" || papel === "corretor";
  const podeExcluir = papel === "admin";

  const filtered = useMemo(() => (data ?? []).filter((item) => (
    (mostrarArquivados || !item.arquivado) &&
    (!tipo || item.tipo_operacao === tipo) &&
    normalizeSearch(item.nome).includes(normalizeSearch(search))
  )), [data, search, tipo, mostrarArquivados]);
  const totalArquivados = (data ?? []).filter((m) => m.arquivado).length;

  async function reload() {
    const [modelosRes, geradosRes] = await Promise.all([
      supabase.from("modelos_contrato").select("*").order("created_at", { ascending: false }).returns<ModeloContrato[]>(),
      supabase.from("contratos_gerados").select("modelo_id").not("modelo_id", "is", null).returns<{ modelo_id: string }[]>(),
    ]);
    if (modelosRes.error) setError(modelosRes.error.message);
    setData(modelosRes.data ?? []);
    const contagem = new Map<string, number>();
    for (const { modelo_id } of geradosRes.data ?? []) contagem.set(modelo_id, (contagem.get(modelo_id) ?? 0) + 1);
    setUsos(contagem);
  }

  useEffect(() => {
    reload();
  }, []);

  async function duplicar(modelo: ModeloContrato) {
    setError(null);
    setOcupadoId(modelo.id);
    try {
      const { data: novo, error } = await supabase
        .from("modelos_contrato")
        .insert({ nome: `${modelo.nome} (cópia)`, tipo_operacao: modelo.tipo_operacao, categoria: modelo.categoria, conteudo: modelo.conteudo })
        .select("*")
        .single<ModeloContrato>();
      if (error) throw new Error(error.message);
      navigate(`/modelos-contrato/${novo.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao duplicar modelo.");
      setOcupadoId(null);
    }
  }

  async function alternarArquivo(modelo: ModeloContrato) {
    setError(null);
    const arquivar = !modelo.arquivado;
    if (arquivar && ehUltimoAtivo(modelo, data ?? [])) {
      setError(`"${modelo.nome}" é o único modelo ativo desse tipo. Crie ou restaure outro do mesmo tipo antes de arquivar este.`);
      return;
    }
    if (arquivar && !window.confirm(`Arquivar "${modelo.nome}"?\n\nEle sai da lista e da tela de gerar documentos, mas pode ser restaurado depois em "Mostrar arquivados".`)) return;
    setOcupadoId(modelo.id);
    try {
      const { error } = await supabase
        .from("modelos_contrato")
        .update({ arquivado: arquivar, arquivado_em: arquivar ? new Date().toISOString() : null })
        .eq("id", modelo.id);
      if (error) throw new Error(error.message);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao arquivar modelo.");
    } finally {
      setOcupadoId(null);
    }
  }

  async function excluir(modelo: ModeloContrato) {
    setError(null);
    if (ehUltimoAtivo(modelo, data ?? [])) {
      setError(`"${modelo.nome}" é o único modelo ativo desse tipo. Crie ou restaure outro do mesmo tipo antes de excluir este.`);
      return;
    }
    const usados = usos.get(modelo.id) ?? 0;
    const aviso = usados > 0
      ? `${usados} documento(s) já foram gerados com este modelo. Eles continuam salvos com o próprio texto; só deixam de mostrar de qual modelo vieram.`
      : "Nenhum documento foi gerado com este modelo.";
    if (!window.confirm(`Excluir definitivamente "${modelo.nome}"?\n\n${aviso}\n\nNão dá para desfazer. Se quiser só tirar da lista, use Arquivar.`)) return;
    setOcupadoId(modelo.id);
    try {
      const { error } = await supabase.from("modelos_contrato").delete().eq("id", modelo.id);
      if (error) throw new Error(error.message);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao excluir modelo.");
    } finally {
      setOcupadoId(null);
    }
  }

  return (
    <div>
      <PageHeader title="Modelos de Contrato" action={podeEditar ? { href: "/modelos-contrato/novo", label: "Novo modelo" } : undefined} />
      <PapelTimbradoCard />
      <DadosImobiliariaCard />
      <TableToolbar search={search} onSearch={setSearch} total={data?.length ?? 0} shown={filtered.length} filter={tipo} onFilter={setTipo} options={Object.entries(tipoLabel).map(([value, label]) => ({ value, label }))} />
      <label className="mb-4 flex w-fit items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" checked={mostrarArquivados} onChange={(e) => setMostrarArquivados(e.target.checked)} />
        Mostrar arquivados{totalArquivados > 0 ? ` (${totalArquivados})` : ""}
      </label>
      {error && <div className="mb-4"><ErrorState message={error} /></div>}
      <Card>
        {data === null ? (
          <LoadingState />
        ) : filtered.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <Th>Nome</Th>
                <Th>Categoria</Th>
                <Th>Tipo</Th>
                {podeEditar && <Th>&nbsp;</Th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((modelo) => (
                <tr key={modelo.id} className={modelo.arquivado ? "bg-slate-50/60 text-slate-400" : "hover:bg-slate-50"}>
                  <Td>
                    <Link to={`/modelos-contrato/${modelo.id}`} className={`${modelo.arquivado ? "text-slate-500" : "text-brand-700"} hover:underline font-medium`}>
                      {modelo.nome}
                    </Link>
                    {modelo.arquivado && <span className="ml-2"><Badge color="slate">Arquivado</Badge></span>}
                  </Td>
                  <Td className="text-sm">{CATEGORIA_MODELO_LABEL[modelo.categoria] ?? modelo.categoria}</Td>
                  <Td>
                    <Badge color="blue">{tipoLabel[modelo.tipo_operacao]}</Badge>
                  </Td>
                  {podeEditar && (
                    <Td className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="secondary" onClick={() => duplicar(modelo)} disabled={ocupadoId === modelo.id} title="Duplicar">
                          <Copy size={15} /> Duplicar
                        </Button>
                        <Button type="button" variant="secondary" onClick={() => alternarArquivo(modelo)} disabled={ocupadoId === modelo.id} title={modelo.arquivado ? "Restaurar" : "Arquivar"}>
                          {modelo.arquivado ? <><ArchiveRestore size={15} /> Restaurar</> : <><Archive size={15} /> Arquivar</>}
                        </Button>
                        {podeExcluir && (
                          <Button type="button" variant="danger" onClick={() => excluir(modelo)} disabled={ocupadoId === modelo.id} title="Excluir">
                            <Trash2 size={15} /> Excluir
                          </Button>
                        )}
                      </div>
                    </Td>
                  )}
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState message={data.length ? "Nenhum modelo corresponde aos filtros." : "Nenhum modelo de contrato cadastrado ainda."} />
        )}
      </Card>
    </div>
  );
}
