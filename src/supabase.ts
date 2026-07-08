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
 * Ejecuta una operación asíncrona con reintentos basados en exponential backoff (máximo 3 reintentos).
 * Si falla definitivamente, despacha un evento global "supabase-write-error" para notificar al usuario.
 */
async function executeWithRetry<T>(
  operationName: string,
  fn: () => Promise<T>,
  maxRetries: number = 3,
  dispatchError: boolean = true
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (error: any) {
      attempt++;
      if (attempt > maxRetries) {
        console.error(`[Supabase Retry] Error definitivo en "${operationName}" tras ${maxRetries} reintentos:`, error);
        
        if (dispatchError) {
          // Despachar evento para notificar al usuario
          const errorMsg = error?.message || String(error || "Error de red/permisos");
          let friendlyMsg = `No se pudo sincronizar la información de "${operationName}" en la base de datos tras varios intentos. Se ha guardado una copia en local para evitar pérdidas de información.`;
          
          if (
            errorMsg.toLowerCase().includes("could not find the table") ||
            errorMsg.toLowerCase().includes("schema cache") ||
            (errorMsg.toLowerCase().includes("relation") && errorMsg.toLowerCase().includes("does not exist")) ||
            (errorMsg.toLowerCase().includes("column") && errorMsg.toLowerCase().includes("does not exist"))
          ) {
            friendlyMsg += " RECOMENDACIÓN: Tu base de datos de Supabase no está sincronizada con los últimos cambios de tablas o columnas. Por favor, copia el contenido del archivo 'schema.sql' de este proyecto y ejecútalo en el SQL Editor del panel de Supabase para solucionarlo.";
          }

          const writeErrorEvent = new CustomEvent("supabase-write-error", {
            detail: {
              operation: operationName,
              error: errorMsg,
              message: friendlyMsg
            }
          });
          window.dispatchEvent(writeErrorEvent);
        }
        
        throw error;
      }
      const delay = Math.pow(2, attempt) * 100 + Math.random() * 50;
      console.warn(`[Supabase Retry] Intento ${attempt} fallido para "${operationName}". Reintentando en ${Math.round(delay)}ms... Error:`, error);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

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

    const rowData = {
      user_id: userId,
      forma_cara: rostro.forma_cara,
      pelo_actual: rostro.pelo_actual,
      barba_actual: rostro.barba_actual,
      clave: rostro.clave,
      image_src: finalImageUrl || "",
      updated_at: new Date().toISOString(),
    };

    await executeWithRetry("Guardar Rostro", async () => {
      const { data: existing, error: fetchError } = await supabase
        .from("rostro")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (existing) {
        const { error } = await supabase
          .from("rostro")
          .update(rowData)
          .eq("user_id", userId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("rostro")
          .insert(rowData);
        if (error) throw error;
      }
    });

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

    const rowData = {
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
    };

    await executeWithRetry("Guardar Prenda", async () => {
      const { data: existing, error: fetchError } = await supabase
        .from("prendas")
        .select("id")
        .eq("id", prenda.id)
        .eq("user_id", userId)
        .maybeSingle();

      if (fetchError) throw fetchError;

      const dataToSave: any = { ...rowData };

      const tryWrite = async (payload: any) => {
        if (existing) {
          const { error } = await supabase
            .from("prendas")
            .update(payload)
            .eq("id", prenda.id)
            .eq("user_id", userId);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("prendas")
            .insert({
              ...payload,
              created_at: new Date().toISOString(),
            });
          if (error) throw error;
        }
      };

      let done = false;
      let writeAttempts = 0;
      while (!done && writeAttempts < 10) {
        try {
          await tryWrite(dataToSave);
          done = true;
        } catch (writeErr: any) {
          writeAttempts++;
          const errMsg = writeErr?.message || String(writeErr);
          let columnRemoved = false;
          
          // Buscar qué propiedad de dataToSave falló inspeccionando el mensaje de error
          for (const key of Object.keys(dataToSave)) {
            if (
              errMsg.includes(`'${key}'`) || 
              errMsg.includes(`"${key}"`) || 
              errMsg.includes(key)
            ) {
              console.warn(`[Supabase Fallback] La columna '${key}' no existe en la tabla 'prendas'. Reintentando sin ella...`);
              delete dataToSave[key];
              columnRemoved = true;
              break;
            }
          }

          // Fallback adicional para códigos Postgres o palabras clave
          if (!columnRemoved && (writeErr?.code === "42703" || errMsg.toLowerCase().includes("column") || errMsg.toLowerCase().includes("schema cache"))) {
            const potentialNewColumns = ["composicion_tejido", "precio_compra", "veces_puesto", "descripcion", "tejido", "tags"];
            for (const col of potentialNewColumns) {
              if (dataToSave[col] !== undefined) {
                console.warn(`[Supabase Fallback] Eliminando columna potencialmente inexistente '${col}' ante error de esquema...`);
                delete dataToSave[col];
                columnRemoved = true;
                break;
              }
            }
          }

          if (!columnRemoved) {
            throw writeErr;
          }
        }
      }
    });

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

    const rowData = {
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
    };

    await executeWithRetry("Actualizar Prenda", async () => {
      const { data: existing, error: fetchError } = await supabase
        .from("prendas")
        .select("id")
        .eq("id", prenda.id)
        .eq("user_id", userId)
        .maybeSingle();

      if (fetchError) throw fetchError;

      const dataToSave: any = { ...rowData };

      const tryWrite = async (payload: any) => {
        if (existing) {
          const { error } = await supabase
            .from("prendas")
            .update(payload)
            .eq("id", prenda.id)
            .eq("user_id", userId);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("prendas")
            .insert({
              ...payload,
              created_at: new Date().toISOString(),
            });
          if (error) throw error;
        }
      };

      let done = false;
      let writeAttempts = 0;
      while (!done && writeAttempts < 10) {
        try {
          await tryWrite(dataToSave);
          done = true;
        } catch (writeErr: any) {
          writeAttempts++;
          const errMsg = writeErr?.message || String(writeErr);
          let columnRemoved = false;
          
          // Buscar qué propiedad de dataToSave falló inspeccionando el mensaje de error
          for (const key of Object.keys(dataToSave)) {
            if (
              errMsg.includes(`'${key}'`) || 
              errMsg.includes(`"${key}"`) || 
              errMsg.includes(key)
            ) {
              console.warn(`[Supabase Fallback] La columna '${key}' no existe en la tabla 'prendas'. Reintentando sin ella...`);
              delete dataToSave[key];
              columnRemoved = true;
              break;
            }
          }

          // Fallback adicional para códigos Postgres o palabras clave
          if (!columnRemoved && (writeErr?.code === "42703" || errMsg.toLowerCase().includes("column") || errMsg.toLowerCase().includes("schema cache"))) {
            const potentialNewColumns = ["composicion_tejido", "precio_compra", "veces_puesto", "descripcion", "tejido", "tags"];
            for (const col of potentialNewColumns) {
              if (dataToSave[col] !== undefined) {
                console.warn(`[Supabase Fallback] Eliminando columna potencialmente inexistente '${col}' ante error de esquema...`);
                delete dataToSave[col];
                columnRemoved = true;
                break;
              }
            }
          }

          if (!columnRemoved) {
            throw writeErr;
          }
        }
      }
    });

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
    await executeWithRetry("Eliminar Prenda", async () => {
      const { error } = await supabase
        .from("prendas")
        .delete()
        .eq("id", prendaId)
        .eq("user_id", userId);
      if (error) throw error;
    });
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
    await executeWithRetry("Guardar Historial de Look", async () => {
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
      if (error) throw error;
    });
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

    await executeWithRetry("Guardar Múltiples Historiales", async () => {
      const { error } = await supabase.from("historial").insert(payload);
      if (error) throw error;
    });
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

    await executeWithRetry("Actualizar Imagen de Historial", async () => {
      const { error } = await supabase
        .from("historial")
        .update(updatePayload)
        .eq("id", itemId)
        .eq("user_id", userId);
      if (error) throw error;
    });
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
    await executeWithRetry("Alternar Favorito de Historial", async () => {
      const { error } = await supabase
        .from("historial")
        .update({ favorito: newFavoritoState })
        .eq("id", itemId)
        .eq("user_id", userId);
      if (error) throw error;
    });
  } catch (err) {
    console.error("Critical error in toggleUserHistorialItemFavorito:", err);
  }
}

export async function deleteUserHistorialItem(userId: string, itemId: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase || userId === "usr_guest" || userId.startsWith("usr_mock")) {
    return;
  }
  try {
    await executeWithRetry("Eliminar de Historial", async () => {
      const { error } = await supabase
        .from("historial")
        .delete()
        .eq("id", itemId)
        .eq("user_id", userId);
      if (error) throw error;
    });
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
    await executeWithRetry("Restablecer Datos del Usuario", async () => {
      const deleteRostro = supabase.from("rostro").delete().eq("user_id", userId);
      const deletePrendas = supabase.from("prendas").delete().eq("user_id", userId);
      const deleteHistorial = supabase.from("historial").delete().eq("user_id", userId);
      const deletePerfil = supabase.from("perfil_estilo").delete().eq("user_id", userId);
      const deletePlanificaciones = supabase.from("planificaciones").delete().eq("user_id", userId);

      const [resRostro, resPrendas, resHistorial, resPerfil, resPlan] = await Promise.all([
        deleteRostro,
        deletePrendas,
        deleteHistorial,
        deletePerfil,
        deletePlanificaciones
      ]);

      if (resRostro.error) throw resRostro.error;
      if (resPrendas.error) throw resPrendas.error;
      if (resHistorial.error) throw resHistorial.error;
      if (resPerfil.error) throw resPerfil.error;
      if (resPlan.error) throw resPlan.error;
    });
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
    const rowData = {
      user_id: userId,
      estilo_vibe: perfil.estiloVibe || null,
      forma_ser: perfil.formaSer || null,
      estilo_objetivo: perfil.estiloObjetivo || null,
      estilo_presupuesto: perfil.estiloPresupuesto || null,
      detalles_libres: perfil.detallesLibres || null,
      respuestas_quiz: perfil.respuestasQuiz || null,
      updated_at: new Date().toISOString(),
    };

    await executeWithRetry("Guardar Perfil de Estilo", async () => {
      const { data: existing, error: fetchError } = await supabase
        .from("perfil_estilo")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (existing) {
        const { error } = await supabase
          .from("perfil_estilo")
          .update(rowData)
          .eq("user_id", userId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("perfil_estilo")
          .insert(rowData);
        if (error) throw error;
      }
    });
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
    await executeWithRetry("Guardar Planificación Semanal", async () => {
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
      if (error) throw error;
    });
  } catch (err) {
    console.error("Critical error in saveUserPlanificacion:", err);
  }
}

export async function deleteUserPlanificacion(userId: string, planId: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase || userId === "usr_guest" || userId.startsWith("usr_mock")) {
    return;
  }
  try {
    await executeWithRetry("Eliminar Planificación", async () => {
      const { error } = await supabase
        .from("planificaciones")
        .delete()
        .eq("id", planId)
        .eq("user_id", userId);
      if (error) throw error;
    });
  } catch (err) {
    console.error("Critical error in deleteUserPlanificacion:", err);
  }
}

// 7. ARMARIOS PERSONALIZADOS (CUSTOM CAPSULE LIST) HELPERS
export async function fetchUserArmariosLista(userId: string): Promise<string[] | null> {
  if (!isSupabaseConfigured || !supabase || userId === "usr_guest" || userId.startsWith("usr_mock")) {
    return null;
  }
  try {
    // 1. Try dedicated table
    const { data, error } = await supabase
      .from("armarios_personalizados")
      .select("nombre")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (!error && data && data.length > 0) {
      return data.map((item: any) => item.nombre);
    }

    // 2. Fallback to style profile respostasQuiz
    const { data: perfilData, error: perfilError } = await supabase
      .from("perfil_estilo")
      .select("respuestas_quiz")
      .eq("user_id", userId)
      .maybeSingle();

    if (!perfilError && perfilData?.respuestas_quiz) {
      const quiz = typeof perfilData.respuestas_quiz === "string" 
        ? JSON.parse(perfilData.respuestas_quiz) 
        : perfilData.respuestas_quiz;
      if (quiz && quiz.armariosDisponibles && Array.isArray(quiz.armariosDisponibles)) {
        return quiz.armariosDisponibles;
      }
    }
    
    return null;
  } catch (err) {
    console.warn("Error in fetchUserArmariosLista:", err);
    return null;
  }
}

export async function saveUserArmariosLista(userId: string, lista: string[]): Promise<void> {
  if (!isSupabaseConfigured || !supabase || userId === "usr_guest" || userId.startsWith("usr_mock")) {
    return;
  }
  try {
    // 1. Save to dedicated table if possible
    await executeWithRetry("Guardar Armarios en Tabla Dedicada", async () => {
      const { error: deleteError } = await supabase
        .from("armarios_personalizados")
        .delete()
        .eq("user_id", userId);

      if (deleteError) throw deleteError;

      if (lista.length > 0) {
        const payload = lista.map(nombre => ({ user_id: userId, nombre }));
        const { error: insertError } = await supabase
          .from("armarios_personalizados")
          .insert(payload);
        if (insertError) throw insertError;
      }
    }, 3, false);
  } catch (err) {
    console.warn("Could not save to armarios_personalizados table:", err);
  }

  // 2. Save/Backup in style profile respuestas_quiz for backward compatibility & easy migration
  try {
    await executeWithRetry("Backup de Armarios en Perfil de Estilo", async () => {
      const { data: perfilData, error: perfilError } = await supabase
        .from("perfil_estilo")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (perfilError) throw perfilError;

      let respuestasQuiz: any = {};
      const exists = !!perfilData;
      if (exists) {
        respuestasQuiz = typeof perfilData.respuestas_quiz === "string"
          ? JSON.parse(perfilData.respuestas_quiz)
          : perfilData.respuestas_quiz || {};
      }
      respuestasQuiz.armariosDisponibles = lista;

      if (exists) {
        const { error } = await supabase
          .from("perfil_estilo")
          .update({
            respuestas_quiz: respuestasQuiz,
            updated_at: new Date().toISOString()
          })
          .eq("user_id", userId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("perfil_estilo")
          .insert({
            user_id: userId,
            respuestas_quiz: respuestasQuiz,
            updated_at: new Date().toISOString()
          });
        if (error) throw error;
      }
    }, 3, false);
  } catch (err) {
    console.warn("Could not save backup in style profile respuestas_quiz:", err);
  }
}

