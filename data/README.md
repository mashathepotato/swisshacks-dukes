# Data

Persona (CRM) and portfolio data from the challenge repo
(`SwissHacks-2026/SIX-Noumena-NTT-Data/data`), pulled in for the team.

The original `.xlsx` workbooks are kept as the source of truth. Every sheet is
also exported to CSV (one file per tab) so the data is diffable in git and
easy for code/agents to read. **Regenerate the CSVs** with `extract.py` if the
workbooks change.

## Files

### Source workbooks
- `SwissHacks CRM.xlsx` — 3-year RM interaction logs, one tab per client.
- `SwissHacks Portfolio Construction.xlsx` — model mandates, CIO recs, txns, cash flows.

### `crm/` — one CSV per client (columns: Date, Medium, RM Name, Client Contact, Note)
- `crm_raeber.csv` — Räber (Defensive) · averse to US tech, conservative value.
- `crm_schneider.csv` — Schneider (Balanced) · family foundation, chronic-illness research.
- `crm_huber.csv` — Huber (Defensive) · environmentalist, reforestation.
- `crm_ammann.csv` — Ammann (Growth) · entrepreneur, reputational risk = financial risk.

### `portfolio/`
- `readme.csv` — workbook README sheet (SIX coverage, ±2.0pp drift rule, conventions).
- `portfolio_strategies.csv` — CIO sub-asset-class targets per mandate.
- `cio_recommendation_list.csv` — BUY/HOLD/SELL ratings + swap candidates (constrains the swap universe).
- `sample_portfolio_defensive.csv` / `_balanced.csv` / `_growth.csv` — current positions, Target vs. Current (CHF), with ISIN, Valor, MIC, Yahoo ticker.
- `transactions_defensive.csv` / `_balanced.csv` / `_growth.csv` — 3-year transaction history.
- `cash_flows.csv` — deposits, withdrawals, fees, coupons.

## Persona ↔ portfolio mapping

| Persona | Strategy | CRM file | Portfolio file |
|---|---|---|---|
| Schneider | Balanced | `crm/crm_schneider.csv` | `portfolio/sample_portfolio_balanced.csv` |
| Huber | Defensive | `crm/crm_huber.csv` | `portfolio/sample_portfolio_defensive.csv` |
| Räber | Defensive | `crm/crm_raeber.csv` | `portfolio/sample_portfolio_defensive.csv` |
| Ammann | Growth | `crm/crm_ammann.csv` | `portfolio/sample_portfolio_growth.csv` |

## Data conventions (from the challenge)

- All amounts in CHF; ISINs per ISO 6166. Each mandate's `Target (CHF)` sums to CHF 10,000,000.
- Equities priced at historical closes; bonds at par (qty = face value ÷ 100).
- Current position per ISIN = Σ(BUY − SELL) quantities.
- `Current (CHF)` ≈ 10 days post-April-2026 rebalance (drifted); `Target (CHF)` is the rebalance allocation.
- Balanced & Growth carry deliberate mandate-drift breaches (±2.0pp rule).
- SIX listing tools: combine `{Valor}_{MIC}`; instrument tools use Valor alone; bonds use ISIN.
