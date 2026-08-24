import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Nav } from "@/components/Nav";
import { Menu } from "lucide-react";

const pageNames: Record<string, string> = {
  dashboard: "Visão geral",
  imoveis: "Imóveis",
  proprietarios: "Proprietários",
  pessoas: "Clientes",
  contratos: "Contratos",
  "modelos-contrato": "Modelos de contrato",
  pagamentos: "Pagamentos",
  "prestacao-contas": "Prestação de contas",
  "contas-consumo": "Água e energia",
  "notas-fiscais": "Notas fiscais",
};

export function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const section = location.pathname.split("/")[1];

  return (
    <div className="min-h-screen lg:flex">
      <Nav open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="min-w-0 flex-1 lg:pl-[276px]">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200/80 bg-[#f4f6f5]/90 px-4 backdrop-blur-xl sm:px-6 lg:hidden">
          <button type="button" onClick={() => setMenuOpen(true)} className="grid size-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm" aria-label="Abrir menu">
            <Menu size={20} />
          </button>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-700">Imobiliária Regional</p>
            <p className="text-sm font-semibold text-slate-900">{pageNames[section] ?? "Gestão"}</p>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1480px] px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10 xl:px-12">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
