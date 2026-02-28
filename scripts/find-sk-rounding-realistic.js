/**
 * Find realistic invoice line items (typical business prices) that trigger
 * SK rounding corrections in both directions.
 */

function round2(n) {
  return Math.round(n * 100) / 100
}

const RATE = 20

// Realistic business prices
const realisticPrices = [
  12.50, 15.00, 19.99, 24.90, 29.50, 33.33, 37.50, 42.00, 
  45.80, 49.99, 55.00, 62.50, 75.00, 83.33, 99.90, 125.00, 
  149.99, 175.50, 199.99, 250.00, 333.33, 499.99, 750.00, 999.99
]
const realisticQtys = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20, 25, 50, 100]

const chargeResults = []
const allowanceResults = []

// Multi-item combinations (2-4 items)
for (const q1 of realisticQtys) {
  for (const p1 of realisticPrices) {
    for (const q2 of realisticQtys) {
      for (const p2 of realisticPrices) {
        const line1Net = round2(q1 * p1)
        const line2Net = round2(q2 * p2)
        const taxBase_EN = round2(line1Net + line2Net)

        const gross1 = round2(q1 * round2(p1 * (100 + RATE) / 100))
        const gross2 = round2(q2 * round2(p2 * (100 + RATE) / 100))
        const totalGross = round2(gross1 + gross2)
        const tax_SK = round2(totalGross * RATE / (100 + RATE))
        const base_SK = round2(totalGross - tax_SK)
        const diff = round2(base_SK - taxBase_EN)

        if (diff > 0 && chargeResults.length < 2 && taxBase_EN > 50) {
          chargeResults.push({
            items: [
              { qty: q1, price: p1, lineNet: line1Net, desc: 'Konzultacia IT' },
              { qty: q2, price: p2, lineNet: line2Net, desc: 'Sprava servera' }
            ],
            taxBase_EN, totalGross, tax_SK, base_SK, diff, tax_EN: round2(taxBase_EN * RATE / 100)
          })
        }
        if (diff < 0 && allowanceResults.length < 2 && taxBase_EN > 50) {
          allowanceResults.push({
            items: [
              { qty: q1, price: p1, lineNet: line1Net, desc: 'Webovy hosting' },
              { qty: q2, price: p2, lineNet: line2Net, desc: 'Domena .sk' }
            ],
            taxBase_EN, totalGross, tax_SK, base_SK, diff, tax_EN: round2(taxBase_EN * RATE / 100)
          })
        }

        if (chargeResults.length >= 2 && allowanceResults.length >= 2) break
      }
      if (chargeResults.length >= 2 && allowanceResults.length >= 2) break
    }
    if (chargeResults.length >= 2 && allowanceResults.length >= 2) break
  }
  if (chargeResults.length >= 2 && allowanceResults.length >= 2) break
}

function printExample(ex, type) {
  console.log(`\n--- ${type} ---`)
  console.log('Line items:')
  for (const item of ex.items) {
    const grossUnit = round2(item.price * 1.2)
    console.log(`  "${item.desc}": ${item.qty} x ${item.price.toFixed(2)} EUR (gross/unit: ${grossUnit.toFixed(2)}) = ${item.lineNet.toFixed(2)} EUR net`)
  }
  console.log()
  console.log(`EN method:  taxBase = ${ex.taxBase_EN.toFixed(2)}, tax = ${ex.tax_EN.toFixed(2)}, total = ${round2(ex.taxBase_EN + ex.tax_EN).toFixed(2)}`)
  console.log(`SK method:  totalGross = ${ex.totalGross.toFixed(2)}, tax = ${ex.tax_SK.toFixed(2)}, base = ${ex.base_SK.toFixed(2)}`)
  console.log(`Correction: ${ex.diff > 0 ? '+' : ''}${ex.diff.toFixed(2)} EUR → ${ex.diff > 0 ? 'Charge (BG-21)' : 'Allowance (BG-20)'} with ReasonCode=ZZZ`)
  console.log(`After correction: taxBase = ${ex.base_SK.toFixed(2)}, tax = ${ex.tax_SK.toFixed(2)}, payable = ${round2(ex.base_SK + ex.tax_SK).toFixed(2)}`)
}

console.log('==========================================================')
console.log('  TEST DATA: Slovak Rounding Corrections')
console.log('  Both directions, realistic invoice amounts, 20% DPH')
console.log('==========================================================')

console.log('\n========== CHARGE (Priratzka ZZZ) ==========')
console.log('SK taxBase > EN taxBase → add Charge to increase EN base')
for (const ex of chargeResults) printExample(ex, 'CHARGE')

console.log('\n========== ALLOWANCE (Zlava ZZZ) ==========')
console.log('SK taxBase < EN taxBase → add Allowance to decrease EN base')
for (const ex of allowanceResults) printExample(ex, 'ALLOWANCE')
