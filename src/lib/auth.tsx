import { createContext, useContext, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import type { PapelUsuario } from "@/lib/types";

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  papel: PapelUsuario | null;
  perfilLoading: boolean;
}

const AuthContext = createContext<AuthContextValue>({ session: null, loading: true, papel: null, perfilLoading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [papel, setPapel] = useState<PapelUsuario | null>(null);
  const [perfilLoading, setPerfilLoading] = useState(true);

  async function loadPerfil(userId: string | undefined) {
    setPerfilLoading(true);
    if (!userId) {
      setPapel(null);
      setPerfilLoading(false);
      return;
    }
    const { data } = await supabase.from("perfis").select("papel").eq("user_id", userId).maybeSingle();
    setPapel((data?.papel as PapelUsuario | undefined) ?? null);
    setPerfilLoading(false);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      void loadPerfil(data.session?.user.id);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      void loadPerfil(newSession?.user.id);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  return <AuthContext.Provider value={{ session, loading, papel, perfilLoading }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading, papel, perfilLoading } = useAuth();
  const location = useLocation();

  if (loading || (session && perfilLoading)) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400 text-sm">Carregando...</div>;
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!papel) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-slate-700">Seu usuário ainda não possui um perfil de acesso ao sistema.</p>
        <button className="text-sm text-brand-700 hover:underline" onClick={() => void supabase.auth.signOut()}>
          Sair e entrar com outra conta
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
