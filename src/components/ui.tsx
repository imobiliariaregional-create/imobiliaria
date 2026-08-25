import { InputHTMLAttributes, LabelHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { Link } from "react-router-dom";
import { Inbox, LoaderCircle, Plus, Search } from "lucide-react";

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`surface-panel ${className}`}>
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  action,
}: {
  title: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="eyebrow mb-2">Gestão imobiliária</p>
        <h1 className="text-2xl font-semibold tracking-[-0.03em] text-slate-950 sm:text-[2rem]">{title}</h1>
      </div>
      {action && (
        <Link
          to={action.href}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-brand-800 focus:outline-none focus:ring-4 focus:ring-brand-100"
        >
          <Plus size={17} strokeWidth={2.2} />
          {action.label}
        </Link>
      )}
    </div>
  );
}

export function Label({ className = "", ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label {...props} className={`mb-1.5 block text-sm font-semibold text-slate-700 ${className}`} />;
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  const { onInput, ...inputProps } = props;
  const uppercase = !["date", "datetime-local", "email", "file", "month", "number", "password", "time"].includes(props.type ?? "text");
  return (
    <input
      {...inputProps}
      autoCapitalize={uppercase ? "characters" : props.autoCapitalize}
      onInput={(event) => {
        if (uppercase) event.currentTarget.value = event.currentTarget.value.toLocaleUpperCase("pt-BR");
        onInput?.(event);
      }}
      className={`min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-brand-600 focus:ring-4 focus:ring-brand-100 disabled:bg-slate-50 disabled:text-slate-500 ${props.className ?? ""}`}
    />
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { onInput, ...textareaProps } = props;
  return (
    <textarea
      {...textareaProps}
      autoCapitalize="characters"
      onInput={(event) => {
        event.currentTarget.value = event.currentTarget.value.toLocaleUpperCase("pt-BR");
        onInput?.(event);
      }}
      className={`w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-brand-600 focus:ring-4 focus:ring-brand-100 disabled:bg-slate-50 ${props.className ?? ""}`}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition hover:border-slate-400 focus:border-brand-600 focus:ring-4 focus:ring-brand-100 disabled:bg-slate-50 ${props.className ?? ""}`}
    />
  );
}

export function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" }) {
  const styles = {
    primary: "bg-brand-700 hover:bg-brand-800 text-white shadow-sm focus:ring-brand-100",
    secondary: "bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 focus:ring-slate-200",
    danger: "bg-red-600 hover:bg-red-700 text-white focus:ring-red-100",
  };
  return (
    <button
      {...props}
      className={`inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition focus:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Badge({ children, color = "slate" }: { children: React.ReactNode; color?: "slate" | "green" | "yellow" | "red" | "blue" }) {
  const colors = {
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    yellow: "bg-amber-50 text-amber-700 ring-amber-200",
    red: "bg-red-50 text-red-700 ring-red-200",
    blue: "bg-sky-50 text-sky-700 ring-sky-200",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ring-1 ring-inset ${colors[color]}`}>
      {children}
    </span>
  );
}

export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl">
      <table className="w-full min-w-[640px] text-sm">{children}</table>
    </div>
  );
}

export function Th({ children }: { children: React.ReactNode }) {
  return <th className="border-b border-slate-200 bg-slate-50/80 px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{children}</th>;
}

export function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`border-b border-slate-100 px-5 py-4 text-slate-700 ${className}`}>{children}</td>;
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <span className="mb-3 grid size-11 place-items-center rounded-2xl bg-slate-100 text-slate-400"><Inbox size={20} /></span>
      <p className="max-w-sm text-sm text-slate-500">{message}</p>
    </div>
  );
}

export function TableToolbar({
  search,
  onSearch,
  total,
  shown,
  filter,
  onFilter,
  filterLabel = "Tipo",
  options = [],
}: {
  search: string;
  onSearch: (value: string) => void;
  total: number;
  shown: number;
  filter?: string;
  onFilter?: (value: string) => void;
  filterLabel?: string;
  options?: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-end">
      <div className="relative flex-1">
        <Search size={17} className="pointer-events-none absolute left-3 top-3.5 text-slate-400" />
        <Input
          type="search"
          aria-label="Pesquisar na tabela"
          placeholder="PESQUISAR..."
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          className="pl-10"
        />
      </div>
      {onFilter && options.length > 0 && (
        <div className="sm:w-56">
          <Label htmlFor="table-filter" className="sr-only">{filterLabel}</Label>
          <Select id="table-filter" aria-label={`Filtrar por ${filterLabel}`} value={filter ?? ""} onChange={(event) => onFilter(event.target.value)}>
            <option value="">Todos</option>
            {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </Select>
        </div>
      )}
      <p className="whitespace-nowrap px-2 pb-2 text-sm font-medium text-slate-600">
        Total: <span className="text-slate-950">{total}</span>{shown !== total && <span className="text-slate-400"> · Exibindo {shown}</span>}
      </p>
    </div>
  );
}

export function LoadingState() {
  return <div className="flex items-center justify-center gap-2 py-14 text-sm text-slate-500"><LoaderCircle size={18} className="animate-spin" /> Carregando...</div>;
}

export function ErrorState({ message }: { message: string }) {
  return <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm font-medium text-red-700">{message}</p>;
}
