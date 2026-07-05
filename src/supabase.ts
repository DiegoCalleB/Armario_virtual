import { createClient } from "@supabase/supabase-js";
import { Rostro, Prenda, HistorialLook, PerfilEstilo, LookPlanificado } from "./types";

// Check if keys are set in environmental or window variables
// @ts-ignore
const supabaseUrl = (window as any).VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
// @ts-ignore
const supabaseAnonKey = (window as any).VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

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

/**
 * Convierte un Base64 a un ArrayBuffer y lo sube al Bucket de Supabase Storage.
 * Retorna la URL pública si la subida es exitosa; de lo contrario, el Base64 original.
 */
export async function uploadBase64ToStorage(
  userId: string,
  base64Data: string,
  bucketName: string = "prendas_armario"
): Promise<string> {
  if (!isSupabaseConfigured || !supabase || !base64Data) {
    return base64Data;
  }

  // Si no es un Base64 de tipo data:image, lo devolvemos tal cual (ya es una URL o similar)
  if (!base64Data.startsWith("data:")) {
    return base64Data;
  }

  try {
    // 1. Convertir Base64 a Blob utilizando fetch (el método más confiable y nativo del navegador)
    let blob: Blob;
    try {
      const response = await fetch(base64Data);
      blob = await response.blob();
    } catch (fetchErr) {
      console.warn("[Supabase Storage] Falló fetch para convertir Base64 a Blob, intentando método binario manual:", fetchErr);
      const matches = base64Data.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.*)$/);
      if (!matches || matches.length < 3) {
        return base64Data;
      }
      const contentType = matches[1];
      const rawBase64 = matches[2];
      const binaryString = atob(rawBase64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      blob = new Blob([bytes], { type: contentType });
    }

    // Para adaptarnos estrictamente a la política del usuario:
    // 1. LOWER((storage.foldername(name))[1]) = 'public' -> El primer nivel de carpeta debe ser "public"
    // 2. storage."extension"(name) = 'jpg' -> La extensión debe ser estrictamente "jpg"
    const finalContentType = "image/jpeg";
    const fileExt = "jpg";
    const fileName = `public/${userId}/${Date.now()}-${Math.floor(Math.random() * 100000)}.${fileExt}`;

    // Intentamos subir al bucket preferido. Si falla, probamos con otros buckets por resiliencia.
    const bucketsToTry = Array.from(new Set([bucketName, "prendas_armario", "prendas-imagenes", "prendas"]));

    let lastError: any = null;
    let successfulBucket: string | null = null;

    for (const currentBucket of bucketsToTry) {
      try {
        const { data, error } = await supabase.storage
          .from(currentBucket)
          .upload(fileName, blob, {
            contentType: finalContentType,
            upsert: false, // Desactivar upsert para no requerir permisos de SELECT ni UPDATE en el RLS
          });

        if (error) {
          lastError = error;
          console.warn(`[Supabase Storage] Intento fallido en bucket "${currentBucket}": ${error.message}`);
        } else if (data) {
          successfulBucket = currentBucket;
          break;
        }
      } catch (err) {
        lastError = err;
        console.warn(`[Supabase Storage] Error de red o permisos en bucket "${currentBucket}":`, err);
      }
    }

    if (!successfulBucket) {
      const errorMsg = lastError?.message || String(lastError || "Error desconocido");
      console.error(
        `[Supabase Storage] Error definitivo: No se pudo subir el archivo a ninguno de los buckets ${JSON.stringify(bucketsToTry)}. ` +
        `Último error: ${errorMsg}`
      );

      // Lanzamos un evento global para que la interfaz pueda capturarlo e informar
      // al usuario detalladamente sobre las políticas de seguridad RLS requeridas.
      const storageErrorEvent = new CustomEvent("supabase-storage-error", {
        detail: {
          error: errorMsg,
          buckets: bucketsToTry
        }
      });
      window.dispatchEvent(storageErrorEvent);

      return base64Data;
    }

    // Obtener la URL pública del archivo subido en el bucket que funcionó
    const { data: urlData } = supabase.storage
      .from(successfulBucket)
      .getPublicUrl(fileName);

    console.log(`[Supabase Storage] Imagen subida exitosamente al bucket "${successfulBucket}":`, urlData.publicUrl);
    return urlData.publicUrl;
  } catch (err) {
    console.error("[Supabase Storage] Error crítico al procesar la subida del archivo:", err);
    return base64Data;
  }
}

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

export async function saveUserRostro(userId: string, rostro: Rostro): Promise<Rostro> {
  if (!isSupabaseConfigured || !supabase || userId === "usr_guest" || userId.startsWith("usr_mock")) {
    return rostro;
  }
  try {
    let finalImageUrl = rostro.imageSrc;
    if (rostro.imageSrc && rostro.imageSrc.startsWith("data:")) {
      finalImageUrl = await uploadBase64ToStorage(userId, rostro.imageSrc, "prendas_armario");
    }

    const { error } = await supabase.from("rostro").upsert({
      user_id: userId,
      forma_cara: rostro.forma_cara,
      pelo_actual: rostro.pelo_actual,
      barba_actual: rostro.barba_actual,
      clave: rostro.clave,
      image_src: finalImageUrl || "",
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error("Error saving user rostro to Supabase:", error);
    }

    return { ...rostro, imageSrc: finalImageUrl };
  } catch (err) {
    console.error("Critical error in saveUserRostro:", err);
    return rostro;
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
      precio_compra: d.precio_compra !== null && d.precio_compra !== undefined ? Number(d.precio_compra) : undefined,
      veces_puesto: d.veces_puesto !== null && d.veces_puesto !== undefined ? Number(d.veces_puesto) : undefined,
      composicion_tejido: d.composicion_tejido || undefined,
    }));
  } catch (err) {
    console.error("Critical error in fetchUserPrendas:", err);
    return [];
  }
}

export async function saveUserPrenda(userId: string, prenda: Prenda): Promise<Prenda> {
  if (!isSupabaseConfigured || !supabase || userId === "usr_guest" || userId.startsWith("usr_mock")) {
    return prenda;
  }
  try {
    let finalImageUrl = prenda.imageSrc;
    if (prenda.imageSrc && prenda.imageSrc.startsWith("data:")) {
      finalImageUrl = await uploadBase64ToStorage(userId, prenda.imageSrc, "prendas_armario");
    }

    const { error } = await supabase.from("prendas").insert({
      id: prenda.id,
      user_id: userId,
      nombre: prenda.nombre,
      categoria: prenda.categoria,
      color: prenda.color,
      formalidad: prenda.formalidad,
      temporada: prenda.temporada,
      image_src: finalImageUrl,
      descripcion: prenda.descripcion || null,
      tejido: prenda.tejido || null,
      tags: prenda.tags || [],
      precio_compra: prenda.precio_compra !== undefined ? prenda.precio_compra : null,
      veces_puesto: prenda.veces_puesto !== undefined ? prenda.veces_puesto : 0,
      composicion_tejido: prenda.composicion_tejido || null,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error("Error inserting prenda into Supabase:", error);
    }

    return { ...prenda, imageSrc: finalImageUrl };
  } catch (err) {
    console.error("Critical error in saveUserPrenda:", err);
    return prenda;
  }
}

export async function updateUserPrenda(userId: string, prenda: Prenda): Promise<Prenda> {
  if (!isSupabaseConfigured || !supabase || userId === "usr_guest" || userId.startsWith("usr_mock")) {
    return prenda;
  }
  try {
    let finalImageUrl = prenda.imageSrc;
    if (prenda.imageSrc && prenda.imageSrc.startsWith("data:")) {
      finalImageUrl = await uploadBase64ToStorage(userId, prenda.imageSrc, "prendas_armario");
    }

    const { error } = await supabase
      .from("prendas")
      .update({
        nombre: prenda.nombre,
        categoria: prenda.categoria,
        color: prenda.color,
        formalidad: prenda.formalidad,
        temporada: prenda.temporada,
        image_src: finalImageUrl,
        descripcion: prenda.descripcion || null,
        tejido: prenda.tejido || null,
        tags: prenda.tags || [],
        precio_compra: prenda.precio_compra !== undefined ? prenda.precio_compra : null,
        veces_puesto: prenda.veces_puesto !== undefined ? prenda.veces_puesto : 0,
        composicion_tejido: prenda.composicion_tejido || null,
      })
      .eq("id", prenda.id)
      .eq("user_id", userId);

    if (error) {
      console.error("Error updating prenda in Supabase:", error);
    }

    return { ...prenda, imageSrc: finalImageUrl };
  } catch (err) {
    console.error("Critical error in updateUserPrenda:", err);
    return prenda;
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
    const deletePerfil = supabase.from("perfil_estilo").delete().eq("user_id", userId);
    const deletePlanificaciones = supabase.from("planificaciones").delete().eq("user_id", userId);

    await Promise.all([deleteRostro, deletePrendas, deleteHistorial, deletePerfil, deletePlanificaciones]);
  } catch (err) {
    console.error("Critical error resetting user data in Supabase:", err);
  }
}

// 5. PERFIL DE ESTILO (ADN ESTILO) HELPERS
export async function fetchUserPerfil(userId: string): Promise<PerfilEstilo | null> {
  if (!isSupabaseConfigured || !supabase || userId === "usr_guest" || userId.startsWith("usr_mock")) {
    return null;
  }
  try {
    const { data, error } = await supabase
      .from("perfil_estilo")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching user style profile from Supabase:", error);
      return null;
    }

    if (!data) return null;

    return {
      estiloVibe: data.estilo_vibe || undefined,
      formaSer: data.forma_ser || undefined,
      estiloObjetivo: data.estilo_objetivo || undefined,
      estiloPresupuesto: data.estilo_presupuesto || undefined,
      detallesLibres: data.detalles_libres || undefined,
      respuestasQuiz: data.respuestas_quiz || undefined,
    };
  } catch (err) {
    console.error("Critical error in fetchUserPerfil:", err);
    return null;
  }
}

export async function saveUserPerfil(userId: string, perfil: PerfilEstilo): Promise<PerfilEstilo> {
  if (!isSupabaseConfigured || !supabase || userId === "usr_guest" || userId.startsWith("usr_mock")) {
    return perfil;
  }
  try {
    const { error } = await supabase.from("perfil_estilo").upsert({
      user_id: userId,
      estilo_vibe: perfil.estiloVibe || null,
      forma_ser: perfil.formaSer || null,
      estilo_objetivo: perfil.estiloObjetivo || null,
      estilo_presupuesto: perfil.estiloPresupuesto || null,
      detalles_libres: perfil.detallesLibres || null,
      respuestas_quiz: perfil.respuestasQuiz || null,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error("Error saving user style profile to Supabase:", error);
    }
    return perfil;
  } catch (err) {
    console.error("Critical error in saveUserPerfil:", err);
    return perfil;
  }
}

// 6. PLANIFICACIONES (WEEKLY PLANNER) HELPERS
export async function fetchUserPlanificaciones(userId: string): Promise<LookPlanificado[]> {
  if (!isSupabaseConfigured || !supabase || userId === "usr_guest" || userId.startsWith("usr_mock")) {
    return [];
  }
  try {
    const { data, error } = await supabase
      .from("planificaciones")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching user planificaciones from Supabase:", error);
      return [];
    }

    if (!data) return [];

    return data.map((d: any) => ({
      id: d.id,
      fecha: d.fecha,
      nombre_look: d.nombre_look,
      prendasIds: d.prendas_ids || [],
      clima_simulado: d.clima_simulado,
      comentarios_sastre: d.comentarios_sastre || undefined,
    }));
  } catch (err) {
    console.error("Critical error in fetchUserPlanificaciones:", err);
    return [];
  }
}

export async function saveUserPlanificacion(userId: string, plan: LookPlanificado): Promise<void> {
  if (!isSupabaseConfigured || !supabase || userId === "usr_guest" || userId.startsWith("usr_mock")) {
    return;
  }
  try {
    const { error } = await supabase.from("planificaciones").insert({
      id: plan.id,
      user_id: userId,
      fecha: plan.fecha,
      nombre_look: plan.nombre_look,
      prendas_ids: plan.prendasIds,
      clima_simulado: plan.clima_simulado,
      comentarios_sastre: plan.comentarios_sastre || null,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error("Error inserting planificacion into Supabase:", error);
    }
  } catch (err) {
    console.error("Critical error in saveUserPlanificacion:", err);
  }
}

export async function deleteUserPlanificacion(userId: string, planId: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase || userId === "usr_guest" || userId.startsWith("usr_mock")) {
    return;
  }
  try {
    const { error } = await supabase
      .from("planificaciones")
      .delete()
      .eq("id", planId)
      .eq("user_id", userId);

    if (error) {
      console.error("Error deleting planificacion from Supabase:", error);
    }
  } catch (err) {
    console.error("Critical error in deleteUserPlanificacion:", err);
  }
}
