import { supabase } from "@/lib/supabase";

const BUCKET = "papel-timbrado";
const PATH = "timbrado.png";

/** URL pública da imagem de papel timbrado, ou null se nenhuma foi enviada ainda. */
export async function getLetterheadUrl(): Promise<string | null> {
  const { data } = await supabase.storage.from(BUCKET).list("", { search: PATH });
  if (!data || data.length === 0) return null;
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(PATH);
  return `${pub.publicUrl}?v=${Date.now()}`;
}

export async function uploadLetterhead(file: File): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).upload(PATH, file, { upsert: true, contentType: file.type });
  if (error) throw new Error(error.message);
}

export async function removeLetterhead(): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([PATH]);
  if (error) throw new Error(error.message);
}

/** Baixa a imagem e converte para data URL (necessário para embutir no PDF/Word gerado no navegador). */
export async function fetchLetterheadDataUrl(): Promise<string | null> {
  const url = await getLetterheadUrl();
  if (!url) return null;
  const res = await fetch(url);
  if (!res.ok) return null;
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
