import type { LucideIcon } from "lucide-react";
import { NavLink } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Building2, ChevronRight, CircleDollarSign, FileBadge, FileText, Gauge, House, Landmark, LogOut, ReceiptText, UserRound, UsersRound, X, Zap } from "lucide-react";

type NavItem = { href: string; label: string; icon: LucideIcon };

const groups: { label: string; links: NavItem[] }[] = [
  { label: "Visão geral", links: [{ href: "/dashboard", label: "Dashboard", icon: Gauge }] },
  { label: "Cadastros", links: [
    { href: "/imoveis", label: "Imóveis", icon: House },
    { href: "/proprietarios", label: "Proprietários", icon: UserRound },
    { href: "/pessoas", label: "Clientes", icon: UsersRound },
  ] },
  { label: "Operação", links: [
    { href: "/contratos", label: "Contratos", icon: FileText },
    { href: "/modelos-contrato", label: "Modelos", icon: FileBadge },
  ] },
  { label: "Financeiro", links: [
    { href: "/pagamentos", label: "Pagamentos", icon: CircleDollarSign },
    { href: "/prestacao-contas", label: "Prestação de contas", icon: Landmark },
    { href: "/contas-consumo", label: "Água e energia", icon: Zap },
    { href: "/notas-fiscais", label: "Notas fiscais", icon: ReceiptText },
  ] },
];

export function Nav({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { session, papel } = useAuth();
  const email = session?.user.email ?? "Equipe Regional";
  const initials = email.slice(0, 2).toUpperCase();

  return (
    <>
      {open && <button type="button" className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-sm lg:hidden" onClick={onClose} aria-label="Fechar menu" />}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-[276px] flex-col overflow-hidden bg-[#10251e] text-white shadow-2xl transition-transform duration-300 lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-[86px] items-center gap-3 border-b border-white/10 px-5">
          <span className="grid size-11 place-items-center rounded-2xl bg-brand-500 text-white shadow-lg shadow-black/20"><Building2 size={23} /></span>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold tracking-[-0.02em]">Imobiliária Regional</p>
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-emerald-200/65">Gestão inteligente</p>
          </div>
          <button type="button" onClick={onClose} className="ml-auto grid size-9 place-items-center rounded-xl text-white/65 hover:bg-white/10 hover:text-white lg:hidden" aria-label="Fechar menu"><X size={19} /></button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-5">
          {groups.map((group) => (
            <div key={group.label} className="mb-5">
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-100/40">{group.label}</p>
              <div className="space-y-1">
                {group.links.map((link) => {
                  const Icon = link.icon;
                  return (
                    <NavLink key={link.href} to={link.href} onClick={onClose} className={({ isActive }) => `group flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition ${isActive ? "bg-white text-[#10251e] shadow-lg shadow-black/10" : "text-emerald-50/70 hover:bg-white/8 hover:text-white"}`}>
                      {({ isActive }) => <><Icon size={18} strokeWidth={isActive ? 2.3 : 1.8} /><span className="flex-1">{link.label}</span>{isActive && <ChevronRight size={15} className="text-brand-600" />}</>}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 p-3">
          <div className="flex items-center gap-3 rounded-2xl bg-white/[0.06] p-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-200 text-xs font-bold text-brand-900">{initials}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold capitalize text-white">{papel ?? "Equipe Regional"}</p>
              <p className="truncate text-[11px] text-emerald-100/45">{email}</p>
            </div>
            <button type="button" onClick={() => supabase.auth.signOut()} className="grid size-9 shrink-0 place-items-center rounded-xl text-emerald-50/55 transition hover:bg-white/10 hover:text-white" aria-label="Sair"><LogOut size={17} /></button>
          </div>
        </div>
      </aside>
    </>
  );
}
