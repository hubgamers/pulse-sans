"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import Image from "next/image";
import { ImagePlus, Loader2, X } from "lucide-react";
import { Button, Field, FieldError, Label } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

type LogoAsset = {
  name: string;
  url: string;
};

type Props = {
  organizationId: string;
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
};

const allowedTypes = ["image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/gif"];
const imageExtensions = /\.(png|jpe?g|webp|svg|gif)$/i;

async function fetchLogoAssets(organizationId: string) {
  const supabase = createClient();
  const { data, error } = await supabase.storage.from("logos").list(`teams/${organizationId}`, {
    limit: 100,
    sortBy: { column: "name", order: "desc" },
  });

  if (error) throw error;

  return (data ?? [])
    .filter((asset) => asset.id && imageExtensions.test(asset.name))
    .map((asset) => ({
      name: asset.name,
      url: supabase.storage.from("logos").getPublicUrl(`teams/${organizationId}/${asset.name}`).data.publicUrl,
    }));
}

export default function TeamLogoPicker({ organizationId, value, onChange, disabled = false }: Props) {
  const [assets, setAssets] = useState<LogoAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError("");
    void fetchLogoAssets(organizationId)
      .then((loadedAssets) => {
        if (!cancelled) setAssets(loadedAssets);
      })
      .catch(() => {
        if (!cancelled) setError("Impossible de charger la bibliotheque de logos.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!allowedTypes.includes(file.type)) {
      setError("Format non supporte. Utilisez PNG, JPEG, WEBP, SVG ou GIF.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Le fichier doit faire moins de 2 Mo.");
      return;
    }

    setError("");
    setUploading(true);
    const supabase = createClient();
    const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "img";
    const path = `teams/${organizationId}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("logos").upload(path, file, { contentType: file.type });

    if (uploadError) {
      setError(
        uploadError.message.toLowerCase().includes("row-level security")
          ? "Upload bloque par la policy Supabase Storage (RLS). Voir la configuration SQL du bucket logos."
          : `Erreur lors de l upload : ${uploadError.message}`,
      );
      setUploading(false);
      return;
    }

    const url = supabase.storage.from("logos").getPublicUrl(path).data.publicUrl;
    onChange(url);
    try {
      setAssets(await fetchLogoAssets(organizationId));
    } catch {
      setError("Image importee, mais impossible de rafraichir la bibliotheque.");
    }
    setUploading(false);
  };

  return (
    <Field>
      <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-400">
        <div>
          <Label>Logo (optionnel)</Label>
          <p className="mt-1 text-xs text-slate-500">Choisissez un logo de l&apos;organisation ou ajoutez une image.</p>
        </div>
        <div className="flex items-center gap-2">
          {value && (
            <Button type="button" variant="ghost" onClick={() => onChange("")} disabled={disabled || uploading} aria-label="Retirer le logo">
              <X className="h-4 w-4" />
            </Button>
          )}
          <Button
            type="button"
            variant="secondary"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || uploading}
            icon={uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          >
            {uploading ? "Import..." : "Importer une image"}
          </Button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
          onChange={handleUpload}
          disabled={disabled || uploading}
          className="hidden"
        />
      </div>

      {value && (
        <div className="mt-3 flex items-center gap-3 rounded-md border border-teal-200 bg-teal-50 p-3">
          <Image src={value} alt="Logo selectionne" width={48} height={48} className="h-12 w-12 rounded object-contain" unoptimized />
          <span className="text-sm font-medium text-slate-700">Logo selectionne</span>
        </div>
      )}

      <div className="mt-4">
        <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Bibliotheque de l&apos;organisation</p>
        {isLoading ? (
          <p className="text-sm text-slate-500">Chargement des images...</p>
        ) : assets.length > 0 ? (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
            {assets.map((asset) => (
              <button
                key={asset.name}
                type="button"
                onClick={() => onChange(asset.url)}
                disabled={disabled || uploading}
                aria-label={`Selectionner le logo ${asset.name}`}
                aria-pressed={value === asset.url}
                className={`flex aspect-square items-center justify-center rounded-md border bg-white p-2 transition hover:border-teal-500 ${
                  value === asset.url ? "border-teal-600 ring-2 ring-teal-600/20" : "border-slate-200"
                }`}
              >
                <Image src={asset.url} alt={asset.name} width={64} height={64} className="h-full w-full object-contain bg-gray-300" unoptimized />
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">Aucune image importee pour cette organisation.</p>
        )}
      </div>

      <p className="mt-2 text-xs text-slate-500">PNG, JPEG, WEBP, SVG ou GIF; 2 Mo maximum.</p>
      {error && <FieldError>{error}</FieldError>}
    </Field>
  );
}
