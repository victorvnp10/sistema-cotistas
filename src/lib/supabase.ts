import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  // Falha alta e clara em vez de um erro confuso mais tarde -- se você está
  // vendo esta mensagem, falta configurar o arquivo .env (veja o README).
  throw new Error(
    "Variáveis de ambiente do Supabase não configuradas. Copie .env.example para .env e preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY."
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
