import { lazy, Suspense } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, ProtectedRoute } from "@/lib/auth";
import { AppLayout } from "@/components/AppLayout";
import { LoginPage } from "@/pages/Login";
import { DashboardPage } from "@/pages/Dashboard";
import { ProprietariosListPage } from "@/pages/proprietarios/List";
import { NovoProprietarioPage } from "@/pages/proprietarios/New";
import { EditarProprietarioPage } from "@/pages/proprietarios/Edit";
import { PessoasListPage } from "@/pages/pessoas/List";
import { NovaPessoaPage } from "@/pages/pessoas/New";
import { EditarPessoaPage } from "@/pages/pessoas/Edit";
import { ImoveisListPage } from "@/pages/imoveis/List";
import { NovoImovelPage } from "@/pages/imoveis/New";
import { ImovelDetailPage } from "@/pages/imoveis/Detail";
import { ContratosListPage } from "@/pages/contratos/List";
import { NovoContratoPage } from "@/pages/contratos/New";
import { ContratoDetailPage } from "@/pages/contratos/Detail";
import { ModelosContratoListPage } from "@/pages/modelosContrato/List";
import { NovoModeloContratoPage } from "@/pages/modelosContrato/New";
import { EditarModeloContratoPage } from "@/pages/modelosContrato/Edit";
import { PagamentosListPage } from "@/pages/pagamentos/List";
import { PrestacaoContasListPage } from "@/pages/prestacaoContas/List";
import { ContasConsumoListPage } from "@/pages/contasConsumo/List";
import { NotasFiscaisListPage } from "@/pages/notasFiscais/List";
import { NovaNotaFiscalPage } from "@/pages/notasFiscais/New";
import { AutorizacoesListPage } from "@/pages/autorizacoes/List";

const ContratoDocumentoPage = lazy(() =>
  import("@/pages/contratos/Documento").then((modulo) => ({ default: modulo.ContratoDocumentoPage })),
);

export function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />

            <Route path="/proprietarios" element={<ProprietariosListPage />} />
            <Route path="/proprietarios/novo" element={<NovoProprietarioPage />} />
            <Route path="/proprietarios/:id" element={<EditarProprietarioPage />} />

            <Route path="/pessoas" element={<PessoasListPage />} />
            <Route path="/pessoas/nova" element={<NovaPessoaPage />} />
            <Route path="/pessoas/:id" element={<EditarPessoaPage />} />

            <Route path="/imoveis" element={<ImoveisListPage />} />
            <Route path="/imoveis/novo" element={<NovoImovelPage />} />
            <Route path="/imoveis/:id" element={<ImovelDetailPage />} />

            <Route path="/contratos" element={<ContratosListPage />} />
            <Route path="/autorizacoes" element={<AutorizacoesListPage />} />
            <Route path="/contratos/novo" element={<NovoContratoPage />} />
            <Route path="/contratos/:id" element={<ContratoDetailPage />} />
            <Route
              path="/contratos/:id/documento"
              element={
                <Suspense fallback={<div className="py-10 text-center text-sm text-slate-500">Carregando documento...</div>}>
                  <ContratoDocumentoPage />
                </Suspense>
              }
            />

            <Route path="/modelos-contrato" element={<ModelosContratoListPage />} />
            <Route path="/modelos-contrato/novo" element={<NovoModeloContratoPage />} />
            <Route path="/modelos-contrato/:id" element={<EditarModeloContratoPage />} />

            <Route path="/pagamentos" element={<PagamentosListPage />} />
            <Route path="/prestacao-contas" element={<PrestacaoContasListPage />} />
            <Route path="/contas-consumo" element={<ContasConsumoListPage />} />

            <Route path="/notas-fiscais" element={<NotasFiscaisListPage />} />
            <Route path="/notas-fiscais/nova" element={<NovaNotaFiscalPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </HashRouter>
  );
}
