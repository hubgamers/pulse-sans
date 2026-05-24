'use client'

import { useMemo, useState, useTransition } from 'react'
import { bulkCreateTournamentMatches } from '@/lib/actions/tournament-management.actions'
import { Badge, Button, Field, Input, Label, Select, StatusAlert, Textarea } from '@/components/ui'

type Props = {
    tournamentId: string
    orgSlug: string
    tournamentSlug: string
    phases: { id: string; name: string }[]
    pitches: { id: string; name: string }[]
    teams: { teamId: string; name: string }[]
}

type ParsedRow = {
    timeStr: string
    pitchName: string
    homeTeamName: string
    awayTeamName: string
    scheduledAt: string | null
    pitchOk: boolean
    homeOk: boolean
    awayOk: boolean
    sameTeam: boolean
    timeFormatOk: boolean
    timeOk: boolean
}

function parseTime(raw: string): { hours: number; minutes: number } | null {
    const s = raw.trim()
    const hMatch = s.match(/^(\d{1,2})[hH](\d{0,2})$/)
    if (hMatch) {
        const hours = parseInt(hMatch[1], 10)
        const minutes = parseInt(hMatch[2] || '0', 10)
        if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
            return { hours, minutes }
        }
    }

    const colonMatch = s.match(/^(\d{1,2}):(\d{2})$/)
    if (colonMatch) {
        const hours = parseInt(colonMatch[1], 10)
        const minutes = parseInt(colonMatch[2], 10)
        if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
            return { hours, minutes }
        }
    }

    return null
}

function buildScheduledAt(timeStr: string, referenceDate: string): string | null {
    if (!referenceDate || !timeStr.trim()) return null
    const time = parseTime(timeStr)
    if (!time) return null
    const base = new Date(referenceDate)
    if (Number.isNaN(base.getTime())) return null
    base.setHours(time.hours, time.minutes, 0, 0)
    return base.toISOString()
}

function resolveTeamName(query: string, teams: { teamId: string; name: string }[]): boolean {
    if (!query.trim()) return true
    const q = query.toLowerCase().trim()
    return teams.some((t) => {
        const n = t.name.toLowerCase().trim()
        return n === q || n.includes(q)
    })
}

function resolvePitchName(query: string, pitches: { id: string; name: string }[]): boolean {
    if (!query.trim()) return false
    const q = query.toLowerCase().trim()
    return pitches.some((p) => {
        const n = p.name.toLowerCase().trim()
        return n === q || n.includes(q)
    })
}

function getRowError(row: ParsedRow) {
    if (!row.timeFormatOk) return 'Horaire invalide'
    if (!row.timeOk) return 'Date de ref. requise'
    if (!row.pitchOk) return 'Piste inconnue'
    if (row.sameTeam) return 'Meme equipe'
    if (!row.homeOk) return 'Domicile inconnu'
    return 'Exterieur inconnu'
}

export default function MatchBulkCreateForm({ tournamentId, orgSlug, tournamentSlug, phases, pitches, teams }: Props) {
    const [phaseId, setPhaseId] = useState(phases[0]?.id ?? '')
    const [referenceDate, setReferenceDate] = useState('')
    const [timesText, setTimesText] = useState('')
    const [pitchesText, setPitchesText] = useState('')
    const [matchupsText, setMatchupsText] = useState('')
    const [maxDuration, setMaxDuration] = useState(30)
    const [teamBreak, setTeamBreak] = useState(10)
    const [result, setResult] = useState<{ success: boolean; message: string; skippedLines?: string[] } | null>(null)
    const [isPending, startTransition] = useTransition()

    const timeLines = timesText.split('\n').map((l) => l.trim())
    const pitchLines = pitchesText.split('\n').map((l) => l.trim())
    const matchupLines = matchupsText.split('\n').map((l) => l.trim())
    const maxLines = Math.max(timeLines.length, pitchLines.length, matchupLines.length)

    const parsedRows = useMemo<ParsedRow[]>(() => {
        const rows: ParsedRow[] = []
        for (let i = 0; i < maxLines; i++) {
            const timeStr = timeLines[i] ?? ''
            const pitchName = pitchLines[i] ?? ''
            const matchup = matchupLines[i] ?? ''

            if (!timeStr && !pitchName && !matchup) continue

            const dashIdx = matchup.indexOf('-')
            const homeTeamName = dashIdx >= 0 ? matchup.slice(0, dashIdx).trim() : matchup.trim()
            const awayTeamName = dashIdx >= 0 ? matchup.slice(dashIdx + 1).trim() : ''
            const scheduledAt = buildScheduledAt(timeStr, referenceDate)
            const timeFormatOk = !timeStr.trim() || parseTime(timeStr) !== null
            const timeOk = !timeStr.trim() || scheduledAt !== null
            const pitchOk = resolvePitchName(pitchName, pitches)
            const homeOk = resolveTeamName(homeTeamName, teams)
            const awayOk = resolveTeamName(awayTeamName, teams)
            const sameTeam =
                !!homeTeamName &&
                !!awayTeamName &&
                homeTeamName.toLowerCase().trim() === awayTeamName.toLowerCase().trim()

            rows.push({
                timeStr,
                pitchName,
                homeTeamName,
                awayTeamName,
                scheduledAt,
                timeFormatOk,
                timeOk,
                pitchOk,
                homeOk,
                awayOk,
                sameTeam,
            })
        }
        return rows
    }, [timeLines, pitchLines, matchupLines, referenceDate, pitches, teams, maxLines])

    const validCount = parsedRows.filter((r) => r.pitchOk && r.homeOk && r.awayOk && !r.sameTeam && r.timeOk).length
    const hasContent = parsedRows.length > 0

    function handleSubmit() {
        if (!phaseId) return
        const matchesJson = JSON.stringify(
            parsedRows
                .filter((r) => r.pitchOk && r.homeOk && r.awayOk && !r.sameTeam && r.timeOk)
                .map((r) => ({
                    scheduledAt: r.scheduledAt,
                    pitchName: r.pitchName,
                    homeTeamName: r.homeTeamName,
                    awayTeamName: r.awayTeamName,
                }))
        )
        const fd = new FormData()
        fd.append('tournamentId', tournamentId)
        fd.append('orgSlug', orgSlug)
        fd.append('tournamentSlug', tournamentSlug)
        fd.append('phaseId', phaseId)
        fd.append('matchesJson', matchesJson)
        fd.append('maxDurationMinutes', String(maxDuration))
        fd.append('teamBreakMinutes', String(teamBreak))
        startTransition(async () => {
            const res = await bulkCreateTournamentMatches(fd)
            setResult({ success: res.success ?? false, message: res.message, skippedLines: res.skippedLines })
        })
    }

    return (
        <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-4">
                <Field>
                    <Label>Phase</Label>
                    <Select value={phaseId} onChange={(e) => setPhaseId(e.target.value)}>
                        {phases.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </Select>
                </Field>
                <Field>
                    <Label>Date de reference</Label>
                    <Input type="date" value={referenceDate} onChange={(e) => setReferenceDate(e.target.value)} />
                </Field>
                <Field>
                    <Label>Duree max (min)</Label>
                    <Input type="number" min={5} max={600} value={maxDuration} onChange={(e) => setMaxDuration(Number(e.target.value))} />
                </Field>
                <Field>
                    <Label>Battement (min)</Label>
                    <Input type="number" min={0} max={240} value={teamBreak} onChange={(e) => setTeamBreak(Number(e.target.value))} />
                </Field>
            </div>

            <StatusAlert title="Format d'import">
                <p>Une entree par ligne, chaque colonne correspond a un match.</p>
                <div className="mt-2 grid grid-cols-3 gap-2 font-mono text-[11px]">
                    <div>
                        <p className="mb-1 text-slate-500">Horaires</p>
                        <p>14h</p><p>14h</p><p>14h10</p><p>14h30</p>
                    </div>
                    <div>
                        <p className="mb-1 text-slate-500">Pistes</p>
                        <p>PISTE 3</p><p>PISTE 3</p><p>PISTE 3</p><p>PISTE 3</p>
                    </div>
                    <div>
                        <p className="mb-1 text-slate-500">Matchups</p>
                        <p>A-B</p><p>C-D</p><p>A-C</p><p>B-D</p>
                    </div>
                </div>
                <p className="mt-2 text-slate-500">Equipes connues : {teams.map((t) => t.name).join(', ') || 'aucune'}</p>
                <p className="text-slate-500">Pistes connues : {pitches.map((p) => p.name).join(', ') || 'aucune'}</p>
            </StatusAlert>

            {!referenceDate && parsedRows.some((r) => r.timeStr.trim()) && (
                <StatusAlert variant="warning">
                    Des horaires sont renseignes mais aucune <strong>date de reference</strong> n&apos;est definie.
                    Choisissez une date ci-dessus pour enregistrer les horaires.
                </StatusAlert>
            )}

            <div className="grid grid-cols-3 gap-2">
                <Field>
                    <Label>Horaires</Label>
                    <Textarea
                        rows={10}
                        value={timesText}
                        onChange={(e) => setTimesText(e.target.value)}
                        placeholder={"14h\n14h\n14h10\n14h30\n14h40\n14h40"}
                        className="font-mono resize-y"
                    />
                </Field>
                <Field>
                    <Label>Pistes</Label>
                    <Textarea
                        rows={10}
                        value={pitchesText}
                        onChange={(e) => setPitchesText(e.target.value)}
                        placeholder={"PISTE 3\nPISTE 3\nPISTE 3\nPISTE 3\nPISTE 3\nPISTE 3"}
                        className="font-mono resize-y"
                    />
                </Field>
                <Field>
                    <Label>Matchups</Label>
                    <Textarea
                        rows={10}
                        value={matchupsText}
                        onChange={(e) => setMatchupsText(e.target.value)}
                        placeholder={"A-B\nC-D\nA-C\nB-D\nA-D\nB-C"}
                        className="font-mono resize-y"
                    />
                </Field>
            </div>

            {hasContent && (
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="border-b border-slate-200 bg-white text-left text-slate-500">
                                <th className="px-3 py-2">#</th>
                                <th className="px-3 py-2">Horaire</th>
                                <th className="px-3 py-2">Piste</th>
                                <th className="px-3 py-2">Domicile</th>
                                <th className="px-3 py-2">Exterieur</th>
                                <th className="px-3 py-2">Statut</th>
                            </tr>
                        </thead>
                        <tbody>
                            {parsedRows.map((row, i) => {
                                const isValid = row.pitchOk && row.homeOk && row.awayOk && !row.sameTeam && row.timeOk
                                return (
                                    <tr key={i} className={`border-b border-slate-200 ${isValid ? '' : 'bg-red-50'}`}>
                                        <td className="px-3 py-1.5 text-slate-500">{i + 1}</td>
                                        <td className={`px-3 py-1.5 font-mono ${row.timeStr && !row.timeOk ? 'text-amber-700' : 'text-slate-800'}`}>
                                            {row.timeStr || <span className="text-slate-500">-</span>}
                                        </td>
                                        <td className={`px-3 py-1.5 font-mono ${!row.pitchOk ? 'text-red-700' : 'text-slate-800'}`}>
                                            {row.pitchName || <span className="text-slate-500">-</span>}
                                        </td>
                                        <td className={`px-3 py-1.5 font-mono ${!row.homeOk ? 'text-red-700' : 'text-slate-800'}`}>
                                            {row.homeTeamName || <span className="text-slate-500">TBD</span>}
                                        </td>
                                        <td className={`px-3 py-1.5 font-mono ${!row.awayOk || row.sameTeam ? 'text-red-700' : 'text-slate-800'}`}>
                                            {row.awayTeamName || <span className="text-slate-500">TBD</span>}
                                        </td>
                                        <td className="px-3 py-1.5">
                                            {isValid ? (
                                                <Badge variant="success">OK</Badge>
                                            ) : (
                                                <Badge variant="danger">{getRowError(row)}</Badge>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {result && (
                <StatusAlert variant={result.success ? 'success' : 'danger'}>
                    <p>{result.message}</p>
                    {result.skippedLines && result.skippedLines.length > 0 && (
                        <ul className="mt-1 space-y-0.5 text-xs opacity-80">
                            {result.skippedLines.map((line, i) => <li key={i}>- {line}</li>)}
                        </ul>
                    )}
                </StatusAlert>
            )}

            <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-slate-500">
                    {hasContent ? `${validCount} match(s) valide(s) sur ${parsedRows.length} ligne(s)` : 'Entrez les donnees ci-dessus pour voir la preview.'}
                </p>
                <Button onClick={handleSubmit} disabled={isPending || validCount === 0 || !phaseId}>
                    {isPending ? 'Creation...' : `Creer ${validCount} match(s)`}
                </Button>
            </div>
        </div>
    )
}
