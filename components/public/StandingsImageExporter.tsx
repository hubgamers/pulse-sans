'use client'

import { useState } from 'react'
import type { StandingRow } from '@/lib/actions/tournament/public.queries'

const SVG_WIDTH = 980
const HEADER_HEIGHT = 100
const ROW_HEIGHT = 42
const FOOTER_PADDING = 24
const LOGO_SIZE = 36
const LEFT_MARGIN = 24

function escapeSvgText(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function computeSvgHeight(rowsCount: number) {
  return HEADER_HEIGHT + rowsCount * ROW_HEIGHT + FOOTER_PADDING
}

function buildStandingsSvg(rows: StandingRow[], title: string, subtitle: string) {
  const height = computeSvgHeight(rows.length)
  const headerY = 44
  const tableStartY = 96

  const rowContent = rows
    .map((row, index) => {
      const y = tableStartY + index * ROW_HEIGHT
      const fill = index % 2 === 0 ? '#ffffff' : '#f8fafc'
      const rankColor = index < 3 ? '#ca8a04' : '#0f172a'
      const logoContent = row.teamLogoUrl
        ? `<image href="${escapeSvgText(row.teamLogoUrl)}" x="${LEFT_MARGIN + 46}" y="${y + 4}" width="${LOGO_SIZE}" height="${LOGO_SIZE}" preserveAspectRatio="xMidYMid slice" />`
        : `<rect x="${LEFT_MARGIN + 46}" y="${y + 4}" width="${LOGO_SIZE}" height="${LOGO_SIZE}" rx="10" fill="#e2e8f0" />
           <text x="${LEFT_MARGIN + 46 + LOGO_SIZE / 2}" y="${y + 28}" font-family="Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="12" font-weight="700" fill="#475569" text-anchor="middle">${escapeSvgText(row.teamName.slice(0, 2).toUpperCase())}</text>`

      return `
        <g>
          <rect x="0" y="${y}" width="${SVG_WIDTH}" height="${ROW_HEIGHT}" fill="${fill}" />
          <text x="${LEFT_MARGIN}" y="${y + 28}" font-family="Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="16" font-weight="700" fill="${rankColor}">${index + 1}</text>
          ${logoContent}
          <text x="${LEFT_MARGIN + 46 + LOGO_SIZE + 16}" y="${y + 28}" font-family="Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="16" fill="#0f172a">${escapeSvgText(row.teamName)}</text>
          <text x="${SVG_WIDTH - 210}" y="${y + 28}" font-family="Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="16" font-weight="700" fill="#0f172a" text-anchor="end">${row.points}</text>
          <text x="${SVG_WIDTH - 140}" y="${y + 28}" font-family="Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="16" fill="#0f172a" text-anchor="end">${row.wins}-${row.draws}-${row.losses}</text>
          <text x="${SVG_WIDTH - 48}" y="${y + 28}" font-family="Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="16" font-weight="700" fill="#0f172a" text-anchor="end">${row.goalDiff >= 0 ? `+${row.goalDiff}` : row.goalDiff}</text>
        </g>`
    })
    .join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${SVG_WIDTH}" height="${height}" viewBox="0 0 ${SVG_WIDTH} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#ffffff" />
  <rect x="16" y="16" width="${SVG_WIDTH - 32}" height="${height - 32}" rx="32" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1" />
  <text x="${SVG_WIDTH / 2}" y="${headerY}" font-family="Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="32" font-weight="800" fill="#0f172a" text-anchor="middle">${escapeSvgText(title)}</text>
  <text x="${SVG_WIDTH / 2}" y="${headerY + 28}" font-family="Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="16" fill="#475569" text-anchor="middle">${escapeSvgText(subtitle)}</text>
  <rect x="${LEFT_MARGIN}" y="${tableStartY - 30}" width="${SVG_WIDTH - LEFT_MARGIN * 2}" height="32" rx="12" fill="#ffffff" opacity="0.9" />
  <text x="${LEFT_MARGIN}" y="${tableStartY - 10}" font-family="Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="14" fill="#64748b">#</text>
  <text x="${LEFT_MARGIN + 90}" y="${tableStartY - 10}" font-family="Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="14" fill="#64748b">Equipe</text>
  <text x="${SVG_WIDTH - 210}" y="${tableStartY - 10}" font-family="Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="14" fill="#64748b" text-anchor="end">Pts</text>
  <text x="${SVG_WIDTH - 140}" y="${tableStartY - 10}" font-family="Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="14" fill="#64748b" text-anchor="end">V-N-D</text>
  <text x="${SVG_WIDTH - 48}" y="${tableStartY - 10}" font-family="Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="14" fill="#64748b" text-anchor="end">Diff</text>
  ${rowContent}
</svg>`
}

function downloadBlob(blob: Blob, filename: string) {
  const anchor = document.createElement('a')
  anchor.href = URL.createObjectURL(blob)
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(anchor.href)
}

export function StandingsImageExporter({
  rows,
  title,
  subtitle,
}: {
  rows: StandingRow[]
  title: string
  subtitle: string
}) {
  const [status, setStatus] = useState<'idle' | 'generating' | 'done' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleDownload() {
    setStatus('generating')
    setErrorMessage(null)

    try {
      const svg = buildStandingsSvg(rows, title, subtitle)
      const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
      const svgUrl = URL.createObjectURL(svgBlob)
      const image = new Image()
      image.crossOrigin = 'anonymous'

      const imageLoaded = new Promise<void>((resolve, reject) => {
        image.onload = () => resolve()
        image.onerror = () => reject(new Error('Impossible de charger le SVG pour la conversion PNG.'))
      })

      image.src = svgUrl
      await imageLoaded

      const canvas = document.createElement('canvas')
      canvas.width = SVG_WIDTH
      canvas.height = computeSvgHeight(rows.length)
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Canvas non disponible')
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(image, 0, 0)

      const pngBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob)
          else reject(new Error('Erreur de génération PNG'))
        }, 'image/png')
      })

      downloadBlob(pngBlob, 'classement-general.png')
      setStatus('done')
      URL.revokeObjectURL(svgUrl)
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message)
      }
      try {
        const svg = buildStandingsSvg(rows, title, subtitle)
        const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
        downloadBlob(svgBlob, 'classement-general.svg')
        setStatus('done')
      } catch {
        setStatus('error')
      }
    }
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <button
        type="button"
        onClick={handleDownload}
        disabled={status === 'generating'}
        className="inline-flex items-center justify-center rounded-full bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-400"
      >
        {status === 'generating' ? 'Génération en cours…' : 'Télécharger le classement'}
      </button>
      <p className="text-xs text-slate-500">
        L’image est générée en PNG. Si la conversion échoue à cause d’un logo distant, un SVG sera téléchargé.
      </p>
      {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}
    </div>
  )
}
