"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import Image from "next/image";
import { Check, Copy, ExternalLink, ImagePlus, Loader2, Search, Upload } from "lucide-react";
import { Button, Card, EmptyState, Input } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

type MediaAsset = {
  name: string;
  url: string;
  createdAt: string | null;
};

type Props = {
  organizationId: string;
  organizationName: string;
};

const allowedTypes = ["image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/gif"];
const imageExtensions = /\.(png|jpe?g|webp|svg|gif)$/i;

async function fetchOrganizationMedia(organizationId: string): Promise<MediaAsset[]> {
  const supabase = createClient();
  const { data, error } = await supabase.storage.from("logos").list(`teams/${organizationId}`, {
    limit: 1000,
    sortBy: { column: "created_at", order: "desc" },
  });

  if (error) throw error;

  return (data ?? [])
    .filter((asset) => asset.id && imageExtensions.test(asset.name))
    .map((asset) => ({
      name: asset.name,
      url: supabase.storage.from("logos").getPublicUrl(`teams/${organizationId}/${asset.name}`).data.publicUrl,
      createdAt: asset.created_at ?? null,
    }));
}

export default function OrganizationMediaLibrary({ organizationId, organizationName }: Props) {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [copiedUrl, setCopiedUrl] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    void fetchOrganizationMedia(organizationId)
      .then((items) => {
        if (!cancelled) setAssets(items);
      })
      .catch(() => {
        if (!cancelled) setError("Impossible de charger les medias. Verifiez la policy de lecture du bucket logos.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;

    const validFiles = files.filter((file) => allowedTypes.includes(file.type) && file.size <= 2 * 1024 * 1024);
    const skippedFiles = files.length - validFiles.length;
    setError(skippedFiles > 0 ? `${skippedFiles} fichier(s) ignore(s): image requise, 2 Mo maximum par fichier.` : "");
    if (validFiles.length === 0) return;

    setIsUploading(true);
    const supabase = createClient();
    const uploadErrors: string[] = [];

    for (const file of validFiles) {
      const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "img";
      const path = `teams/${organizationId}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from("logos").upload(path, file, { contentType: file.type });
      if (uploadError) uploadErrors.push(`${file.name}: ${uploadError.message}`);
    }

    try {
      setAssets(await fetchOrganizationMedia(organizationId));
    } catch {
      uploadErrors.push("Impossible d actualiser la bibliotheque.");
    }

    setError(uploadErrors.length > 0 ? uploadErrors.join(" ") : skippedFiles > 0 ? `${skippedFiles} fichier(s) ignore(s).` : "");
    setIsUploading(false);
  };

  const copyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      window.setTimeout(() => setCopiedUrl((current) => (current === url ? "" : current)), 1800);
    } catch {
      setError("Impossible de copier le lien depuis ce navigateur.");
    }
  };

  const filteredAssets = assets.filter((asset) => asset.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="space-y-6 text-slate-900">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-500">{organizationName}</p>
          <h1 className="text-2xl font-black md:text-3xl">Medias de l&apos;organisation</h1>
          <p className="mt-2 text-sm text-slate-600">{assets.length} image{assets.length === 1 ? "" : "s"} dans la bibliotheque</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
            multiple
            onChange={handleUpload}
            disabled={isUploading}
            className="hidden"
          />
          <Button onClick={() => inputRef.current?.click()} disabled={isUploading} icon={isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}>
            {isUploading ? "Import en cours..." : "Importer des images"}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-y border-slate-200 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un fichier" className="pl-10" />
        </div>
        <p className="text-xs text-slate-500">PNG, JPEG, WEBP, SVG ou GIF; 2 Mo maximum par image.</p>
      </div>

      {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => <div key={item} className="h-56 animate-pulse rounded-lg bg-slate-100" />)}
        </div>
      ) : filteredAssets.length === 0 ? (
        <EmptyState
          title={query ? "Aucun media ne correspond a cette recherche." : "Aucun media importe pour cette organisation."}
          description={query ? undefined : "Importez des images pour les reutiliser dans les logos des equipes."}
          icon={<ImagePlus size={40} />}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredAssets.map((asset) => (
            <Card key={asset.name} className="overflow-hidden p-0">
              <div className="relative flex h-44 items-center justify-center bg-slate-50 p-4">
                <Image src={asset.url} alt={asset.name} width={320} height={240} className="h-full w-full object-contain bg-gray-400" unoptimized />
              </div>
              <div className="space-y-3 border-t border-slate-200 p-3">
                <div>
                  <p className="truncate text-sm font-semibold" title={asset.name}>{asset.name}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {asset.createdAt ? new Date(asset.createdAt).toLocaleDateString("fr-FR") : "Date inconnue"}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <a href={asset.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-600">
                    Ouvrir <ExternalLink size={13} />
                  </a>
                  <Button type="button" variant="secondary" size="sm" onClick={() => void copyUrl(asset.url)} icon={copiedUrl === asset.url ? <Check size={14} /> : <Copy size={14} />}>
                    {copiedUrl === asset.url ? "Copie" : "Copier le lien"}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
