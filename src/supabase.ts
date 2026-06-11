import { createClient } from "@supabase/supabase-js";
import { Rostro, Prenda, HistorialLook } from "./types";

// Check if keys are set in environmental or window variables
const supabaseUrl = (window as any).VITE_SUPABASE_URL || (import.meta as any).env.VITE_SUPABASE_URL;
const supabaseAnonKey = (window as any).VITE_SUPABASE_ANON_KEY || (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

let isConfigured = false;
let supabaseClient = null;

if (
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl !== "MY_VITE_SUPABASE_URL" &&
  supabaseAnonKey !== "MY_VITE_SUPABASE_ANON_KEY" &&
  !supabaseUrl.includes("placeholder") &&
  !supabaseUrl.includes("tu-url") &&
  !supabaseUrl.includes("your-supabase")
) {
  try {
    // Validate format of the URL to prevent TypeError crashes during initialization
    new URL(supabaseUrl);
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    isConfigured = true;
  } catch (err) {
    console.warn("La inicialización de Supabase falló debido a una URL inválida:", err);
    isConfigured = false;
    supabaseClient = null;
  }
}

export const isSupabaseConfigured = isConfigured;
export const supabase = supabaseClient;

// ==========================================
// SUPABASE DATABASE SYNC HELPERS (CRUD)
// ==========================================

// 1. ROSTRO HELPERS
export async function fetchUserRostro(userId: string): Promise<Rostro | null> {
  if (!isSupabaseConfigured || !supabase || userId === "usr_guest" || userId.startsWith("usr_mock")) {
    return null;
  }
  try {
    const { data, error } = await supabase
      .from("rostro")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching user rostro from Supabase:", error);
      return null;
    }

    if (!data) return null;

    return {
      forma_cara: data.forma_cara,
      pelo_actual: data.pelo_actual,
      barba_actual: data.barba_actual,
      clave: data.clave,
      imageSrc: data.image_src,
    };
  } catch (err) {
    console.error("Critical error in fetchUserRostro:", err);
    return null;
  }
}

export async function saveUserRostro(userId: string, rostro: Rostro): Promise<void> {
  if (!isSupabaseConfigured || !supabase || userId === "usr_guest" || userId.startsWith("usr_mock")) {
    return;
  }
  try {
    const { error } = await supabase.from("rostro").upsert({
      user_id: userId,
      forma_cara: rostro.forma_cara,
      pelo_actual: rostro.pelo_actual,
      barba_actual: rostro.barba_actual,
      clave: rostro.clave,
      image_src: rostro.imageSrc || "",
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error("Error saving user rostro to Supabase:", error);
    }
  } catch (err) {
    console.error("Critical error in saveUserRostro:", err);
  }
}

export async function deleteUserRostro(userId: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase || userId === "usr_guest" || userId.startsWith("usr_mock")) {
    return;
  }
  try {
    const { error } = await supabase
      .from("rostro")
      .delete()
      .eq("user_id", userId);

    if (error) {
      console.error("Error deleting user rostro from Supabase:", error);
    }
  } catch (err) {
    console.error("Critical error in deleteUserRostro:", err);
  }
}

// 2. PRENDAS (WARDROBE) HELPERS
export async function fetchUserPrendas(userId: string): Promise<Prenda[]> {
  if (!isSupabaseConfigured || !supabase || userId === "usr_guest" || userId.startsWith("usr_mock")) {
    return [];
  }
  try {
    const { data, error } = await supabase
      .from("prendas")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching user prendas from Supabase:", error);
      return [];
    }

    if (!data) return [];

    return data.map((d: any) => ({
      id: d.id,
      nombre: d.nombre,
      categoria: d.categoria,
      color: d.color,
      formalidad: d.formalidad,
      temporada: d.temporada,
      imageSrc: d.image_src,
      descripcion: d.descripcion || undefined,
      tejido: d.tejido || undefined,
      tags: d.tags || [],
    }));
  } catch (err) {
    console.error("Critical error in fetchUserPrendas:", err);
    return [];
  }
}

export async function saveUserPrenda(userId: string, prenda: Prenda): Promise<void> {
  if (!isSupabaseConfigured || !supabase || userId === "usr_guest" || userId.startsWith("usr_mock")) {
    return;
  }
  try {
    const { error } = await supabase.from("prendas").insert({
      id: prenda.id,
      user_id: userId,
      nombre: prenda.nombre,
      categoria: prenda.categoria,
      color: prenda.color,
      formalidad: prenda.formalidad,
      temporada: prenda.temporada,
      image_src: prenda.imageSrc,
      descripcion: prenda.descripcion || null,
      tejido: prenda.tejido || null,
      tags: prenda.tags || [],
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error("Error inserting prenda into Supabase:", error);
    }
  } catch (err) {
    console.error("Critical error in saveUserPrenda:", err);
  }
}

export async function updateUserPrenda(userId: string, prenda: Prenda): Promise<void> {
  if (!isSupabaseConfigured || !supabase || userId === "usr_guest" || userId.startsWith("usr_mock")) {
    return;
  }
  try {
    const { error } = await supabase
      .from("prendas")
      .update({
        nombre: prenda.nombre,
        categoria: prenda.categoria,
        color: prenda.color,
        formalidad: prenda.formalidad,
        temporada: prenda.temporada,
        image_src: prenda.imageSrc,
        descripcion: prenda.descripcion || null,
        tejido: prenda.tejido || null,
        tags: prenda.tags || [],
      })
      .eq("id", prenda.id)
      .eq("user_id", userId);

    if (error) {
      console.error("Error updating prenda in Supabase:", error);
    }
  } catch (err) {
    console.error("Critical error in updateUserPrenda:", err);
  }
}

export async function deleteUserPrenda(userId: string, prendaId: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase || userId === "usr_guest" || userId.startsWith("usr_mock")) {
    return;
  }
  try {
    const { error } = await supabase
      .from("prendas")
      .delete()
      .eq("id", prendaId)
      .eq("user_id", userId);

    if (error) {
      console.error("Error deleting prenda from Supabase:", error);
    }
  } catch (err) {
    console.error("Critical error in deleteUserPrenda:", err);
  }
}

// 3. HISTORIAL HELPERS
export async function fetchUserHistorial(userId: string): Promise<HistorialLook[]> {
  if (!isSupabaseConfigured || !supabase || userId === "usr_guest" || userId.startsWith("usr_mock")) {
    return [];
  }
  try {
    const { data, error } = await supabase
      .from("historial")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching user historial from Supabase:", error);
      return [];
    }

    if (!data) return [];

    return data.map((d: any) => ({
      id: d.id,
      fecha: d.fecha,
      ocasion: d.ocasion,
      clima: d.clima,
      favorito: d.favorito,
      look: {
        titulo: d.look_titulo,
        id_prendas: d.look_id_prendas || [],
        porque: d.look_porque,
        pelo_sugerido: d.look_pelo_sugerido,
        barba_sugerida: d.look_barba_sugerida,
        consejo_barberia: d.look_consejo_barberia,
        simulatedImageUrl: d.look_simulated_image_url || undefined,
        simulatedFullBodyImageUrl: d.look_simulated_full_body_image_url || undefined,
      },
    }));
  } catch (err) {
    console.error("Critical error in fetchUserHistorial:", err);
    return [];
  }
}

export async function saveUserHistorialItem(userId: string, item: HistorialLook): Promise<void> {
  if (!isSupabaseConfigured || !supabase || userId === "usr_guest" || userId.startsWith("usr_mock")) {
    return;
  }
  try {
    const { error } = await supabase.from("historial").insert({
      id: item.id,
      user_id: userId,
      fecha: item.fecha,
      ocasion: item.ocasion,
      clima: item.clima,
      look_titulo: item.look.titulo,
      look_porque: item.look.porque,
      look_pelo_sugerido: item.look.pelo_sugerido,
      look_barba_sugerida: item.look.barba_sugerida,
      look_consejo_barberia: item.look.consejo_barberia,
      look_id_prendas: item.look.id_prendas,
      look_simulated_image_url: item.look.simulatedImageUrl || null,
      look_simulated_full_body_image_url: item.look.simulatedFullBodyImageUrl || null,
      favorito: item.favorito,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error("Error inserting historial item into Supabase:", error);
    }
  } catch (err) {
    console.error("Critical error in saveUserHistorialItem:", err);
  }
}

export async function saveMultipleUserHistorialItems(userId: string, items: HistorialLook[]): Promise<void> {
  if (!isSupabaseConfigured || !supabase || userId === "usr_guest" || userId.startsWith("usr_mock") || items.length === 0) {
    return;
  }
  try {
    const payload = items.map((item) => ({
      id: item.id,
      user_id: userId,
      fecha: item.fecha,
      ocasion: item.ocasion,
      clima: item.clima,
      look_titulo: item.look.titulo,
      look_porque: item.look.porque,
      look_pelo_sugerido: item.look.pelo_sugerido,
      look_barba_sugerida: item.look.barba_sugerida,
      look_consejo_barberia: item.look.consejo_barberia,
      look_id_prendas: item.look.id_prendas,
      look_simulated_image_url: item.look.simulatedImageUrl || null,
      look_simulated_full_body_image_url: item.look.simulatedFullBodyImageUrl || null,
      favorito: item.favorito,
      created_at: new Date().toISOString(),
    }));

    const { error } = await supabase.from("historial").insert(payload);

    if (error) {
      console.error("Error inserting multiple historial items into Supabase:", error);
    }
  } catch (err) {
    console.error("Critical error in saveMultipleUserHistorialItems:", err);
  }
}

export async function updateUserHistorialItemImage(
  userId: string,
  itemId: string,
  isFullBody: boolean,
  imageUrl: string
): Promise<void> {
  if (!isSupabaseConfigured || !supabase || userId === "usr_guest" || userId.startsWith("usr_mock")) {
    return;
  }
  try {
    const updatePayload: any = {};
    if (isFullBody) {
      updatePayload.look_simulated_full_body_image_url = imageUrl;
    } else {
      updatePayload.look_simulated_image_url = imageUrl;
    }

    const { error } = await supabase
      .from("historial")
      .update(updatePayload)
      .eq("id", itemId)
      .eq("user_id", userId);

    if (error) {
      console.error("Error updating image in historical item in Supabase:", error);
    }
  } catch (err) {
    console.error("Critical error in updateUserHistorialItemImage:", err);
  }
}

export async function toggleUserHistorialItemFavorito(
  userId: string,
  itemId: string,
  newFavoritoState: boolean
): Promise<void> {
  if (!isSupabaseConfigured || !supabase || userId === "usr_guest" || userId.startsWith("usr_mock")) {
    return;
  }
  try {
    const { error } = await supabase
      .from("historial")
      .update({ favorito: newFavoritoState })
      .eq("id", itemId)
      .eq("user_id", userId);

    if (error) {
      console.error("Error toggling favorito in historical item in Supabase:", error);
    }
  } catch (err) {
    console.error("Critical error in toggleUserHistorialItemFavorito:", err);
  }
}

export async function deleteUserHistorialItem(userId: string, itemId: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase || userId === "usr_guest" || userId.startsWith("usr_mock")) {
    return;
  }
  try {
    const { error } = await supabase
      .from("historial")
      .delete()
      .eq("id", itemId)
      .eq("user_id", userId);

    if (error) {
      console.error("Error deleting historical item from Supabase:", error);
    }
  } catch (err) {
    console.error("Critical error in deleteUserHistorialItem:", err);
  }
}

// 4. RESET USER DATA
export async function resetUserAllData(userId: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase || userId === "usr_guest" || userId.startsWith("usr_mock")) {
    return;
  }
  try {
    // Rely on cascade or run deletes in parallel
    const deleteRostro = supabase.from("rostro").delete().eq("user_id", userId);
    const deletePrendas = supabase.from("prendas").delete().eq("user_id", userId);
    const deleteHistorial = supabase.from("historial").delete().eq("user_id", userId);

    await Promise.all([deleteRostro, deletePrendas, deleteHistorial]);
  } catch (err) {
    console.error("Critical error resetting user data in Supabase:", err);
  }
}
