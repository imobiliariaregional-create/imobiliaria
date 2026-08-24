import { FormEvent, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Card, Field, Input, Button } from "@/components/ui";
import { Building2, CheckCircle2, KeyRound, ShieldCheck, Sparkles } from "lucide-react";

export function LoginPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!loading && session) {
    const from = (location.state as { from?: Location })?.from?.pathname ?? "/dashboard";
    return <Navigate to={from} replace />;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError("E-mail ou senha inválidos.");
      setPending(false);
      return;
    }

    navigate("/dashboard");
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f3f6f4] lg:grid lg:grid-cols-[1.08fr_0.92fr]">
      <section className="relative hidden overflow-hidden bg-[#10251e] p-12 text-white lg:flex lg:flex-col lg:justify-between xl:p-16">
        <div className="absolute -right-32 -top-32 size-[34rem] rounded-full border border-white/10 bg-emerald-400/10" />
        <div className="absolute -bottom-56 -left-36 size-[36rem] rounded-full border border-white/10 bg-brand-500/10" />
        <div className="relative flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-brand-500 shadow-xl shadow-black/25"><Building2 size={23} /></span>
          <div><p className="font-semibold">Imobiliária Regional</p><p className="text-[11px] uppercase tracking-[0.14em] text-emerald-200/60">Gestão inteligente</p></div>
        </div>
        <div className="relative max-w-xl py-16">
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-200/20 bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-emerald-100"><Sparkles size={14} /> Tudo em um só lugar</span>
          <h1 className="text-4xl font-semibold leading-[1.12] tracking-[-0.04em] xl:text-5xl">Gestão simples para negócios imobiliários mais fortes.</h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-emerald-50/60">Imóveis, contratos e financeiro organizados para sua equipe trabalhar com clareza e agilidade.</p>
          <div className="mt-10 grid max-w-lg grid-cols-2 gap-3 text-sm text-emerald-50/75">
            <span className="flex items-center gap-2"><CheckCircle2 size={17} className="text-emerald-300" /> Operação centralizada</span>
            <span className="flex items-center gap-2"><ShieldCheck size={17} className="text-emerald-300" /> Acesso protegido</span>
          </div>
        </div>
        <p className="relative text-xs text-emerald-100/35">Ambiente exclusivo da equipe Regional.</p>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-[430px]">
          <div className="mb-9 flex items-center gap-3 lg:hidden">
            <span className="grid size-11 place-items-center rounded-2xl bg-[#10251e] text-white"><Building2 size={22} /></span>
            <div><p className="font-semibold text-slate-900">Imobiliária Regional</p><p className="text-[10px] uppercase tracking-[0.12em] text-brand-700">Gestão inteligente</p></div>
          </div>
          <div className="mb-7">
            <span className="mb-5 grid size-12 place-items-center rounded-2xl border border-brand-100 bg-brand-50 text-brand-700"><KeyRound size={22} /></span>
            <h2 className="text-3xl font-semibold tracking-[-0.04em] text-slate-950">Bem-vindo de volta</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">Entre com seus dados para acessar o painel de gestão.</p>
          </div>

          <Card className="p-5 sm:p-7">
            <form onSubmit={handleSubmit} className="space-y-5">
          <Field label="E-mail" htmlFor="email">
                <Input id="email" name="email" type="email" required autoComplete="email" placeholder="nome@imobiliaria.com.br" />
          </Field>
          <Field label="Senha" htmlFor="password">
                <Input id="password" name="password" type="password" required autoComplete="current-password" placeholder="Digite sua senha" />
          </Field>

              {error && <p className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm font-medium text-red-700">{error}</p>}

              <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </Card>
          <p className="mt-5 text-center text-xs leading-5 text-slate-400">Acesso restrito a usuários autorizados.</p>
        </div>
      </section>
    </div>
  );
}
