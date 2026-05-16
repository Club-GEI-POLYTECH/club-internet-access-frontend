'use client'

import { useState, useRef, useEffect } from 'react'
import { Upload, FileText, CheckCircle, XCircle, AlertCircle, Download } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { parseApiDecimal } from '@/lib/normalize-ticket-api'
import { logger } from '@/lib/logger'
import { notify } from '@/lib/notify'
import { toUserErrorMessage } from '@/lib/user-messages'
import type { TicketType } from '@/types/api'
import type { CatalogDurationFallback, ImportTicketsMultipartOptions } from '@/types/frontend-types'

/**
 * Composant d'administration pour gérer les tickets
 * Import de tickets pré-générés depuis un fichier CSV (ex. export hotspot)
 */
export default function TicketManagement() {
  const [uploading, setUploading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [loadingTypes, setLoadingTypes] = useState(true)
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([])
  const [selectedTypeId, setSelectedTypeId] = useState('')
  const [useCatalogFallback, setUseCatalogFallback] = useState(false)
  const [catalogDuration, setCatalogDuration] = useState<CatalogDurationFallback>('24h')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [localPreviewStats, setLocalPreviewStats] = useState<{
    totalLines: number
    dataLines: number
  } | null>(null)
  const [recommendations, setRecommendations] = useState<{
    recommendations: Array<{
      durationKey: string
      label: string
      count: number
      recommendedPrice: number
      action: 'use_existing' | 'create_new' | string
    }>
    totalLines?: number
    validLines?: number
    invalidLines?: number
  } | null>(null)
  const [importResult, setImportResult] = useState<{
    imported: number
    failed: number
    errors: string[]
  } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const catalogDurationLabels: Record<CatalogDurationFallback, string> = {
    '24h': '24 heures (24h)',
    '7j': '7 jours (7j)',
    '30j': '30 jours (30j)',
  }

  const selectedType = ticketTypes.find((t) => t.id === selectedTypeId) ?? null

  const formatCdf = (raw: unknown) => {
    const n = parseApiDecimal(raw)
    return Number.isFinite(n)
      ? new Intl.NumberFormat('fr-FR', {
          style: 'currency',
          currency: 'CDF',
          minimumFractionDigits: 0,
        }).format(n)
      : '—'
  }

  const buildImportOptions = (): ImportTicketsMultipartOptions | null => {
    if (useCatalogFallback) return { catalogDuration }
    if (selectedTypeId) return { ticketTypeId: selectedTypeId }
    return null
  }

  useEffect(() => {
    logger.log('TicketManagement: montage du composant')
    const loadTypes = async () => {
      try {
        const types = await apiClient.tickets.getTypes()
        const active = types.filter((t) => t.isActive !== false)
        setTicketTypes(active)
        if (active.length > 0) {
          setSelectedTypeId((prev) => (prev && active.some((t) => t.id === prev) ? prev : active[0].id))
        }
      } catch (error) {
        logger.error('TicketManagement: erreur chargement types', error)
        notify.error('Types indisponibles', 'Impossible de charger la liste des forfaits. Réessayez plus tard.')
      } finally {
        setLoadingTypes(false)
      }
    }
    void loadTypes()
  }, [])

  const analyzeFile = async (file: File) => {
    const opts = buildImportOptions()
    if (!opts) {
      notify.error(
        useCatalogFallback
          ? 'Choisissez une durée catalogue (24h / 7j / 30j)'
          : 'Choisissez un forfait dans la liste.',
      )
      return
    }
    logger.info('TicketManagement: analyse CSV (recommandations)', { name: file.name, opts })
    setAnalyzing(true)
    setRecommendations(null)
    setLocalPreviewStats(null)
    setImportResult(null)
    try {
      const rawText = await file.text()
      const lines = rawText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
      setLocalPreviewStats({
        totalLines: lines.length,
        dataLines: Math.max(lines.length - 1, 0),
      })

      const result = (await apiClient.admin.tickets.importRecommendations(file, opts)) as any
      const normalized = result?.data ?? result
      const normalizedRecommendations = Array.isArray(normalized?.recommendations)
        ? normalized.recommendations
        : Array.isArray(normalized?.detectedTypes)
          ? normalized.detectedTypes.map((item: any) => ({
              durationKey: String(item.durationKey || item.key || item.duration || ''),
              label: String(item.label || item.name || item.durationLabel || item.durationKey || 'Type'),
              count: Number(item.count ?? item.lines ?? 0),
              recommendedPrice: Number(item.recommendedPrice ?? item.price ?? 0),
              action: String(item.action ?? item.status ?? 'use_existing'),
            }))
          : []

      setRecommendations({
        recommendations: normalizedRecommendations,
        totalLines: Number(normalized?.totalLines ?? normalized?.total ?? normalized?.rowsTotal ?? lines.length) || lines.length,
        validLines: Number(normalized?.validLines ?? normalized?.valid ?? normalized?.rowsValid ?? Math.max(lines.length - 1, 0)) || 0,
        invalidLines: Number(normalized?.invalidLines ?? normalized?.invalid ?? normalized?.rowsInvalid ?? 0) || 0,
      })
      setSelectedFile(file)
      notify.success('Analyse terminée', 'Vérifiez les totaux ci-dessous, puis lancez l’import réel.')
    } catch (error: any) {
      logger.error('TicketManagement: erreur analyse import', error)
      notify.error('Analyse impossible', toUserErrorMessage(error, 'Impossible d’analyser ce fichier. Vérifiez le format et le forfait choisi.'))
      setSelectedFile(null)
    } finally {
      setAnalyzing(false)
    }
  }

  const processFile = async () => {
    if (!selectedFile) {
      notify.error('Sélectionnez d’abord un fichier CSV')
      return
    }
    const opts = buildImportOptions()
    if (!opts) {
      notify.error(
        useCatalogFallback
          ? 'Choisissez une durée catalogue (24h / 7j / 30j)'
          : 'Choisissez un type de ticket dans la liste',
      )
      return
    }
    logger.log('TicketManagement: fichier reçu', { name: selectedFile.name, size: selectedFile.size, opts })
    setUploading(true)
    setImportResult(null)
    logger.info('TicketManagement: import CSV en cours', { name: selectedFile.name })
    try {
      const result = await apiClient.admin.tickets.import(selectedFile, opts)
      setImportResult(result)
      logger.info('TicketManagement: import terminé', result)
      if (result.imported > 0) {
        notify.success(
          'Import réussi',
          `${result.imported} ligne(s) importée(s). Les tickets sont disponibles à la vente.`,
        )
      }
      if (result.failed > 0) {
        notify.error(
          'Import partiel',
          `${result.failed} ligne(s) en échec. Consultez la liste d’erreurs sous le tableau de bord.`,
        )
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      setSelectedFile(null)
      setRecommendations(null)
    } catch (error: any) {
      logger.error('TicketManagement: erreur import', error)
      notify.error('Import interrompu', toUserErrorMessage(error, 'L’import n’a pas pu être finalisé. Réessayez.'))
    } finally {
      setUploading(false)
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      logger.log('TicketManagement: sélection fichier', { name: file.name })
      if (!file.name.endsWith('.csv')) {
        logger.warn('TicketManagement: fichier non CSV', { name: file.name })
        notify.error('Veuillez sélectionner un fichier CSV')
        return
      }
      void analyzeFile(file)
    } else {
      logger.warn('TicketManagement: aucun fichier sélectionné')
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    logger.log('TicketManagement: drag over sur la zone de dépôt')
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const file = e.dataTransfer.files[0]
    if (file && file.name.endsWith('.csv')) {
      logger.log('TicketManagement: drop fichier CSV', { name: file.name })
      void analyzeFile(file)
    } else {
      logger.warn('TicketManagement: drop fichier non CSV')
      notify.error('Veuillez déposer un fichier CSV')
    }
  }

  const downloadTemplate = () => {
    logger.log('TicketManagement: téléchargement template CSV')
    const csvContent = `Username,Password,Profile,Time Limit,Data Limit,Comment
dzpv,3552,TEST,,,2026-01-27 22:52:37
user2,pass2,BASIC,24h,1GB,2026-01-27 22:52:37
user3,pass3,PREMIUM,7d,5GB,2026-01-27 22:52:37`

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', 'template-tickets.csv')
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    logger.info('TicketManagement: template CSV téléchargé')
  }

  const importTargetSummary = useCatalogFallback
    ? `Repli catalogue · ${catalogDurationLabels[catalogDuration]}`
    : selectedType
      ? `${selectedType.name} · ${formatCdf(selectedType.price)}`
      : '—'

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-600">Administration</p>
        <h2 className="font-display mt-1 text-3xl font-bold tracking-tight text-ink-900">Import des tickets</h2>
        <p className="mt-2 max-w-2xl text-ink-600">
          Importez des tickets pré-générés depuis votre fichier CSV. Choisissez d’abord le forfait concerné, puis analysez le
          fichier avant l’import définitif.
        </p>
      </div>

      <div className="card">
        <h3 className="font-display text-lg font-bold text-ink-900 mb-1">Fichier CSV</h3>
        <p className="mb-6 text-sm text-ink-500">Glissez-déposez ou sélectionnez votre export.</p>

        <div className="mb-6 rounded-2xl border border-ink-200 bg-ink-50/60 p-4 space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-600">Cible d&apos;import *</p>
            <p className="mt-1 text-sm text-ink-500">
              Par défaut : choisissez un forfait dans le catalogue. Option avancée : durée standard sans sélection de forfait
              précis.
            </p>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-ink-200 bg-white p-3">
            <input
              type="checkbox"
              className="mt-1"
              checked={useCatalogFallback}
              disabled={loadingTypes || uploading || analyzing}
              onChange={(e) => setUseCatalogFallback(e.target.checked)}
            />
            <span className="text-sm text-ink-800">
              <span className="font-semibold">Durée standard sans forfait précis</span>
              <span className="block text-xs text-ink-500">Utilise une durée catalogue (24 h, 7 j ou 30 j) sans choisir un forfait dans la liste.</span>
            </span>
          </label>

          {useCatalogFallback ? (
            <div>
              <label htmlFor="catalog-duration" className="text-xs font-semibold uppercase tracking-wide text-ink-600">
                Durée catalogue
              </label>
              <select
                id="catalog-duration"
                className="input mt-1 w-full max-w-md"
                value={catalogDuration}
                disabled={loadingTypes || uploading || analyzing}
                onChange={(e) => setCatalogDuration(e.target.value as CatalogDurationFallback)}
              >
                {(Object.keys(catalogDurationLabels) as CatalogDurationFallback[]).map((key) => (
                  <option key={key} value={key}>
                    {catalogDurationLabels[key]}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label htmlFor="import-ticket-type" className="text-xs font-semibold uppercase tracking-wide text-ink-600">
                Type de forfait
              </label>
              {ticketTypes.length === 0 && !loadingTypes ? (
                <p className="mt-2 text-sm text-amber-800">Aucun forfait actif disponible. Créez des forfaits ou contactez le support technique.</p>
              ) : (
                <select
                  id="import-ticket-type"
                  className="input mt-1 w-full font-mono text-sm"
                  value={selectedTypeId}
                  disabled={loadingTypes || uploading || analyzing || ticketTypes.length === 0}
                  onChange={(e) => setSelectedTypeId(e.target.value)}
                >
                  {ticketTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} · {formatCdf(t.price)} · profil {t.profile} · limite {t.timeLimit ?? '—'} · {t.id}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>

        <div
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className={`rounded-2xl border-2 border-dashed p-10 text-center transition-all duration-300 ${
            uploading
              ? 'border-primary-400 bg-primary-50/80'
              : 'border-ink-200 bg-gradient-to-b from-ink-50/80 to-white hover:border-primary-300 hover:bg-primary-50/30'
          }`}
        >
          {uploading || analyzing ? (
            <div>
              <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-primary-600"></div>
              <p className="text-ink-600">{analyzing ? 'Analyse du CSV...' : 'Importation en cours...'}</p>
            </div>
          ) : (
            <>
              <Upload className="mx-auto mb-4 h-12 w-12 text-ink-400" />
              <p className="mb-2 text-ink-600">Glissez-déposez votre fichier CSV ici ou cliquez pour sélectionner</p>
              <p className="mb-4 text-sm text-ink-500">
                Format attendu : Username,Password,Profile,Time Limit,Data Limit,Comment
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileSelect} className="hidden" id="csv-upload" />
                <label htmlFor="csv-upload" className="btn btn-primary cursor-pointer">
                  <FileText className="mr-2 h-4 w-4" />
                  Sélectionner un fichier CSV
                </label>
                <button type="button" onClick={downloadTemplate} className="btn btn-secondary">
                  <Download className="mr-2 h-4 w-4" />
                  Télécharger le modèle
                </button>
              </div>
            </>
          )}
        </div>

        {selectedFile && recommendations && (
          <div className="mt-6 rounded-2xl border border-primary-100 bg-gradient-to-br from-primary-50/80 to-cyan-50/30 p-5">
            <h4 className="font-semibold text-ink-900">Prévisualisation avant import</h4>
            <p className="mt-1 text-sm text-ink-600">
              Fichier: <span className="font-medium">{selectedFile.name}</span>
            </p>
            <p className="mt-1 text-sm text-ink-600">
              Cible: <span className="font-medium break-all">{importTargetSummary}</span>
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-white p-3 text-center">
                <p className="text-xs text-ink-500">Lignes totales</p>
                <p className="text-xl font-bold text-ink-900">{recommendations.totalLines ?? '-'}</p>
              </div>
              <div className="rounded-xl bg-white p-3 text-center">
                <p className="text-xs text-ink-500">Lignes valides</p>
                <p className="text-xl font-bold text-emerald-700">{recommendations.validLines ?? '-'}</p>
              </div>
              <div className="rounded-xl bg-white p-3 text-center">
                <p className="text-xs text-ink-500">Lignes invalides</p>
                <p className="text-xl font-bold text-rose-700">{recommendations.invalidLines ?? '-'}</p>
              </div>
            </div>

            {localPreviewStats && (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Vérification locale du fichier : {localPreviewStats.dataLines} ligne(s) de données détectée(s) (
                {localPreviewStats.totalLines} ligne(s) au total avec en-tête).
              </div>
            )}

            {localPreviewStats && recommendations.validLines === 0 && localPreviewStats.dataLines > 0 && (
              <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">
                L’analyse n’a validé aucune ligne alors que le fichier en contient. Vérifiez le format du CSV, les colonnes
                attendues et le forfait sélectionné.
              </div>
            )}

            <div className="mt-4 space-y-2">
              {recommendations.recommendations?.map((rec) => (
                <div key={rec.durationKey} className="rounded-xl border border-white/70 bg-white p-3 text-sm">
                  <p className="font-semibold text-ink-900">
                    {rec.label} — {rec.count} ticket(s)
                  </p>
                  <p className="text-ink-600">
                    Prix recommandé: {new Intl.NumberFormat('fr-FR').format(rec.recommendedPrice)} CDF · Action:{' '}
                    {rec.action === 'create_new' ? 'création du type' : 'type existant'}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-5 flex justify-end">
              <button type="button" onClick={() => void processFile()} disabled={uploading} className="btn btn-primary">
                Lancer l&apos;import réel
              </button>
            </div>
          </div>
        )}

        <div className="mt-8 rounded-2xl border border-primary-100 bg-gradient-to-br from-primary-50/90 to-cyan-50/40 p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-primary-600" />
            <div className="text-sm text-primary-950/90">
              <p className="font-semibold text-primary-900">Comment importer</p>
              <ul className="mt-2 list-inside list-disc space-y-1.5">
                <li>Choisissez le forfait cible (ou une durée standard en option avancée).</li>
                <li>Préparez un fichier CSV avec les colonnes : Username, Password, Profile, Time Limit, Data Limit, Comment.</li>
                <li>Analysez le fichier pour vérifier les totaux avant l’import définitif.</li>
                <li>Les colonnes Time Limit et Data Limit peuvent rester vides si besoin.</li>
                <li>Lancez l’import réel une fois la prévisualisation validée.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {importResult && (
        <div className="card">
          <h3 className="font-display mb-4 text-lg font-bold text-ink-900">Résultats de l&apos;importation</h3>

          <div className="mb-4 grid grid-cols-3 gap-4">
            <div className="rounded-lg bg-emerald-50 p-4 text-center">
              <CheckCircle className="mx-auto mb-2 h-8 w-8 text-emerald-700" />
              <p className="text-2xl font-bold text-emerald-800">{importResult.imported}</p>
              <p className="text-sm text-ink-600">Importés</p>
            </div>

            <div className="rounded-lg bg-rose-50 p-4 text-center">
              <XCircle className="mx-auto mb-2 h-8 w-8 text-rose-700" />
              <p className="text-2xl font-bold text-rose-800">{importResult.failed}</p>
              <p className="text-sm text-ink-600">Échoués</p>
            </div>

            <div className="rounded-lg bg-primary-50 p-4 text-center">
              <FileText className="mx-auto mb-2 h-8 w-8 text-primary-700" />
              <p className="text-2xl font-bold text-primary-800">{importResult.errors.length}</p>
              <p className="text-sm text-ink-600">Erreurs</p>
            </div>
          </div>

          {importResult.errors.length > 0 && (
            <div className="rounded-lg bg-rose-50 p-4">
              <p className="mb-2 font-semibold text-rose-950">Détails des erreurs :</p>
              <ul className="list-inside list-disc space-y-1 text-sm text-rose-900">
                {importResult.errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
