import { auth as firebaseAuth, googleProvider } from "./lib/firebase";
import * as firebaseDb from "./lib/firebaseDb";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut, 
  onAuthStateChanged,
  sendSignInLinkToEmail
} from "firebase/auth";
import { signInWithPopup } from "firebase/auth";

// Expose configured state as true, so that App.tsx knows cloud DB is fully configured and active
export const isSupabaseConfigured = true;

// Mock client that proxies all Supabase Auth functions directly to Firebase Auth
export const supabase = {
  auth: {
    async getSession() {
      const user = firebaseAuth.currentUser;
      if (user) {
        return {
          data: {
            session: {
              user: {
                id: user.uid,
                email: user.email || ""
              }
            }
          },
          error: null
        };
      }
      return { data: { session: null }, error: null };
    },
    onAuthStateChange(callback: (event: string, session: any) => void) {
      const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
        if (user) {
          callback("SIGNED_IN", {
            user: {
              id: user.uid,
              email: user.email || ""
            }
          });
        } else {
          callback("SIGNED_OUT", null);
        }
      });
      return {
        data: {
          subscription: {
            unsubscribe() {
              unsubscribe();
            }
          }
        }
      };
    },
    async signUp({ email, password }: any) {
      try {
        const userCredential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
        return {
          data: {
            user: {
              id: userCredential.user.uid,
              email: userCredential.user.email || ""
            },
            session: {}
          },
          error: null
        };
      } catch (error: any) {
        return { data: { user: null, session: null }, error };
      }
    },
    async signInWithPassword({ email, password }: any) {
      try {
        const userCredential = await signInWithEmailAndPassword(firebaseAuth, email, password);
        return {
          data: {
            user: {
              id: userCredential.user.uid,
              email: userCredential.user.email || ""
            }
          },
          error: null
        };
      } catch (error: any) {
        return { data: { user: null }, error };
      }
    },
    async signInWithOAuth({ provider }: any) {
      try {
        if (provider === "google") {
          const result = await signInWithPopup(firebaseAuth, googleProvider);
          return {
            data: {
              session: {
                user: {
                  id: result.user.uid,
                  email: result.user.email || ""
                }
              }
            },
            error: null
          };
        }
        throw new Error("Provider not supported");
      } catch (error: any) {
        return { data: null, error };
      }
    },
    async signInWithOtp({ email }: any) {
      try {
        const actionCodeSettings = {
          url: window.location.origin,
          handleCodeInApp: true,
        };
        await sendSignInLinkToEmail(firebaseAuth, email, actionCodeSettings);
        return { data: {}, error: null };
      } catch (error: any) {
        return { data: null, error };
      }
    },
    async signOut() {
      try {
        await firebaseSignOut(firebaseAuth);
        return { error: null };
      } catch (error: any) {
        return { error };
      }
    }
  }
};

// Re-export all the Firestore database operations, maintaining exact signatures
export const fetchUserRostro = firebaseDb.fetchUserRostro;
export const saveUserRostro = firebaseDb.saveUserRostro;
export const deleteUserRostro = firebaseDb.deleteUserRostro;
export const fetchUserPrendas = firebaseDb.fetchUserPrendas;
export const saveUserPrenda = firebaseDb.saveUserPrenda;
export const updateUserPrenda = firebaseDb.updateUserPrenda;
export const deleteUserPrenda = firebaseDb.deleteUserPrenda;
export const fetchUserHistorial = firebaseDb.fetchUserHistorial;
export const saveUserHistorialItem = firebaseDb.saveUserHistorialItem;
export const saveMultipleUserHistorialItems = firebaseDb.saveMultipleUserHistorialItems;
export const updateUserHistorialItemImage = firebaseDb.updateUserHistorialItemImage;
export const toggleUserHistorialItemFavorito = firebaseDb.toggleUserHistorialItemFavorito;
export const deleteUserHistorialItem = firebaseDb.deleteUserHistorialItem;
export const resetUserAllData = firebaseDb.resetUserAllData;

// Base64 storage helper, storing small images inline for reliable rendering within simulator iframe
export async function uploadBase64ToStorage(
  userId: string,
  base64Data: string,
  bucketName: string = "prendas_armario"
): Promise<string> {
  return base64Data;
}
