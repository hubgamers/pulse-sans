"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { AlertCircle, Check, Image as ImageIcon, Loader2, RotateCcw, Upload, X } from "lucide-react";
import * as XLSX from "xlsx";
import { bulkCreateTeamsWithPlayers, type BulkImportState, type BulkImportTeamData } from "@/lib/actions/team/team.actions";
import { Badge, Button, Card, Field, Label, Select, StatusAlert } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

type ParsedData = {
  teamColumns: {
    name?: string;
    slug?: string;
    logoUrl?: string;
  };
  playerColumns: {
    nickname?: string;
    number?: string;
    role?: string;
  };
  rows: Record<string, string | number>[];
  availableColumns: string[];
};

type Props = {
  organizationId: string;
};

type LogoAssignment = {
  id: string;
  file: File;
  teamName: string;
};

type ColumnCardProps = {
  label: string;
  description: string;
  value?: string;
  required?: boolean;
  columns: string[];
  emptyLabel?: string;
  onChange: (value: string | undefined) => void;
};

function normalizeColumnName(column: string) {
  return column.toLowerCase();
}

function normalizeTeamIdentifier(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function ColumnCard({ label, description, value, required, columns, emptyLabel = "-- Aucun --", onChange }: ColumnCardProps) {
  return (
    <Card className="bg-slate-50 p-4 shadow-none">
      <Field>
        <Label>
          {label} {required && <span className="text-red-600">*</span>}
        </Label>
        <p className="text-xs text-slate-500">{description}</p>
        <Select value={value || ""} onChange={(event) => onChange(event.target.value || undefined)} className="bg-white">
          <option value="">{emptyLabel}</option>
          {columns.map((column) => (
            <option key={column} value={column}>
              {column}
            </option>
          ))}
        </Select>
      </Field>
    </Card>
  );
}

export default function TeamBulkImporter({ organizationId }: Props) {
  const [step, setStep] = useState<"upload" | "configure" | "preview">("upload");
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<BulkImportState | null>(null);
  const [localError, setLocalError] = useState("");
  const [logoAssignments, setLogoAssignments] = useState<LogoAssignment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLocalError("");
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      try {
        const data = readerEvent.target?.result;
        const workbook = XLSX.read(data, { type: "array" });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(worksheet);

        if (rows.length === 0) {
          setLocalError("Fichier vide ou format invalide.");
          return;
        }

        const availableColumns = Object.keys(rows[0] || {});

        setParsedData({
          teamColumns: {
            name: availableColumns.find((col) => {
              const name = normalizeColumnName(col);
              return name.includes("equipe") || name.includes("team") || name.includes("societe");
            }),
            slug: availableColumns.find((col) => normalizeColumnName(col).includes("slug")),
            logoUrl: availableColumns.find((col) => normalizeColumnName(col).includes("logo")),
          },
          playerColumns: {
            nickname: availableColumns.find((col) => {
              const name = normalizeColumnName(col);
              return name.includes("joueur") || name.includes("player") || name.includes("nom") || name.includes("prenom") || name.includes("name");
            }),
            number: availableColumns.find((col) => {
              const name = normalizeColumnName(col);
              return name.includes("numero") || name.includes("number") || name.includes("#");
            }),
            role: availableColumns.find((col) => normalizeColumnName(col).includes("role")),
          },
          rows,
          availableColumns,
        });
        setStep("configure");
      } catch (error) {
        setLocalError("Erreur lors de la lecture du fichier: " + (error instanceof Error ? error.message : "Erreur inconnue"));
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleConfigChange = (field: string, value: string | undefined) => {
    if (!parsedData) return;

    if (field.startsWith("teamColumns.")) {
      const columnName = field.split(".")[1];
      setParsedData({
        ...parsedData,
        teamColumns: { ...parsedData.teamColumns, [columnName]: value },
      });
      return;
    }

    if (field.startsWith("playerColumns.")) {
      const columnName = field.split(".")[1];
      setParsedData({
        ...parsedData,
        playerColumns: { ...parsedData.playerColumns, [columnName]: value },
      });
    }
  };

  const generatePreview = (): BulkImportTeamData[] => {
    if (!parsedData || !parsedData.teamColumns.name) return [];

    const teamsMap = new Map<string, BulkImportTeamData>();

    for (const row of parsedData.rows) {
      const teamName = String(row[parsedData.teamColumns.name] || "").trim();
      if (!teamName) continue;

      if (!teamsMap.has(teamName)) {
        teamsMap.set(teamName, {
          teamName,
          teamSlug: parsedData.teamColumns.slug ? String(row[parsedData.teamColumns.slug] || "").trim() || undefined : undefined,
          teamLogoUrl: parsedData.teamColumns.logoUrl ? String(row[parsedData.teamColumns.logoUrl] || "").trim() || undefined : undefined,
          players: [],
        });
      }

      const team = teamsMap.get(teamName);
      const nickname = parsedData.playerColumns.nickname ? String(row[parsedData.playerColumns.nickname] || "").trim() : "";

      if (team && nickname) {
        team.players.push({
          nickname,
          number: parsedData.playerColumns.number ? parseInt(String(row[parsedData.playerColumns.number])) || undefined : undefined,
          role: parsedData.playerColumns.role ? String(row[parsedData.playerColumns.role] || "").trim() || undefined : undefined,
        });
      }
    }

    return Array.from(teamsMap.values());
  };

  const handleLogoSelection = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;

    const allowedTypes = ["image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/gif"];
    const validFiles = files.filter((file) => allowedTypes.includes(file.type) && file.size <= 2 * 1024 * 1024);
    const invalidCount = files.length - validFiles.length;
    const teams = generatePreview();

    setLogoAssignments((current) => [
      ...current,
      ...validFiles.map((file) => {
        const fileIdentifier = normalizeTeamIdentifier(file.name);
        const matchingTeam = teams.find(
          (team) => normalizeTeamIdentifier(team.teamName) === fileIdentifier || normalizeTeamIdentifier(team.teamSlug ?? "") === fileIdentifier,
        );
        return { id: crypto.randomUUID(), file, teamName: matchingTeam?.teamName ?? "" };
      }),
    ]);
    setLocalError(invalidCount > 0 ? `${invalidCount} fichier(s) ignore(s): formats image acceptes, 2 Mo maximum par fichier.` : "");
  };

  const handleImport = async () => {
    const importData = generatePreview();
    if (importData.length === 0) {
      setLocalError("Aucune donnee valide a importer.");
      return;
    }

    setIsLoading(true);
    setLocalError("");
    try {
      const supabase = createClient();
      const assignedLogoUrls = new Map<string, string>();
      const assignmentsToUpload = logoAssignments.filter((assignment) => assignment.teamName);

      await Promise.all(
        assignmentsToUpload.map(async ({ file, teamName }) => {
          const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "img";
          const path = `teams/${organizationId}/${crypto.randomUUID()}.${extension}`;
          const { error } = await supabase.storage.from("logos").upload(path, file, { contentType: file.type });
          if (error) throw new Error(`Erreur pour ${file.name}: ${error.message}`);

          const { data } = supabase.storage.from("logos").getPublicUrl(path);
          assignedLogoUrls.set(teamName, data.publicUrl);
        }),
      );

      const teamsWithLogos = importData.map((team) => ({
        ...team,
        teamLogoUrl: assignedLogoUrls.get(team.teamName) ?? team.teamLogoUrl,
      }));
      const response = await bulkCreateTeamsWithPlayers(organizationId, teamsWithLogos);
      setResult(response);
      setStep("preview");
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Erreur lors de l'import des equipes.");
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setStep("upload");
    setParsedData(null);
    setResult(null);
    setLocalError("");
    setLogoAssignments([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (logoInputRef.current) logoInputRef.current.value = "";
  };

  if (step === "upload") {
    return (
      <div className="space-y-4">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <Upload className="h-5 w-5 text-teal-600" />
            <h2 className="text-lg font-semibold">Importer des equipes</h2>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            Telechargez un fichier Excel avec les colonnes <strong>Equipe</strong> et <strong>Joueur</strong>.
          </p>
          <div className="mt-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              className="block w-full cursor-pointer text-sm text-slate-500 file:mr-4 file:rounded-lg file:border-0 file:bg-teal-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-teal-700 hover:file:bg-teal-100"
            />
            <p className="mt-2 text-xs text-slate-500">Formats supportes: .xlsx, .xls, .csv</p>
          </div>
          {localError && (
            <StatusAlert variant="danger" className="mt-4">
              {localError}
            </StatusAlert>
          )}
        </Card>

        <StatusAlert variant="warning" title="Modele de fichier">
          <div className="mt-2 overflow-x-auto text-xs">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-amber-100">
                  <th className="border border-amber-200 px-3 py-2 text-left font-semibold">Equipe</th>
                  <th className="border border-amber-200 px-3 py-2 text-left font-semibold">Joueur</th>
                </tr>
              </thead>
              <tbody className="text-amber-900">
                <tr>
                  <td className="border border-amber-200 px-3 py-2">Alpha</td>
                  <td className="border border-amber-200 px-3 py-2">Jean Dupont</td>
                </tr>
                <tr>
                  <td className="border border-amber-200 px-3 py-2">Beta</td>
                  <td className="border border-amber-200 px-3 py-2">Paul Jacques</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs">Groupez les lignes par equipe pour rattacher plusieurs joueurs a la meme equipe.</p>
        </StatusAlert>
      </div>
    );
  }

  if (step === "configure" && parsedData) {
    const preview = generatePreview();

    return (
      <div className="space-y-6">
        <Card className="p-6">
          <h2 className="mb-2 text-lg font-semibold">Configurer les colonnes</h2>
          <p className="mb-6 text-sm text-slate-600">Mappez les colonnes de votre fichier vers les proprietes HubGamers.</p>

          <div className="space-y-6">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <Badge>Team</Badge>
                <h3 className="text-sm font-semibold text-slate-900">Proprietes de l&apos;equipe</h3>
              </div>
              <div className="grid gap-4 lg:grid-cols-3">
                <ColumnCard
                  label="Nom d'equipe"
                  description="Obligatoire - groupe les joueurs."
                  required
                  value={parsedData.teamColumns.name}
                  columns={parsedData.availableColumns}
                  emptyLabel="-- Selectionner --"
                  onChange={(value) => handleConfigChange("teamColumns.name", value)}
                />
                <ColumnCard
                  label="Slug d'equipe"
                  description="Optionnel - genere sinon."
                  value={parsedData.teamColumns.slug}
                  columns={parsedData.availableColumns}
                  onChange={(value) => handleConfigChange("teamColumns.slug", value)}
                />
                <ColumnCard
                  label="Logo d'equipe"
                  description="Optionnel - URL du logo."
                  value={parsedData.teamColumns.logoUrl}
                  columns={parsedData.availableColumns}
                  onChange={(value) => handleConfigChange("teamColumns.logoUrl", value)}
                />
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center gap-2">
                <Badge variant="success">Player</Badge>
                <h3 className="text-sm font-semibold text-slate-900">Proprietes des joueurs</h3>
              </div>
              <div className="grid gap-4 lg:grid-cols-3">
                <ColumnCard
                  label="Nom du joueur"
                  description="Cree les joueurs sous l'equipe."
                  value={parsedData.playerColumns.nickname}
                  columns={parsedData.availableColumns}
                  onChange={(value) => handleConfigChange("playerColumns.nickname", value)}
                />
                <ColumnCard
                  label="Numero du joueur"
                  description="Numero du maillot."
                  value={parsedData.playerColumns.number}
                  columns={parsedData.availableColumns}
                  onChange={(value) => handleConfigChange("playerColumns.number", value)}
                />
                <ColumnCard
                  label="Role du joueur"
                  description="Position ou poste du joueur."
                  value={parsedData.playerColumns.role}
                  columns={parsedData.availableColumns}
                  onChange={(value) => handleConfigChange("playerColumns.role", value)}
                />
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Logos des equipes</h2>
              <p className="mt-1 text-sm text-slate-600">Ajoutez plusieurs images; les noms de fichiers sont associes automatiquement aux equipes correspondantes.</p>
            </div>
            <Button type="button" variant="secondary" onClick={() => logoInputRef.current?.click()} icon={<ImageIcon className="h-4 w-4" />}>
              Ajouter des logos
            </Button>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
              multiple
              onChange={handleLogoSelection}
              className="hidden"
            />
          </div>

          {logoAssignments.length > 0 && (
            <ul className="mt-4 divide-y divide-slate-200">
              {logoAssignments.map((assignment) => (
                <li key={assignment.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
                  <span className="flex min-w-0 flex-1 items-center gap-2 text-sm text-slate-700">
                    <ImageIcon className="h-4 w-4 flex-shrink-0 text-teal-700" />
                    <span className="truncate">{assignment.file.name}</span>
                  </span>
                  <Select
                    aria-label={`Equipe pour ${assignment.file.name}`}
                    value={assignment.teamName}
                    onChange={(event) =>
                      setLogoAssignments((current) => current.map((item) => (item.id === assignment.id ? { ...item, teamName: event.target.value } : item)))
                    }
                    className="sm:w-64"
                  >
                    <option value="">Ne pas attribuer</option>
                    {preview.map((team) => (
                      <option key={team.teamName} value={team.teamName}>
                        {team.teamName}
                      </option>
                    ))}
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    aria-label={`Retirer ${assignment.file.name}`}
                    onClick={() => setLogoAssignments((current) => current.filter((item) => item.id !== assignment.id))}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-slate-500">PNG, JPEG, WEBP, SVG ou GIF; 2 Mo maximum par logo.</p>
        </Card>

        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold">
            Apercu ({preview.length} equipe{preview.length !== 1 ? "s" : ""})
          </h2>

          <div className="max-h-96 space-y-3 overflow-y-auto">
            {preview.map((team, index) => (
              <div key={`${team.teamName}-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="font-semibold text-slate-900">{team.teamName}</p>
                {team.players.length > 0 && (
                  <div className="mt-2 text-sm text-slate-600">
                    <p className="mb-1 text-xs uppercase text-slate-500">
                      {team.players.length} joueur{team.players.length !== 1 ? "s" : ""}
                    </p>
                    <ul className="space-y-1">
                      {team.players.slice(0, 3).map((player, playerIndex) => (
                        <li key={`${player.nickname}-${playerIndex}`} className="text-xs">
                          - {player.nickname}
                          {player.number && ` (#${player.number})`}
                          {player.role && ` - ${player.role}`}
                        </li>
                      ))}
                      {team.players.length > 3 && (
                        <li className="text-xs text-slate-400">... +{team.players.length - 3} de plus</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>

        {localError && <StatusAlert variant="danger">{localError}</StatusAlert>}

        <div className="flex gap-3">
          <Button variant="secondary" onClick={reset}>
            Annuler
          </Button>
          <Button onClick={handleImport} disabled={isLoading || !parsedData.teamColumns.name}>
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            Importer ({preview.length} equipe{preview.length !== 1 ? "s" : ""})
          </Button>
        </div>
      </div>
    );
  }

  if (step === "preview" && result) {
    return (
      <Card className={result.success ? "border-emerald-300 p-6" : "border-red-300 p-6"}>
        <div className="flex items-start gap-3">
          {result.success ? (
            <Check className="mt-1 h-5 w-5 flex-shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="mt-1 h-5 w-5 flex-shrink-0 text-red-600" />
          )}
          <div className="flex-1">
            <h2 className="mb-2 text-lg font-semibold">{result.success ? "Import reussi" : "Erreurs lors de l'import"}</h2>
            <p className="mb-3 text-sm text-slate-600">{result.message}</p>

            {result.errors && result.errors.length > 0 && (
              <StatusAlert variant="danger" title="Erreurs" className="mb-4">
                <ul className="space-y-1 text-xs">
                  {result.errors.map((error, index) => (
                    <li key={`${error}-${index}`}>- {error}</li>
                  ))}
                </ul>
              </StatusAlert>
            )}

            <div className="space-y-1 text-xs text-slate-500">
              <p>{result.createdTeams ?? 0} equipe(s) creee(s)</p>
              <p>{result.createdPlayers ?? 0} joueur(s) cree(s)</p>
            </div>
          </div>
        </div>

        <Button variant="secondary" onClick={reset} className="mt-4" icon={<RotateCcw className="h-4 w-4" />}>
          Importer un autre fichier
        </Button>
      </Card>
    );
  }

  return null;
}
