"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/(app)/actions";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/imoveis", label: "Imóveis" },
  { href: "/proprietarios", label: "Proprietários" },
  { href: "/pessoas", label: "Inquilinos/Compradores" },
  { href: "/contratos", label: "Contratos" },
  { href: "/pagamentos", label: "Pagamentos" },
  { href: "/contas-consumo", label: "Água/Energia" },
  { href: "/notas-fiscais", label: "Notas Fiscais" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <aside className="w-60 shrink-0 bg-white border-r border-slate-200 min-h-screen flex flex-col">
      <div className="px-5 py-5 border-b border-slate-200">
        <span className="font-semibold text-slate-900">Imobiliária</span>
      </div>
      <nav className="flex-1 py-3">
        {links.map((link) => {
          const active = pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`block px-5 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-brand-50 text-brand-700 border-r-2 border-brand-600"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
      <form action={signOut} className="px-5 py-4 border-t border-slate-200">
        <button type="submit" className="text-sm text-slate-500 hover:text-slate-800">
          Sair
        </button>
      </form>
    </aside>
  );
}
