'use client'

import { useState, useRef, useEffect } from 'react'
import { Upload, FileText, CheckCircle, XCircle, AlertCircle, Download } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { logger } from '@/lib/logger'
import toast from 'react-hot-toast'

/**
 * Composant d'administration pour gérer les tickets
 * Permet d'importer des tickets depuis un fichier CSV généré par Mikhmon
 */
export default function TicketManagement() {
  const [uploading, setUploading] = useState(false)
  const [importResult, setImportResult] = useState<{
    imported: number
    failed: number
    errors: string[]
  } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    logger.log('TicketManagement: montage du composant')
  }, [])

  const processFile = async (file: File) => {
    logger.log('TicketManagement: fichier reçu', { name: file.name, size: file.size })
    if (!file.name.endsWith('.csv')) {
      logger.warn('TicketManagement: fichier non CSV', { name: file.name })
      toast.error('Veuillez sélectionner un fichier CSV')
      return
    }
    setUploading(true)
    setImportResult(null)
    logger.info('TicketManagement: import CSV en cours', { name: file.name })
    try {
      const result = await apiClient.admin.tickets.import(file)
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
      processFile(file)
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
      processFile(file)
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gestion des Tickets</h2>
          <p className="text-gray-600 mt-1">
            Importez des tickets pré-générés depuis Mikhmon
          </p>
        </div>
      </div>

      {/* Zone d'upload */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Importer des tickets depuis CSV
        </h3>

        <div
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            uploading
              ? 'border-primary-500 bg-primary-50'
              : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
          }`}
        >
          {uploading ? (
            <div>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Importation en cours...</p>
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

        {/* Instructions */}
        <div className="mt-6 bg-blue-50 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-semibold mb-1">Instructions :</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Exportez vos tickets depuis Mikhmon au format CSV</li>
                <li>Le fichier doit contenir les colonnes : Username, Password, Profile, Time Limit, Data Limit, Comment</li>
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
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Résultats de l'importation
          </h3>

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
