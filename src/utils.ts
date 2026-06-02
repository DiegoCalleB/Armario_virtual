/**
 * Resizes an image base64 data string to a maximum dimension of maxDimension (768px)
 * using HTML Canvas in client side.
 */
export function resizeImage(base64Str: string, maxDimension = 768): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxDimension) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        }
      } else {
        if (height > maxDimension) {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(base64Str);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = (err) => {
      reject(new Error("No se pudo cargar la imagen para su procesamiento."));
    };
  });
}

/**
 * Utility to convert loaded File object into browser Base64 string
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
}

/**
 * Returns typical styling colors based on categories to back up color presentation
 */
export function getCategoryLabel(category: string): string {
  switch (category) {
    case "top":
      return "Parte Superior";
    case "pantalon":
      return "Parte Inferior";
    case "calzado":
      return "Calzado";
    case "accesorio":
      return "Accesorio";
    default:
      return category;
  }
}
