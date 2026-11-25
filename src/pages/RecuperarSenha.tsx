import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Card, Field, Input, Button } from "@/components/ui";
import { Building2, KeyRound, MailCheck } from "lucide-react";

const SENHA_MINIMA = 8;

// O link do e-mail volta para esta rota. Com o fluxo PKCE, o Supabase acrescenta "?code=..."
// antes do "#", e o supabase-js troca esse código por uma sessão de recuperação ao carregar.
function urlDeRedefinicao() {
  return `${window.location.origin}${import.meta.env.BASE_URL}#/redefinir-senha`;
}

function Moldura({ icone, titulo, subtitulo, children }: {
  icone: React.ReactNode;
  titulo: string;
  subtitulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f3f6f4] px-5 py-10 sm:px-8">
      <div className="w-full max-w-[430px]">
        <div className="mb-9 flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-[#10251e] text-white"><Building2 size={22} /></span>
          <div><p className="font-semibold text-slate-900">Imobiliária Regional</p><p className="text-[10px] uppercase tracking-[0.12em] text-brand-700">Gestão inteligente</p></div>
        </div>
        <div className="mb-7">
          <span className="mb-5 grid size-12 place-items-center rounded-2xl border border-brand-100 bg-brand-50 text-brand-700">{icone}</span>
          <h2 className="text-3xl font-semibold tracking-[-0.04em] text-slate-950">{titulo}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">{subtitulo}</p>
        </div>
        <Card className="p-5 sm:p-7">{children}</Card>
        <p className="mt-5 text-center text-sm">
          <Link to="/login" className="font-medium text-brand-700 hover:underline">Voltar para o login</Link>
        </p>
      </div>
    </div>
  );
}

function Erro({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm font-medium text-red-700">{children}</p>;
}

export function EsqueciSenhaPage() {
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: urlDeRedefinicao() });
    setPending(false);

    if (error) {
      setError(
        error.status === 429
          ? "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo."
          : "Não foi possível enviar o e-mail agora. Tente novamente.",
      );
      return;
    }
    // Mesma mensagem exista ou não o e-mail, para não revelar quem tem cadastro.
    setEnviado(true);
  }

  if (enviado) {
    return (
      <Moldura icone={<MailCheck size={22} />} titulo="Confira seu e-mail" subtitulo="Se esse e-mail tiver acesso ao sistema, você vai receber um link para criar uma nova senha.">
        <p className="text-sm leading-6 text-slate-600">
          Abra o link <strong>neste mesmo navegador</strong>. Ele vale por pouco tempo; se expirar, é só pedir outro.
          Não chegou? Olhe a caixa de spam.
        </p>
      </Moldura>
    );
  }

  return (
    <Moldura icone={<KeyRound size={22} />} titulo="Esqueceu a senha?" subtitulo="Informe o e-mail que você usa para entrar e enviaremos um link para criar uma nova senha.">
      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label="E-mail" htmlFor="email">
          <Input id="email" name="email" type="email" required autoComplete="email" placeholder="nome@imobiliaria.com.br" />
        </Field>
        {error && <Erro>{error}</Erro>}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Enviando..." : "Enviar link"}
        </Button>
      </form>
    </Moldura>
  );
}

export function RedefinirSenhaPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const senha = String(formData.get("senha") ?? "");
    const confirmacao = String(formData.get("confirmacao") ?? "");

    if (senha.length < SENHA_MINIMA) {
      setError(`A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`);
      return;
    }
    if (senha !== confirmacao) {
      setError("As duas senhas não são iguais.");
      return;
    }

    setPending(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setPending(false);

    if (error) {
      setError(
        error.code === "same_password"
          ? "A nova senha precisa ser diferente da anterior."
          : error.code === "weak_password"
            ? "Senha fraca demais. Use letras e números."
            : "Não foi possível salvar a nova senha. Peça um novo link e tente de novo.",
      );
      return;
    }

    navigate("/dashboard", { replace: true });
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400 text-sm">Carregando...</div>;
  }

  if (!session) {
    return (
      <Moldura icone={<KeyRound size={22} />} titulo="Link inválido ou expirado" subtitulo="Não foi possível confirmar o pedido de troca de senha.">
        <div className="space-y-4 text-sm leading-6 text-slate-600">
          <p>Isso acontece quando o link já foi usado, passou do prazo ou foi aberto em outro navegador.</p>
          <Button type="button" className="w-full" onClick={() => navigate("/esqueci-senha")}>Pedir um novo link</Button>
        </div>
      </Moldura>
    );
  }

  return (
    <Moldura icone={<KeyRound size={22} />} titulo="Criar nova senha" subtitulo={`Defina a nova senha de acesso para ${session.user.email ?? "sua conta"}.`}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label="Nova senha" htmlFor="senha">
          <Input id="senha" name="senha" type="password" required minLength={SENHA_MINIMA} autoComplete="new-password" placeholder={`Mínimo de ${SENHA_MINIMA} caracteres`} />
        </Field>
        <Field label="Repita a nova senha" htmlFor="confirmacao">
          <Input id="confirmacao" name="confirmacao" type="password" required minLength={SENHA_MINIMA} autoComplete="new-password" placeholder="Digite de novo" />
        </Field>
        {error && <Erro>{error}</Erro>}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Salvando..." : "Salvar nova senha"}
        </Button>
      </form>
    </Moldura>
  );
}
