/**
 * Brute-force search for invoice line item combinations that produce
 * SK rounding corrections in both directions (Charge and Allowance).
 *
 * SK method: per-line gross = round2(lineNet * (1 + rate/100)), sum them,
 *            then tax = round2(totalGross * rate / (100+rate)), base = totalGross - tax
 * EN method: taxBase = sum of line nets, tax = round2(taxBase * rate / 100)
 *
 * The difference between taxBase_SK and taxBase_EN triggers a corrective AllowanceCharge.
 */

function round2(n) {
  return Math.round(n * 100) / 100
}

const RATE = 20 // 20% VAT

// Try combinations of quantities and prices
const quantities = [1, 2, 3, 5, 7, 10, 13]
const prices = []
for (let p = 0.01; p <= 50.00; p = round2(p + 0.01)) {
  prices.push(round2(p))
}

const chargeExamples = [] // SK > EN (correction is a Charge)
const allowanceExamples = [] // SK < EN (correction is an Allowance)

// Test single-item invoices first
for (const qty of quantities) {
  for (const price of prices) {
    const lineNet = round2(qty * price)

    // EN method
    const taxBase_EN = lineNet
    const tax_EN = round2(taxBase_EN * RATE / 100)

    // SK method: per-line gross, then reverse
    const grossPerLine = round2(price * (100 + RATE) / 100)
    const totalGross = round2(qty * grossPerLine)
    const tax_SK = round2(totalGross * RATE / (100 + RATE))
    const base_SK = round2(totalGross - tax_SK)

    const diff = round2(base_SK - taxBase_EN)

    if (diff > 0 && chargeExamples.length < 3) {
      chargeExamples.push({
        items: [{ qty, price, lineNet }],
        taxBase_EN, tax_EN, totalGross, tax_SK, base_SK, diff,
        type: 'CHARGE (SK > EN)'
      })
    }
    if (diff < 0 && allowanceExamples.length < 3) {
      allowanceExamples.push({
        items: [{ qty, price, lineNet }],
        taxBase_EN, tax_EN, totalGross, tax_SK, base_SK, diff,
        type: 'ALLOWANCE (SK < EN)'
      })
    }
  }
}

// Test multi-item invoices (2-3 items, same rate)
if (chargeExamples.length < 3 || allowanceExamples.length < 3) {
  const smallPrices = prices.filter(p => p <= 10.00)
  outer:
  for (const q1 of [1, 2, 3]) {
    for (const p1 of smallPrices) {
      for (const q2 of [1, 2, 3]) {
        for (const p2 of smallPrices) {
          const line1Net = round2(q1 * p1)
          const line2Net = round2(q2 * p2)

          // EN method
          const taxBase_EN = round2(line1Net + line2Net)

          // SK method: per-line gross
          const gross1 = round2(q1 * round2(p1 * (100 + RATE) / 100))
          const gross2 = round2(q2 * round2(p2 * (100 + RATE) / 100))
          const totalGross = round2(gross1 + gross2)
          const tax_SK = round2(totalGross * RATE / (100 + RATE))
          const base_SK = round2(totalGross - tax_SK)

          const diff = round2(base_SK - taxBase_EN)

          if (diff > 0 && chargeExamples.length < 3) {
            chargeExamples.push({
              items: [
                { qty: q1, price: p1, lineNet: line1Net },
                { qty: q2, price: p2, lineNet: line2Net }
              ],
              taxBase_EN, totalGross, tax_SK, base_SK, diff,
              type: 'CHARGE (SK > EN)'
            })
          }
          if (diff < 0 && allowanceExamples.length < 3) {
            allowanceExamples.push({
              items: [
                { qty: q1, price: p1, lineNet: line1Net },
                { qty: q2, price: p2, lineNet: line2Net }
              ],
              taxBase_EN, totalGross, tax_SK, base_SK, diff,
              type: 'ALLOWANCE (SK < EN)'
            })
          }

          if (chargeExamples.length >= 3 && allowanceExamples.length >= 3) break outer
        }
      }
    }
  }
}

console.log('=== CHARGE EXAMPLES (SK taxBase > EN taxBase) ===')
console.log('These need a Charge (BG-21) with ReasonCode ZZZ to increase EN taxBase\n')
for (const ex of chargeExamples) {
  console.log(`Items:`)
  for (const item of ex.items) {
    console.log(`  ${item.qty} x ${item.price.toFixed(2)} EUR = ${item.lineNet.toFixed(2)} EUR (net)`)
  }
  console.log(`  taxBase_EN = ${ex.taxBase_EN.toFixed(2)}, totalGross_SK = ${ex.totalGross.toFixed(2)}`)
  console.log(`  tax_SK = ${ex.tax_SK.toFixed(2)}, base_SK = ${ex.base_SK.toFixed(2)}`)
  console.log(`  Correction: ${ex.diff > 0 ? '+' : ''}${ex.diff.toFixed(2)} EUR (Charge)`)
  console.log()
}

console.log('=== ALLOWANCE EXAMPLES (SK taxBase < EN taxBase) ===')
console.log('These need an Allowance (BG-20) with ReasonCode ZZZ to decrease EN taxBase\n')
for (const ex of allowanceExamples) {
  console.log(`Items:`)
  for (const item of ex.items) {
    console.log(`  ${item.qty} x ${item.price.toFixed(2)} EUR = ${item.lineNet.toFixed(2)} EUR (net)`)
  }
  console.log(`  taxBase_EN = ${ex.taxBase_EN.toFixed(2)}, totalGross_SK = ${ex.totalGross.toFixed(2)}`)
  console.log(`  tax_SK = ${ex.tax_SK.toFixed(2)}, base_SK = ${ex.base_SK.toFixed(2)}`)
  console.log(`  Correction: ${ex.diff > 0 ? '+' : ''}${ex.diff.toFixed(2)} EUR (Allowance)`)
  console.log()
}

if (chargeExamples.length === 0) console.log('NO CHARGE EXAMPLES FOUND (single-item at 20% may not produce this)')
if (allowanceExamples.length === 0) console.log('NO ALLOWANCE EXAMPLES FOUND')
