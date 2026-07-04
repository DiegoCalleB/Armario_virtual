import { doc, getDoc, setDoc, deleteDoc, collection, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { Rostro, Prenda, HistorialLook } from '../types';

export async function fetchUserRostro(userId: string): Promise<Rostro | null> {
  if (userId === "usr_guest" || userId.startsWith("usr_mock")) {
    return null;
  }
  const path = `rostro/${userId}`;
  try {
    const docRef = doc(db, 'rostro', userId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    const data = docSnap.data();
    return {
      forma_cara: data.forma_cara,
      pelo_actual: data.pelo_actual,
      barba_actual: data.barba_actual,
      clave: data.clave,
      imageSrc: data.image_src,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
}

export async function saveUserRostro(userId: string, rostro: Rostro): Promise<Rostro> {
  if (userId === "usr_guest" || userId.startsWith("usr_mock")) {
    return rostro;
  }
  const path = `rostro/${userId}`;
  try {
    const docRef = doc(db, 'rostro', userId);
    const payload = {
      user_id: userId,
      forma_cara: rostro.forma_cara || "",
      pelo_actual: rostro.pelo_actual || "",
      barba_actual: rostro.barba_actual || "",
      clave: rostro.clave || "",
      image_src: rostro.imageSrc || "",
      updated_at: new Date().toISOString()
    };
    await setDoc(docRef, payload);
    return rostro;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    return rostro;
  }
}

export async function deleteUserRostro(userId: string): Promise<void> {
  if (userId === "usr_guest" || userId.startsWith("usr_mock")) {
    return;
  }
  const path = `rostro/${userId}`;
  try {
    const docRef = doc(db, 'rostro', userId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function fetchUserPrendas(userId: string): Promise<Prenda[]> {
  if (userId === "usr_guest" || userId.startsWith("usr_mock")) {
    return [];
  }
  const path = 'prendas';
  try {
    const q = query(
      collection(db, 'prendas'),
      where('user_id', '==', userId)
    );
    const querySnapshot = await getDocs(q);
    const list: Prenda[] = [];
    querySnapshot.forEach((docSnap) => {
      const d = docSnap.data();
      list.push({
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
      });
    });
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return [];
  }
}

export async function saveUserPrenda(userId: string, prenda: Prenda): Promise<Prenda> {
  if (userId === "usr_guest" || userId.startsWith("usr_mock")) {
    return prenda;
  }
  const path = `prendas/${prenda.id}`;
  try {
    const docRef = doc(db, 'prendas', prenda.id);
    const payload = {
      id: prenda.id,
      user_id: userId,
      nombre: prenda.nombre,
      categoria: prenda.categoria,
      color: prenda.color || "",
      formalidad: prenda.formalidad || "",
      temporada: prenda.temporada || "",
      image_src: prenda.imageSrc,
      descripcion: prenda.descripcion || null,
      tejido: prenda.tejido || null,
      tags: prenda.tags || [],
      created_at: new Date().toISOString()
    };
    await setDoc(docRef, payload);
    return prenda;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    return prenda;
  }
}

export async function updateUserPrenda(userId: string, prenda: Prenda): Promise<Prenda> {
  if (userId === "usr_guest" || userId.startsWith("usr_mock")) {
    return prenda;
  }
  const path = `prendas/${prenda.id}`;
  try {
    const docRef = doc(db, 'prendas', prenda.id);
    const payload = {
      nombre: prenda.nombre,
      categoria: prenda.categoria,
      color: prenda.color || "",
      formalidad: prenda.formalidad || "",
      temporada: prenda.temporada || "",
      image_src: prenda.imageSrc,
      descripcion: prenda.descripcion || null,
      tejido: prenda.tejido || null,
      tags: prenda.tags || [],
    };
    await setDoc(docRef, payload, { merge: true });
    return prenda;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    return prenda;
  }
}

export async function deleteUserPrenda(userId: string, prendaId: string): Promise<void> {
  if (userId === "usr_guest" || userId.startsWith("usr_mock")) {
    return;
  }
  const path = `prendas/${prendaId}`;
  try {
    const docRef = doc(db, 'prendas', prendaId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function fetchUserHistorial(userId: string): Promise<HistorialLook[]> {
  if (userId === "usr_guest" || userId.startsWith("usr_mock")) {
    return [];
  }
  const path = 'historial';
  try {
    const q = query(
      collection(db, 'historial'),
      where('user_id', '==', userId)
    );
    const querySnapshot = await getDocs(q);
    const list: HistorialLook[] = [];
    querySnapshot.forEach((docSnap) => {
      const d = docSnap.data();
      list.push({
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
      });
    });
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return [];
  }
}

export async function saveUserHistorialItem(userId: string, item: HistorialLook): Promise<void> {
  if (userId === "usr_guest" || userId.startsWith("usr_mock")) {
    return;
  }
  const path = `historial/${item.id}`;
  try {
    const docRef = doc(db, 'historial', item.id);
    const payload = {
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
      created_at: new Date().toISOString()
    };
    await setDoc(docRef, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveMultipleUserHistorialItems(userId: string, items: HistorialLook[]): Promise<void> {
  if (userId === "usr_guest" || userId.startsWith("usr_mock") || items.length === 0) {
    return;
  }
  const path = 'historial';
  try {
    const batch = writeBatch(db);
    items.forEach((item) => {
      const docRef = doc(db, 'historial', item.id);
      const payload = {
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
        created_at: new Date().toISOString()
      };
      batch.set(docRef, payload);
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateUserHistorialItemImage(
  userId: string,
  itemId: string,
  isFullBody: boolean,
  imageUrl: string
): Promise<void> {
  if (userId === "usr_guest" || userId.startsWith("usr_mock")) {
    return;
  }
  const path = `historial/${itemId}`;
  try {
    const docRef = doc(db, 'historial', itemId);
    const payload: any = {};
    if (isFullBody) {
      payload.look_simulated_full_body_image_url = imageUrl;
    } else {
      payload.look_simulated_image_url = imageUrl;
    }
    await setDoc(docRef, payload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function toggleUserHistorialItemFavorito(
  userId: string,
  itemId: string,
  newFavoritoState: boolean
): Promise<void> {
  if (userId === "usr_guest" || userId.startsWith("usr_mock")) {
    return;
  }
  const path = `historial/${itemId}`;
  try {
    const docRef = doc(db, 'historial', itemId);
    await setDoc(docRef, { favorito: newFavoritoState }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteUserHistorialItem(userId: string, itemId: string): Promise<void> {
  if (userId === "usr_guest" || userId.startsWith("usr_mock")) {
    return;
  }
  const path = `historial/${itemId}`;
  try {
    const docRef = doc(db, 'historial', itemId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function resetUserAllData(userId: string): Promise<void> {
  if (userId === "usr_guest" || userId.startsWith("usr_mock")) {
    return;
  }
  try {
    const batch = writeBatch(db);
    // 1. Rostro
    const docRefRostro = doc(db, 'rostro', userId);
    batch.delete(docRefRostro);

    // 2. Prendas
    const qPrendas = query(collection(db, 'prendas'), where('user_id', '==', userId));
    const prendasSnap = await getDocs(qPrendas);
    prendasSnap.forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });

    // 3. Historial
    const qHistorial = query(collection(db, 'historial'), where('user_id', '==', userId));
    const historialSnap = await getDocs(qHistorial);
    historialSnap.forEach((docSnap) => {
      batch.delete(docSnap.ref);
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, null);
  }
}
