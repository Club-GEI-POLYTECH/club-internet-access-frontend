'use client'

import { useState, useRef, useEffect } from 'react'
import { Upload, FileText, CheckCircle, XCircle, AlertCircle, Download } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { logger } from '@/lib/logger'
import toast from 'react-hot-toast'
import type { TicketType } from '@/types/api'

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

  const getDurationKey = (timeLimit?: string) => {
    const tl = (timeLimit || '').toLowerCase()
    if (tl.includes('30')) return '30d'
    if (tl.includes('7')) return '7d'
    return '24h'
  }

  const expectedDurations: Array<{ key: '24h' | '7d' | '30d'; label: string }> = [
    { key: '24h', label: '24 heures' },
    { key: '7d', label: '7 jours' },
    { key: '30d', label: '30 jours' },
  ]

  const selectedType = ticketTypes.find((t) => t.id === selectedTypeId) ?? null

  useEffect(() => {
    logger.log('TicketManagement: montage du composant')
    const loadTypes = async () => {
      try {
        const types = await apiClient.tickets.getTypes()
        const allowed = types.filter((t) => {
          const d = getDurationKey(t.timeLimit)
          return d === '24h' || d === '7d' || d === '30d'
        })
        setTicketTypes(allowed)
        if (allowed.length > 0) {
          setSelectedTypeId(allowed[0].id)
        }
      } catch (error) {
        logger.error('TicketManagement: erreur chargement types', error)
        toast.error('Impossible de charger les types (24h / 7j / 30j)')
      } finally {
        setLoadingTypes(false)
      }
    }
    void loadTypes()
  }, [])

  const analyzeFile = async (file: File) => {
    if (!selectedType) {
      toast.error('Choisissez le type d’import (24h / 7j / 30j) avant de charger le CSV')
      return
    }
    logger.info('TicketManagement: analyse CSV (recommandations)', { name: file.name })
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

      const result = await apiClient.admin.tickets.importRecommendations(file) as any
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
      toast.success('Prévisualisation terminée. Vérifiez puis lancez l’import.')
    } catch (error: any) {
      logger.error('TicketManagement: erreur analyse import', error)
      toast.error(error.message || "Erreur lors de l'analyse du fichier")
      setSelectedFile(null)
    } finally {
      setAnalyzing(false)
    }
  }

  const processFile = async () => {
    if (!selectedFile) {
      toast.error('Sélectionnez d’abord un fichier CSV')
      return
    }
    if (!selectedType) {
      toast.error('Choisissez le type d’import (24h / 7j / 30j)')
      return
    }
    logger.log('TicketManagement: fichier reçu', { name: selectedFile.name, size: selectedFile.size })
    setUploading(true)
    setImportResult(null)
    logger.info('TicketManagement: import CSV en cours', { name: selectedFile.name })
    try {
      const result = await apiClient.admin.tickets.import(selectedFile)
      setImportResult(result)
      logger.info('TicketManagement: import terminé', result)
      if (result.imported > 0) {
        toast.success(`${result.imported} ticket(s) importé(s) avec succès!`)
      }
      if (result.failed > 0) {
        toast.error(`${result.failed} ticket(s) n'ont pas pu être importé(s)`)
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      setSelectedFile(null)
      setRecommendations(null)
    } catch (error: any) {
      logger.error('TicketManagement: erreur import', error)
      toast.error(error.message || 'Erreur lors de l\'importation du fichier')
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
        toast.error('Veuillez sélectionner un fichier CSV')
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
      toast.error('Veuillez déposer un fichier CSV')
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

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary-600">Administration</p>
        <h2 className="font-display mt-1 text-3xl font-bold tracking-tight text-ink-900">Import des tickets</h2>
        <p className="mt-2 max-w-2xl text-ink-600">
          Importez des tickets pré-générés depuis votre fichier CSV (aucune création de codes dans cette application).
        </p>
      </div>

      {/* Zone d'upload */}
      <div className="card">
        <h3 className="font-display text-lg font-bold text-ink-900 mb-1">Fichier CSV</h3>
        <p className="mb-6 text-sm text-ink-500">Glissez-déposez ou sélectionnez votre export.</p>

        <div className="mb-6 rounded-2xl border border-ink-200 bg-ink-50/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-600">Type d&apos;import *</p>
          <p className="mt-1 text-sm text-ink-500">Choisissez le forfait cible avant l’analyse/import du CSV.</p>

          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {expectedDurations.map((duration) => {
              const type = ticketTypes.find((t) => getDurationKey(t.timeLimit) === duration.key)
              const checked = selectedTypeId === type?.id
              return (
                <label
                  key={duration.key}
                  className={`rounded-xl border p-3 transition-all ${
                    checked ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-200' : 'border-ink-200 bg-white'
                  } ${type ? 'cursor-pointer' : 'opacity-70'}`}
                >
                  <input
                    type="radio"
                    name="import-type"
                    className="sr-only"
                    disabled={!type || loadingTypes || uploading || analyzing}
                    checked={checked}
                    onChange={() => {
                      if (type) setSelectedTypeId(type.id)
                    }}
                  />
                  <p className="text-sm font-bold text-ink-900">{duration.label}</p>
                  <p className="text-xs text-ink-600">
                    {type
                      ? `${new Intl.NumberFormat('fr-FR').format(type.price)} CDF`
                      : 'Prix non disponible (type absent en base)'}
                  </p>
                  <p className="mt-1 text-[11px] text-ink-500">{type ? `Type DB: ${type.name}` : 'Type non trouvé en base'}</p>
                </label>
              )
            })}
          </div>
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
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
              <p className="text-gray-600">{analyzing ? 'Analyse du CSV...' : 'Importation en cours...'}</p>
            </div>
          ) : (
            <>
              <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">
                Glissez-déposez votre fichier CSV ici ou cliquez pour sélectionner
              </p>
              <p className="text-sm text-gray-500 mb-4">
                Format attendu : Username,Password,Profile,Time Limit,Data Limit,Comment
              </p>
              <div className="flex gap-3 justify-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="csv-upload"
                />
                <label
                  htmlFor="csv-upload"
                  className="btn btn-primary cursor-pointer"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Sélectionner un fichier CSV
                </label>
                <button
                  onClick={downloadTemplate}
                  className="btn btn-secondary"
                >
                  <Download className="h-4 w-4 mr-2" />
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
              Type choisi: <span className="font-medium">{selectedType?.name || '—'}</span>
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
                <p className="text-xl font-bold text-red-600">{recommendations.invalidLines ?? '-'}</p>
              </div>
            </div>

            {localPreviewStats && (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Vérification locale du fichier : {localPreviewStats.dataLines} ligne(s) de données détectée(s)
                ({localPreviewStats.totalLines} ligne(s) au total avec en-tête).
              </div>
            )}

            {localPreviewStats && recommendations.validLines === 0 && localPreviewStats.dataLines > 0 && (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                Le backend de prévisualisation retourne 0 ligne valide alors que le fichier contient des lignes.
                Vérifiez la route `POST /api/tickets/admin/import/recommendations` (parse CSV / mapping des colonnes).
              </div>
            )}

            <div className="mt-4 space-y-2">
              {recommendations.recommendations?.map((rec) => (
                <div key={rec.durationKey} className="rounded-xl border border-white/70 bg-white p-3 text-sm">
                  <p className="font-semibold text-ink-900">{rec.label} — {rec.count} ticket(s)</p>
                  <p className="text-ink-600">
                    Prix recommandé: {new Intl.NumberFormat('fr-FR').format(rec.recommendedPrice)} CDF · Action: {rec.action === 'create_new' ? 'création du type' : 'type existant'}
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

        {/* Instructions */}
        <div className="mt-8 rounded-2xl border border-primary-100 bg-gradient-to-br from-primary-50/90 to-cyan-50/40 p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-primary-600" />
            <div className="text-sm text-primary-950/90">
              <p className="font-semibold text-primary-900">Instructions</p>
              <ul className="mt-2 list-disc list-inside space-y-1.5">
                <li>Utilisez un export CSV de votre outil de gestion des accès (colonnes attendues ci-dessous)</li>
                <li>Le fichier doit contenir les colonnes : Username, Password, Profile, Time Limit, Data Limit, Comment</li>
                <li>Sélectionnez d’abord le type d’import (24h, 7j ou 30j) dans le formulaire</li>
                <li>Une prévisualisation est faite avant import (recommandations par type)</li>
                <li>Les champs Time Limit et Data Limit peuvent être vides (illimité)</li>
                <li>Les tickets importés seront automatiquement disponibles à la vente</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Résultats de l'importation */}
      {importResult && (
        <div className="card">
          <h3 className="font-display text-lg font-bold text-ink-900 mb-4">Résultats de l&apos;importation</h3>

          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-green-600">{importResult.imported}</p>
              <p className="text-sm text-gray-600">Importés</p>
            </div>

            <div className="bg-red-50 rounded-lg p-4 text-center">
              <XCircle className="h-8 w-8 text-red-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-red-600">{importResult.failed}</p>
              <p className="text-sm text-gray-600">Échoués</p>
            </div>

            <div className="bg-blue-50 rounded-lg p-4 text-center">
              <FileText className="h-8 w-8 text-blue-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-blue-600">{importResult.errors.length}</p>
              <p className="text-sm text-gray-600">Erreurs</p>
            </div>
          </div>

          {importResult.errors.length > 0 && (
            <div className="bg-red-50 rounded-lg p-4">
              <p className="font-semibold text-red-900 mb-2">Détails des erreurs :</p>
              <ul className="list-disc list-inside text-sm text-red-800 space-y-1">
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
