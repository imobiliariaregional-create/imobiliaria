import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error("Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env.local");
}

// PKCE: o link de recuperação de senha volta com "?code=..." na query, o que convive bem com
// o HashRouter (no fluxo implícito os tokens viriam no "#" e brigariam com as rotas).
export const supabase = createClient(url, anonKey, { auth: { flowType: "pkce" } });
