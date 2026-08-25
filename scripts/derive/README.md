# Stimulus derivation pipeline

Every number in the 12 scored scenarios is produced by these scripts from the
two source datasets. Nothing in the stimulus bank is hand-written.

## Setup

The datasets are **not** in the repo (140 MB). Place them alongside the project
root as `walmart/` and `olist/`:

- `walmart/` — Kaggle *Walmart Store Sales Forecasting* (`train.csv`,
  `features.csv`, `stores.csv`)
- `olist/` — Kaggle *Brazilian E-Commerce Public Dataset by Olist*
  (`olist_orders_dataset.csv`, `olist_order_items_dataset.csv`,
  `olist_products_dataset.csv`, `olist_customers_dataset.csv`,
  `olist_sellers_dataset.csv`, `product_category_name_translation.csv`)

```bash
python3 -m venv venv
./venv/bin/pip install pandas numpy matplotlib
```

Run each script from the project root.

## Scripts

| Script | What it does |
| --- | --- |
| `verify_walmart.py` | Checks the safety-stock and newsvendor values against Appendix A. Newsvendor reproduces exactly; safety stock only under the σ rule below. |
| `find_sigma.py` | Searches candidate σ definitions to find which one reproduces Appendix A. Answer: **standard deviation of non-holiday weeks only** (0.0% error on all three). |
| `check_drivers.py` | Verifies the C1 driver attributions. All 12 reproduce exactly as Pearson correlations of weekly sales against each feature. |
| `derive.py` | Derives every reorder-point and expedite value from Olist: parameters, optima, perturbations solved to a target offset, and real driver correlations. Writes `/tmp/olist_manifest.json`. |
| `charts.py` | Renders `public/graphs/7–12.png` from the same data and window used for the parameters. |

## Key facts these scripts establish

**Safety stock σ excludes holiday weeks.** Appendix B.2 says the default is the
raw sample SD. That gives 31,226 for SS-2 against the published 21,135 — 48%
off. Using non-holiday weeks only reproduces 12,573 / 21,135 / 28,826 exactly.
**Appendix B.2 needs correcting**, or the published safety-stock values cannot be
reproduced by a reader.

**Estimation window for Olist is 2018-02-01 → 2018-08-01.** Order volume grows
2.2–4.2× across the full series, so a mean over everything describes no real
period. The charts are rendered on this same window, so the chart, the surfaced
statistic and the ground truth all describe identical data.

**Stated cost assumption for expedite decisions:** a day out of stock forfeits
that day's category revenue — sales lost, not deferred. Olist records prices but
not margins, so a margin-based cost would introduce a parameter absent from the
data. Scaling by an assumed margin scales all three expedite optima
proportionally.

**Driver attributions for reorder-point and expedite are correlations against
delivery time**, the quantity both decisions turn on. Correlations against binary
lateness were 0.02–0.17 — too weak to display honestly as "key factors" — while
delivery time gives 0.29–0.46, comparable to the Walmart drivers.

## Verifying without the datasets

`npm run preflight` re-runs each optimizer in `lib/optimizers.js` against each
scenario's stored parameters and asserts it reproduces the stored value. That
check needs no dataset and runs in CI.
