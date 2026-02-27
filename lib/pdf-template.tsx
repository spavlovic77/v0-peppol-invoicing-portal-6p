import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#1a1a2e',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 2,
    borderBottomColor: '#7c3aed',
  },
  title: {
    fontSize: 24,
    fontFamily: 'Helvetica-Bold',
    color: '#7c3aed',
  },
  subtitle: {
    fontSize: 10,
    color: '#666',
    marginTop: 4,
  },
  invoiceInfo: {
    textAlign: 'right',
  },
  infoLabel: {
    fontSize: 8,
    color: '#888',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 6,
  },
  partiesRow: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 20,
  },
  partyBox: {
    flex: 1,
    backgroundColor: '#f8f7ff',
    padding: 12,
    borderRadius: 4,
  },
  partyTitle: {
    fontSize: 8,
    color: '#7c3aed',
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  partyName: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  partyLine: {
    fontSize: 9,
    color: '#444',
    marginBottom: 2,
  },
  table: {
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#7c3aed',
    padding: 8,
    borderRadius: 2,
  },
  tableHeaderText: {
    color: '#ffffff',
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#eee',
  },
  tableRowAlt: {
    flexDirection: 'row',
    padding: 8,
    backgroundColor: '#faf9ff',
    borderBottomWidth: 0.5,
    borderBottomColor: '#eee',
  },
  col1: { width: '5%' },
  col2: { width: '37%' },
  col3: { width: '10%', textAlign: 'right' },
  col4: { width: '8%', textAlign: 'center' },
  col5: { width: '15%', textAlign: 'right' },
  col6: { width: '10%', textAlign: 'right' },
  col7: { width: '15%', textAlign: 'right' },
  totalsBox: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 20,
  },
  totalsInner: {
    width: 240,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  totalLabel: {
    fontSize: 9,
    color: '#666',
  },
  totalValue: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
  },
  totalDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#7c3aed',
    marginVertical: 4,
  },
  grandTotalLabel: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#1a1a2e',
  },
  grandTotalValue: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#7c3aed',
  },
  paymentBox: {
    backgroundColor: '#f8f7ff',
    padding: 12,
    borderRadius: 4,
    marginBottom: 20,
  },
  paymentTitle: {
    fontSize: 8,
    color: '#7c3aed',
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  paymentRow: {
    flexDirection: 'row',
    gap: 30,
    marginBottom: 4,
  },
  paymentLabel: {
    fontSize: 8,
    color: '#888',
    width: 100,
  },
  paymentValue: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    borderTopWidth: 0.5,
    borderTopColor: '#ddd',
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 7,
    color: '#999',
  },
  noteBox: {
    marginBottom: 15,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#7c3aed',
    backgroundColor: '#faf9ff',
  },
  noteLabel: {
    fontSize: 8,
    color: '#7c3aed',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 3,
  },
  noteText: {
    fontSize: 9,
    color: '#444',
  },
})

function fmt(n: number | null | undefined): string {
  if (n == null) return '0,00'
  return n.toLocaleString('sk-SK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

interface InvoicePdfProps {
  invoice: Record<string, unknown>
  items: Record<string, unknown>[]
  profile: Record<string, unknown>
}

export function InvoicePdfDocument({ invoice, items, profile }: InvoicePdfProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>FAKTURA</Text>
            <Text style={styles.subtitle}>Danovy doklad</Text>
          </View>
          <View style={styles.invoiceInfo}>
            <Text style={styles.infoLabel}>Cislo faktury</Text>
            <Text style={styles.infoValue}>{String(invoice.invoice_number)}</Text>
            <Text style={styles.infoLabel}>Datum vystavenia</Text>
            <Text style={styles.infoValue}>{String(invoice.issue_date)}</Text>
            <Text style={styles.infoLabel}>Datum splatnosti</Text>
            <Text style={styles.infoValue}>{String(invoice.due_date)}</Text>
            {invoice.delivery_date && (
              <>
                <Text style={styles.infoLabel}>Datum dodania</Text>
                <Text style={styles.infoValue}>{String(invoice.delivery_date)}</Text>
              </>
            )}
          </View>
        </View>

        {/* Parties */}
        <View style={styles.partiesRow}>
          <View style={styles.partyBox}>
            <Text style={styles.partyTitle}>Dodavatel</Text>
            <Text style={styles.partyName}>{String(profile.company_name)}</Text>
            {profile.street && <Text style={styles.partyLine}>{String(profile.street)}</Text>}
            <Text style={styles.partyLine}>
              {String(profile.postal_code || '')} {String(profile.city || '')}
            </Text>
            <Text style={styles.partyLine}>{'\n'}ICO: {String(profile.ico)}</Text>
            {profile.dic && <Text style={styles.partyLine}>DIC: {String(profile.dic)}</Text>}
            {profile.ic_dph && <Text style={styles.partyLine}>IC DPH: {String(profile.ic_dph)}</Text>}
            {profile.registration_court && (
              <Text style={styles.partyLine}>
                {String(profile.registration_court)}, vl. c. {String(profile.registration_number || '')}
              </Text>
            )}
          </View>
          <View style={styles.partyBox}>
            <Text style={styles.partyTitle}>Odberatel</Text>
            <Text style={styles.partyName}>{String(invoice.buyer_name)}</Text>
            {invoice.buyer_street && <Text style={styles.partyLine}>{String(invoice.buyer_street)}</Text>}
            <Text style={styles.partyLine}>
              {String(invoice.buyer_postal_code || '')} {String(invoice.buyer_city || '')}
            </Text>
            {invoice.buyer_ico && <Text style={styles.partyLine}>{'\n'}ICO: {String(invoice.buyer_ico)}</Text>}
            {invoice.buyer_dic && <Text style={styles.partyLine}>DIC: {String(invoice.buyer_dic)}</Text>}
            {invoice.buyer_ic_dph && <Text style={styles.partyLine}>IC DPH: {String(invoice.buyer_ic_dph)}</Text>}
          </View>
        </View>

        {/* Items Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, styles.col1]}>#</Text>
            <Text style={[styles.tableHeaderText, styles.col2]}>Popis polozky</Text>
            <Text style={[styles.tableHeaderText, styles.col3]}>Mn.</Text>
            <Text style={[styles.tableHeaderText, styles.col4]}>MJ</Text>
            <Text style={[styles.tableHeaderText, styles.col5]}>Cena/MJ</Text>
            <Text style={[styles.tableHeaderText, styles.col6]}>DPH</Text>
            <Text style={[styles.tableHeaderText, styles.col7]}>Celkom</Text>
          </View>
          {items.map((item, i) => (
            <View key={i} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
              <Text style={styles.col1}>{i + 1}</Text>
              <Text style={styles.col2}>{String(item.description)}</Text>
              <Text style={styles.col3}>{String(item.quantity)}</Text>
              <Text style={styles.col4}>{String(item.unit || 'ks')}</Text>
              <Text style={styles.col5}>{fmt(item.unit_price as number)}</Text>
              <Text style={styles.col6}>{String(item.vat_rate)}%</Text>
              <Text style={styles.col7}>{fmt(item.line_total as number)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totalsBox}>
          <View style={styles.totalsInner}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Zaklad dane:</Text>
              <Text style={styles.totalValue}>
                {fmt(invoice.total_without_vat as number)} {String(invoice.currency || 'EUR')}
              </Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>DPH:</Text>
              <Text style={styles.totalValue}>
                {fmt(invoice.total_vat as number)} {String(invoice.currency || 'EUR')}
              </Text>
            </View>
            <View style={styles.totalDivider} />
            <View style={styles.totalRow}>
              <Text style={styles.grandTotalLabel}>Na uhradu:</Text>
              <Text style={styles.grandTotalValue}>
                {fmt(invoice.total_with_vat as number)} {String(invoice.currency || 'EUR')}
              </Text>
            </View>
          </View>
        </View>

        {/* Payment Details */}
        <View style={styles.paymentBox}>
          <Text style={styles.paymentTitle}>Platobne udaje</Text>
          {invoice.bank_name && (
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>Banka:</Text>
              <Text style={styles.paymentValue}>{String(invoice.bank_name)}</Text>
            </View>
          )}
          {invoice.iban && (
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>IBAN:</Text>
              <Text style={styles.paymentValue}>{String(invoice.iban)}</Text>
            </View>
          )}
          {invoice.swift && (
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>SWIFT:</Text>
              <Text style={styles.paymentValue}>{String(invoice.swift)}</Text>
            </View>
          )}
          {invoice.variable_symbol && (
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>Variabilny symbol:</Text>
              <Text style={styles.paymentValue}>{String(invoice.variable_symbol)}</Text>
            </View>
          )}
        </View>

        {/* Note */}
        {invoice.note && (
          <View style={styles.noteBox}>
            <Text style={styles.noteLabel}>Poznamka:</Text>
            <Text style={styles.noteText}>{String(invoice.note)}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            Vystavene v systeme Peppol Faktura | Peppol BIS 3.0
          </Text>
          <Text style={styles.footerText}>
            {String(profile.company_name)} | ICO: {String(profile.ico)}
          </Text>
        </View>
      </Page>
    </Document>
  )
}
