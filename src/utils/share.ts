import { Prenda } from "../types";

export const getShareCodeFromEmail = (email?: string): string => {
  if (!email) return "INVITADO-1001";
  if (email.toLowerCase() === "diego.delacalleb@gmail.com") return "DIEGO-4739";
  
  const cleanEmail = email.toLowerCase().trim();
  const namePart = cleanEmail.split("@")[0].toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6) || "USER";
  
  let hash = 0;
  for (let i = 0; i < cleanEmail.length; i++) {
    hash = cleanEmail.charCodeAt(i) + ((hash << 5) - hash);
  }
  const numericPart = Math.abs(hash % 9000) + 1000;
  return `${namePart}-${numericPart}`;
};

export interface SharedWardrobe {
  code: string;
  userName: string;
  userEmail: string;
  userId: string;
  prendas: Prenda[];
  updatedAt: string;
}

export function publishWardrobeToRegistry(
  email: string,
  userId: string,
  prendas: Prenda[]
) {
  try {
    const code = getShareCodeFromEmail(email);
    const registryStr = localStorage.getItem("espejo_shared_wardrobes") || "{}";
    const registry = JSON.parse(registryStr);
    
    const namePrefix = email.split("@")[0];
    const dispName = namePrefix.charAt(0).toUpperCase() + namePrefix.slice(1).split(".")[0];
    
    registry[code] = {
      code,
      userName: dispName,
      userEmail: email,
      userId,
      prendas,
      updatedAt: new Date().toISOString()
    };
    
    localStorage.setItem("espejo_shared_wardrobes", JSON.stringify(registry));
  } catch (err) {
    console.error("Failed to publish wardrobe to registry:", err);
  }
}

export function getWardrobeFromRegistry(code: string): SharedWardrobe | null {
  try {
    const registryStr = localStorage.getItem("espejo_shared_wardrobes") || "{}";
    const registry = JSON.parse(registryStr);
    const upperCode = code.trim().toUpperCase();
    return registry[upperCode] || null;
  } catch (err) {
    console.error("Failed to retrieve wardrobe from registry:", err);
    return null;
  }
}
