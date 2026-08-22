import { NavLink } from "react-router-dom";
import { supabase } from "@/lib/supabase";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/imoveis", label: "Imóveis" },
  { href: "/proprietarios", label: "Proprietários" },
  { href: "/pessoas", label: "Inquilinos/Compradores" },
  { href: "/contratos", label: "Contratos" },
  { href: "/modelos-contrato", label: "Modelos de Contrato" },
  { href: "/pagamentos", label: "Pagamentos" },
  { href: "/prestacao-contas", label: "Prestação de Contas" },
  { href: "/contas-consumo", label: "Água/Energia" },
  { href: "/notas-fiscais", label: "Notas Fiscais" },
];

export function Nav() {
  return (
    <aside className="w-60 shrink-0 bg-white border-r border-slate-200 min-h-screen flex flex-col">
      <div className="px-5 py-5 border-b border-slate-200">
        <span className="font-semibold text-slate-900">Imobiliária</span>
      </div>
      <nav className="flex-1 py-3">
        {links.map((link) => (
          <NavLink
            key={link.href}
            to={link.href}
            className={({ isActive }) =>
              `block px-5 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-brand-50 text-brand-700 border-r-2 border-brand-600"
                  : "text-slate-600 hover:bg-slate-50"
              }`
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
      <div className="px-5 py-4 border-t border-slate-200">
        <button
          type="button"
          onClick={() => supabase.auth.signOut()}
          className="text-sm text-slate-500 hover:text-slate-800"
        >
          Sair
        </button>
      </div>
    </aside>
  );
}
