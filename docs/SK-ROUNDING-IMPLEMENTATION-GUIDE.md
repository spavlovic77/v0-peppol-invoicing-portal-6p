# Slovak Rounding Correction for Peppol BIS 3.0 / EN 16931

## Developer Implementation Guide

> This document explains how to correctly implement Slovak VAT rounding
> in Peppol e-invoices so that the invoice is compliant with both
> **Slovak tax law** and **EN 16931 / Peppol BIS 3.0 validation**.

---

## 1. The Problem

Slovak tax law and EN 16931 calculate VAT using **opposite directions**, which produces different results due to rounding.

### Slovak method (reverse / "top-down")

Start from the total amount with VAT and work backwards:

```
tax     = grossWithVat * rate / (100 + rate)
taxBase = grossWithVat - tax
```

### EN 16931 method (forward / "bottom-up")

Start from the sum of line items and work forwards:

```
taxBase = SUM(BT-131)   -- sum of all Invoice line net amounts
tax     = taxBase * rate / 100
```

### Why they differ

Each Invoice line net amount (BT-131) is rounded to 2 decimals. When you sum
many rounded line amounts, the aggregate tax base differs from the tax base
derived by reversing the gross total. The difference is typically 0.01-1.00 EUR
but can be larger on invoices with many lines.

### Real-world example (23% VAT)

```
Gross with VAT:   625,693.90 EUR

SK method:
  tax     = 625,693.90 x 23 / 123  = 116,999.67 EUR (BT-117)
  taxBase = 625,693.90 - 116,999.67 = 508,694.23 EUR (BT-116)

EN method:
  taxBase = SUM(BT-131) = 508,694.11 EUR (BT-116)
  tax     = 508,694.11 x 23 / 100 = 116,999.65 EUR (BT-117)

Difference: 508,694.23 - 508,694.11 = 0.12 EUR
```

Without correction, Peppol validation rejects the invoice because
`BT-116 != SUM(BT-131)`.

---

## 2. The Solution: Corrective AllowanceCharge

The trick: emit a **document-level AllowanceCharge** (BG-20 or BG-21) that
carries the rounding difference. This makes the EN 16931 formula work:

```
BT-116 = SUM(BT-131) + SUM(BT-99 charges) - SUM(BT-92 allowances)
```

The correction entry bridges SK law and EN math in one element.

---

## 3. Step-by-Step Implementation

### Step 1: Compute Invoice line net amounts (BT-131)

For each line item, calculate the net amount using standard EN method:

```
BT-131 = BT-129 (quantity) x BT-146 (item net price)
```

If there are per-line discounts:

```
lineGross    = BT-129 x BT-146
lineDiscount = lineGross x discountPercent / 100
BT-131       = round2(lineGross - lineDiscount)
```

> **Important (PEPPOL-EN16931-R120):** `BT-146` (Item net price) must be the
> price AFTER per-item discount such that `BT-131 = BT-129 x BT-146` holds
> exactly. If you have a discount, set `BT-146 = round2(BT-131 / BT-129)` and
> recalculate `BT-131 = BT-129 x BT-146` to avoid rounding drift.

### Step 2: Sum all line amounts

```
BT-106 (LineExtensionAmount) = SUM(BT-131)
```

This is the pure EN forward sum. No SK logic yet.

### Step 3: Compute per-line gross amounts (SK method)

For each line, compute the gross-with-VAT amount individually and round:

```
lineGross_i = round2(BT-131_i x (100 + rate) / 100)
```

Group by tax rate (BT-119) and sum:

```
grossWithVat_perGroup = SUM(lineGross_i) for all lines with same BT-119
```

> **Critical:** You must gross up each line **individually** and then sum.
> Do NOT gross up the aggregate tax base -- that produces a different result.

### Step 4: Compute SK tax and tax base per group

For each tax rate group:

```
tax_SK     = round2(grossWithVat x rate / (100 + rate))
taxBase_SK = round2(grossWithVat - tax_SK)
```

These are the values that Slovak law considers correct.

### Step 5: Compute EN tax base per group

```
taxBase_EN = SUM(BT-131) for lines in this group
           - any user-applied document-level allowances (BG-20) for this group
```

### Step 6: Calculate the correction

```
correction = taxBase_SK - taxBase_EN
```

Three outcomes:

| Correction | Meaning | Action |
|-----------|---------|--------|
| `= 0` | Both methods agree | No correction needed |
| `> 0` | SK base is higher than EN base | Emit a **Charge** (BG-21) |
| `< 0` | SK base is lower than EN base | Emit an **Allowance** (BG-20) |

### Step 7: Emit the corrective AllowanceCharge

If `correction != 0`, add a document-level AllowanceCharge group:

**For a Charge (correction > 0):**

| BT | Element | Value |
|----|---------|-------|
| BG-21 | `cac:AllowanceCharge` | Container |
| BT-101 | `cbc:ChargeIndicator` | `true` |
| BT-105 | `cbc:AllowanceChargeReasonCode` | `ZZZ` (UNCL 7161 - Mutually defined) |
| BT-104 | `cbc:AllowanceChargeReason` | `Vzajomne definovane` |
| BT-99 | `cbc:Amount` | Absolute value of correction |
| BT-102/103 | `cac:TaxCategory` | Tax rate this correction applies to |

**For an Allowance (correction < 0):**

| BT | Element | Value |
|----|---------|-------|
| BG-20 | `cac:AllowanceCharge` | Container |
| BT-92 | `cbc:ChargeIndicator` | `false` |
| BT-98 | `cbc:AllowanceChargeReasonCode` | `104` (UNCL 5189 - Special agreement) |
| BT-97 | `cbc:AllowanceChargeReason` | `Vzajomne definovane` |
| BT-92 | `cbc:Amount` | Absolute value of correction |
| BT-95/96 | `cac:TaxCategory` | Tax rate this correction applies to |

> **Why different reason codes?** Charges validate against UNCL 7161 (BR-CL-20)
> where `ZZZ` is valid. Allowances validate against UNCL 5189 (BR-CL-19) where
> `ZZZ` does NOT exist. Use `104` ("Special agreement") for allowances instead.

### Step 8: Compute final totals

Use the SK-correct values for all summary elements:

```
BT-106 = SUM(BT-131)                      -- unchanged, this is the EN line sum
BT-107 = SUM(allowance amounts)           -- user discounts + SK allowance corrections
BT-108 = SUM(charge amounts)              -- SK charge corrections
BT-109 = BT-106 + BT-108 - BT-107        -- tax exclusive amount (= SK tax base)
BT-110 = BT-109 + BT-117                  -- tax inclusive amount
BT-112 = BT-110                           -- payable amount (if no prepaid/rounding)
BT-116 = taxBase_SK per group              -- in TaxSubtotal
BT-117 = tax_SK per group                  -- in TaxSubtotal
```

The key identity that EN validation checks:

```
BT-109 = SUM(BT-131) + SUM(BT-99 charges) - SUM(BT-92 allowances)
        = taxBase_EN + correction
        = taxBase_SK   <-- this is the SK-legislatively correct value
```

### Step 9: Build the TaxSubtotal (BG-23)

Use the SK-calculated values:

```xml
<cac:TaxSubtotal>
  <cbc:TaxableAmount currencyID="EUR">{taxBase_SK}</cbc:TaxableAmount>
  <cbc:TaxAmount currencyID="EUR">{tax_SK}</cbc:TaxAmount>
  <cac:TaxCategory>
    <cbc:ID>S</cbc:ID>
    <cbc:Percent>23</cbc:Percent>
    <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
  </cac:TaxCategory>
</cac:TaxSubtotal>
```

---

## 4. XML Example: Charge Correction (+0.02 EUR)

10 lines, each: qty=3, unitPrice=7.33, VAT 23%

```
EN method:  taxBase = 219.90, tax = 50.58
SK method:  grossWithVat = 270.50, tax = 50.58, taxBase = 219.92
Correction: +0.02 (Charge)
```

```xml
<!-- SK rounding correction: Charge -->
<cac:AllowanceCharge>
  <cbc:ChargeIndicator>true</cbc:ChargeIndicator>
  <cbc:AllowanceChargeReasonCode>ZZZ</cbc:AllowanceChargeReasonCode>
  <cbc:AllowanceChargeReason>Vzajomne definovane</cbc:AllowanceChargeReason>
  <cbc:Amount currencyID="EUR">0.02</cbc:Amount>
  <cac:TaxCategory>
    <cbc:ID>S</cbc:ID>
    <cbc:Percent>23</cbc:Percent>
    <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
  </cac:TaxCategory>
</cac:AllowanceCharge>

<cac:LegalMonetaryTotal>
  <cbc:LineExtensionAmount currencyID="EUR">219.90</cbc:LineExtensionAmount>
  <cbc:TaxExclusiveAmount currencyID="EUR">219.92</cbc:TaxExclusiveAmount>
  <cbc:TaxInclusiveAmount currencyID="EUR">270.50</cbc:TaxInclusiveAmount>
  <cbc:ChargeTotalAmount currencyID="EUR">0.02</cbc:ChargeTotalAmount>
  <cbc:PayableAmount currencyID="EUR">270.50</cbc:PayableAmount>
</cac:LegalMonetaryTotal>
```

Validation check: `219.92 = 219.90 + 0.02 (charge)` -- PASS

---

## 5. XML Example: Allowance Correction (-0.01 EUR)

3 lines: qty=8 x 0.41, qty=12 x 0.41, qty=5 x 0.82, VAT 23%

```
EN method:  taxBase = 12.30, tax = 2.83
SK method:  grossWithVat = 15.12, tax = 2.83, taxBase = 12.29
Correction: -0.01 (Allowance)
```

```xml
<!-- SK rounding correction: Allowance -->
<cac:AllowanceCharge>
  <cbc:ChargeIndicator>false</cbc:ChargeIndicator>
  <cbc:AllowanceChargeReasonCode>104</cbc:AllowanceChargeReasonCode>
  <cbc:AllowanceChargeReason>Vzajomne definovane</cbc:AllowanceChargeReason>
  <cbc:Amount currencyID="EUR">0.01</cbc:Amount>
  <cac:TaxCategory>
    <cbc:ID>S</cbc:ID>
    <cbc:Percent>23</cbc:Percent>
    <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
  </cac:TaxCategory>
</cac:AllowanceCharge>

<cac:LegalMonetaryTotal>
  <cbc:LineExtensionAmount currencyID="EUR">12.30</cbc:LineExtensionAmount>
  <cbc:TaxExclusiveAmount currencyID="EUR">12.29</cbc:TaxExclusiveAmount>
  <cbc:TaxInclusiveAmount currencyID="EUR">15.12</cbc:TaxInclusiveAmount>
  <cbc:AllowanceTotalAmount currencyID="EUR">0.01</cbc:AllowanceTotalAmount>
  <cbc:PayableAmount currencyID="EUR">15.12</cbc:PayableAmount>
</cac:LegalMonetaryTotal>
```

Validation check: `12.29 = 12.30 - 0.01 (allowance)` -- PASS

---

## 6. Multiple Tax Rates

When an invoice has lines with different tax rates (e.g., 23% and 10%),
compute the correction **independently for each rate group**. Each group may
produce its own AllowanceCharge entry (or none if it has zero correction).

You will have multiple `<cac:AllowanceCharge>` elements, each referencing
its applicable `<cac:TaxCategory>`.

---

## 7. Interaction with Document-Level User Discounts

If the user applies a global discount (e.g., 10% off the whole invoice),
that discount is also a document-level AllowanceCharge (BG-20) with
`ReasonCode=95` ("Discount"). The SK rounding correction is a separate
AllowanceCharge entry alongside it.

Order of operations:
1. Compute line totals (BT-131)
2. Apply user discount as AllowanceCharge (BG-20, ReasonCode=95)
3. Compute EN tax base = SUM(BT-131) - user discounts
4. Compute SK gross with VAT (adjust for discount: reduce grossSum proportionally)
5. Compute SK tax base via reverse method
6. Correction = SK base - EN base
7. Emit corrective AllowanceCharge if correction != 0

---

## 8. Validation Rules Reference

| Rule | Description | How SK correction satisfies it |
|------|-------------|-------------------------------|
| BR-13 | BT-109 = SUM(BT-131) + BT-108 - BT-107 | Correction is in BT-108 or BT-107 |
| BR-CO-15 | BT-116 in TaxSubtotal must match summed BT-131 for category | SK correction adjusts BT-116 |
| BR-S-08 | BT-117 = BT-116 x BT-119 / 100 | We use tax_SK which matches taxBase_SK |
| BR-CL-19 | Allowance reason codes must be from UNCL 5189 | We use `104` (not ZZZ) |
| BR-CL-20 | Charge reason codes must be from UNCL 7161 | We use `ZZZ` |
| R040 | Amount = BaseAmount x Percent / 100 if both exist | We omit BaseAmount and MultiplierFactorNumeric |
| R120 | BT-131 = BT-129 x BT-146 | We set BT-146 = round2(BT-131/BT-129) |

---

## 9. Key Pitfalls

1. **Do NOT use `ZZZ` for allowances.** UNCL 5189 does not contain `ZZZ`.
   Use `104` (Special agreement) for allowances, `ZZZ` for charges.

2. **Do NOT gross up the aggregate tax base.** Gross up each line individually
   and then sum. Otherwise you get a different rounding result.

3. **Do NOT emit `BaseAmount` or `MultiplierFactorNumeric`** on the correction
   AllowanceCharge. If present, rule R040 requires `Amount = Base x Percent / 100`
   which is impossible for a rounding correction.

4. **Do NOT skip the correction for small amounts.** Even 0.01 EUR difference
   will fail Peppol validation.

5. **Do NOT hardcode the direction.** The correction can be positive (Charge) or
   negative (Allowance) depending on the specific line amounts and quantities.

6. **Always recalculate BT-146** (item net price) from `BT-131 / BT-129` after
   applying per-item discounts. Otherwise R120 fails.

---

## 10. Pseudocode Summary

```
function buildInvoice(lines, vatRate):
    // EN method
    for each line:
        BT_131 = round2(qty * unitPrice)
        lineGross = round2(BT_131 * (100 + rate) / 100)  // SK per-line gross

    taxBase_EN = SUM(BT_131)
    grossWithVat = SUM(lineGross)

    // SK reverse method
    tax_SK     = round2(grossWithVat * rate / (100 + rate))
    taxBase_SK = round2(grossWithVat - tax_SK)

    // Correction
    correction = round2(taxBase_SK - taxBase_EN)

    if correction > 0:
        emit Charge(amount=correction, code='ZZZ', reason='Vzajomne definovane')
    if correction < 0:
        emit Allowance(amount=abs(correction), code='104', reason='Vzajomne definovane')

    // Final totals
    BT_109 = taxBase_EN + correction  // = taxBase_SK
    BT_110 = BT_109 + tax_SK
    BT_112 = BT_110
```

---

*This implementation was validated against ION AP (Ionite) Peppol Access Point
test environment, passing all 3 validation layers: UBL 2.1 XSD schema,
EN 16931 CEN schematron, and Peppol BIS 3.0 rules.*
