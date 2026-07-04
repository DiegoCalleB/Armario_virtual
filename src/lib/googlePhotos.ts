let cachedToken: string | null = null;

export const getGooglePhotosToken = (): string | null => {
  if (!cachedToken) {
    cachedToken = sessionStorage.getItem("google_photos_token");
  }
  return cachedToken;
};

export const signOutGooglePhotos = () => {
  cachedToken = null;
  sessionStorage.removeItem("google_photos_token");
};

export interface GooglePhotoItem {
  id: string;
  baseUrl: string;
  filename: string;
  mimeType: string;
  description?: string;
}

export const fetchGooglePhotos = async (
  nextPageToken?: string,
  categories?: string[]
): Promise<{ items: GooglePhotoItem[]; nextPageToken?: string }> => {
  const token = getGooglePhotosToken();
  if (!token) {
    throw new Error("No autenticado en Google Fotos.");
  }

  const hasCategories = categories && categories.length > 0;
  // Use the search endpoint if filtering by category, otherwise the standard list endpoint
  const url = hasCategories
    ? "https://photoslibrary.googleapis.com/v1/mediaItems:search"
    : `https://photoslibrary.googleapis.com/v1/mediaItems?pageSize=50${nextPageToken ? `&pageToken=${encodeURIComponent(nextPageToken)}` : ""}`;

  const fetchOptions: RequestInit = {
    method: hasCategories ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(hasCategories ? { "Content-Type": "application/json" } : {}),
    },
  };

  if (hasCategories) {
    fetchOptions.body = JSON.stringify({
      pageSize: 50,
      pageToken: nextPageToken,
      filters: {
        contentFilter: {
          includedContentCategories: categories,
        },
      },
    });
  }

  const res = await fetch(url, fetchOptions);

  if (!res.ok) {
    if (res.status === 401) {
      // Token expired
      signOutGooglePhotos();
      throw new Error("La sesión de Google Fotos ha expirado. Por favor, vuelve a conectar.");
    }
    const errText = await res.text();
    throw new Error(`Error de Google Fotos API: ${errText}`);
  }

  const data = await res.json();
  const items = (data.mediaItems || [])
    .filter((item: any) => item.mimeType.startsWith("image/"))
    .map((item: any) => ({
      id: item.id,
      baseUrl: item.baseUrl,
      filename: item.filename,
      mimeType: item.mimeType,
      description: item.description || "",
    }));

  return {
    items,
    nextPageToken: data.nextPageToken,
  };
};
