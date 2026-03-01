'use client'

import { useState } from 'react'
import { FileCode, FileText, Download, Loader2, Send } from 'lucide-react'
import { GlassCard } from '@/components/glass-card'
import { toast } from 'sonner'

interface Props {
  invoice: {
    id: string
    invoice_number: string
    xml_content: string | null
    status: string
  }
  hasApKey: boolean
  peppolStatus: string | null
  onSendPeppol: () => void
  sending: boolean
}

export function DownloadActions({ invoice, hasApKey, peppolStatus, onSendPeppol, sending }: Props) {
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [downloadingBoth, setDownloadingBoth] = useState(false)
  const isValid = invoice.status === 'valid'
  const hasXml = !!invoice.xml_content

  function downloadXml() {
    if (!invoice.xml_content) return
    const blob = new Blob([invoice.xml_content], { type: 'application/xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${invoice.invoice_number}.xml`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function downloadPdf() {
    setDownloadingPdf(true)
    try {
      const res = await fetch(`/api/invoice/pdf?id=${invoice.id}`)
      if (!res.ok) throw new Error('PDF generation failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${invoice.invoice_number}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      toast.error('Chyba pri generovani PDF: ' + (err as Error).message)
    } finally {
      setDownloadingPdf(false)
    }
  }

  async function downloadBoth() {
    setDownloadingBoth(true)
    try {
      // Download XML
      if (invoice.xml_content) {
        const xmlBlob = new Blob([invoice.xml_content], { type: 'application/xml' })
        const xmlUrl = URL.createObjectURL(xmlBlob)
        const xmlA = document.createElement('a')
        xmlA.href = xmlUrl
        xmlA.download = `${invoice.invoice_number}.xml`
        xmlA.click()
        URL.revokeObjectURL(xmlUrl)
      }
      // Small delay between downloads
      await new Promise((r) => setTimeout(r, 300))
      // Download PDF
      const res = await fetch(`/api/invoice/pdf?id=${invoice.id}`)
      if (!res.ok) throw new Error('PDF generation failed')
      const pdfBlob = await res.blob()
      const pdfUrl = URL.createObjectURL(pdfBlob)
      const pdfA = document.createElement('a')
      pdfA.href = pdfUrl
      pdfA.download = `${invoice.invoice_number}.pdf`
      pdfA.click()
      URL.revokeObjectURL(pdfUrl)
    } catch (err) {
      toast.error('Chyba: ' + (err as Error).message)
    } finally {
      setDownloadingBoth(false)
    }
  }

  if (!hasXml) return null

  return (
    <div className="space-y-4">
      {/* Download cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* XML Download */}
        <button
          onClick={downloadXml}
          disabled={!isValid}
          className="group relative overflow-hidden rounded-2xl glass-card p-6 flex flex-col items-center gap-3 transition-all duration-200 hover:scale-[1.02] hover:border-primary/30 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-chart-2/10 flex items-center justify-center group-hover:bg-chart-2/20 transition-colors">
            <FileCode className="w-8 h-8 text-chart-2" />
          </div>
          <div>
            <div className="font-bold text-foreground text-base">UBL XML</div>
            <div className="text-xs text-muted-foreground mt-0.5">Peppol e-faktura</div>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-chart-2">
            <Download className="w-3.5 h-3.5" />
            Stiahnut
          </div>
        </button>

        {/* PDF Download */}
        <button
          onClick={downloadPdf}
          disabled={!isValid || downloadingPdf}
          className="group relative overflow-hidden rounded-2xl glass-card p-6 flex flex-col items-center gap-3 transition-all duration-200 hover:scale-[1.02] hover:border-destructive/30 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center group-hover:bg-destructive/20 transition-colors">
            {downloadingPdf ? (
              <Loader2 className="w-8 h-8 text-destructive animate-spin" />
            ) : (
              <FileText className="w-8 h-8 text-destructive" />
            )}
          </div>
          <div>
            <div className="font-bold text-foreground text-base">PDF</div>
            <div className="text-xs text-muted-foreground mt-0.5">Tlacivy doklad</div>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-destructive">
            <Download className="w-3.5 h-3.5" />
            {downloadingPdf ? 'Generujem...' : 'Stiahnut'}
          </div>
        </button>

        {/* Both Download */}
        <button
          onClick={downloadBoth}
          disabled={!isValid || downloadingBoth}
          className="group relative overflow-hidden rounded-2xl glass-card-heavy p-6 flex flex-col items-center gap-3 transition-all duration-200 hover:scale-[1.02] hover:border-primary/30 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
            {downloadingBoth ? (
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            ) : (
              <Download className="w-8 h-8 text-primary" />
            )}
          </div>
          <div>
            <div className="font-bold text-foreground text-base">XML + PDF</div>
            <div className="text-xs text-muted-foreground mt-0.5">Obidva naraz</div>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
            <Download className="w-3.5 h-3.5" />
            {downloadingBoth ? 'Stahuje sa...' : 'Stiahnut vsetko'}
          </div>
        </button>
      </div>

      {/* Peppol send - full width */}
      {hasApKey && isValid && !peppolStatus && (
        <GlassCard heavy className="border-success/20">
          <button
            onClick={onSendPeppol}
            disabled={sending}
            className="w-full flex items-center justify-center gap-3 py-2"
          >
            <div className="w-12 h-12 rounded-xl bg-success/15 flex items-center justify-center">
              {sending ? (
                <Loader2 className="w-6 h-6 text-success animate-spin" />
              ) : (
                <Send className="w-6 h-6 text-success" />
              )}
            </div>
            <div className="text-left">
              <div className="font-bold text-foreground text-base">
                {sending ? 'Odosielam cez Peppol...' : 'Odoslat cez Peppol siet'}
              </div>
              <div className="text-xs text-muted-foreground">
                Elektronicke dorucenie prijemcovi
              </div>
            </div>
          </button>
        </GlassCard>
      )}
    </div>
  )
}
