# ML: Spending Anomaly Detection

Flags unusually high expenses at the moment a user logs them. It uses two strategies,
chosen by how much history that user has in the category.

| Situation | Method | Why |
|---|---|---|
| 10 or more past expenses in the category | **Personal baseline**: log-scale z-score against the user's own history | Learns this user's habits; no external data needed |
| New user or thin history | **Population fallback**: per-category Isolation Forest | Gives a reasonable first answer before any history exists |

## How scoring works

`is_anomaly(amount, category_id, history)` in `model.py`:

1. **Personal baseline.** Take `log(1 + x)` of the user's past amounts in this category
   and of the new amount, then compute `z = (new - mean) / std`. Flag if `z > 3`.
   The standard deviation has a floor of 0.1, so very consistent history doesn't make
   every small change look extreme. Only unusually *high* spending is flagged.
2. **Population fallback.** Use that category's Isolation Forest and flag the amount if
   the model predicts `-1`. A category with fewer than 50 training rows has no model,
   and the fallback does not flag.

## Files

| File | Purpose |
|---|---|
| `categories.py` | Single source of truth for the 11 categories and their numeric ids |
| `data_conv.py` | Reshapes the wide survey data into one row per (category, amount); drops missing and zero amounts |
| `model.py` | `fit_models` (training), `personal_flag` (z-score), `is_anomaly` (strategy choice), one-time model loading |
| `evaluate.py` | Reproducible evaluation (see below) |
| `../train_launcher.py` | Trains on all data and writes `anomaly_model.pkl` |
| `../backend/tests/test_ml.py` | Unit tests for `personal_flag` and `fit_models` |

## Training

```bash
python train_launcher.py   # run from the project root
```

One `IsolationForest` per category on the `amount` feature only
(`n_estimators=200`, `contamination=0.02`, `random_state=42`). The models are
saved together in `anomaly_model.pkl` and loaded once at API startup.
Set `MODEL_PATH` to use a different file.

## Data

Kaggle dataset *[confirm title + link]*, stored at `data/data.csv`.
Check its license before redistributing. After reshaping to one row per
(person, category) and dropping missing and zero amounts, it has
**203,908 rows** across 11 categories.

## Evaluation

```bash
python -m ml_logic.evaluate   # run from the project root; fixed seed (42), deterministic
```

### Method

The dataset has no anomaly labels, so the evaluation creates them:

- **Normal** examples are real amounts the model never saw (a stratified 80/20 split;
  the model is trained on the 80% only).
- **Anomalous** examples are real held-out amounts multiplied by *k* (2, 3, 5, 10),
  at roughly 1 anomaly per 10 normals.
- Precision, recall and F1 come from `scikit-learn`. The false-positive rate is the share
  of normal examples wrongly flagged.

The personal baseline needs per-user history, which this dataset doesn't have, so it is
evaluated on **simulated users**: each user has a "typical" amount drawn from the data,
20 past amounts scattered around it (log-normal spread *σ*), and test amounts drawn the
same way. Results are shown for two spreads: *σ* = 0.25 (consistent spenders) and
*σ* = 0.5 (erratic spenders).

### Results

**Population fallback (Isolation Forest), held-out real data**

| Spike size | Precision | Recall | F1 | False-positive rate | Normals / anomalies |
|---|---|---|---|---|---|
| 2x | 0.38 | 0.11 | 0.17 | 1.8% | 40,782 / 4,077 |
| 3x | 0.56 | 0.23 | 0.32 | 1.8% | 40,782 / 4,077 |
| 5x | 0.72 | 0.45 | 0.55 | 1.8% | 40,782 / 4,077 |
| 10x | 0.81 | 0.76 | 0.78 | 1.8% | 40,782 / 4,077 |

**Personal baseline (z-score), simulated users, σ = 0.25**

| Spike size | Precision | Recall | F1 | False-positive rate | Normals / anomalies |
|---|---|---|---|---|---|
| 2x | 0.90 | 0.44 | 0.59 | 0.5% | 30,000 / 3,000 |
| 3x | 0.95 | 0.90 | 0.92 | 0.5% | 30,000 / 3,000 |
| 5x | 0.96 | 1.00 | 0.98 | 0.5% | 30,000 / 3,000 |
| 10x | 0.95 | 1.00 | 0.98 | 0.5% | 30,000 / 3,000 |

**Personal baseline (z-score), simulated users, σ = 0.5**

| Spike size | Precision | Recall | F1 | False-positive rate | Normals / anomalies |
|---|---|---|---|---|---|
| 2x | 0.64 | 0.08 | 0.14 | 0.5% | 30,000 / 3,000 |
| 3x | 0.86 | 0.25 | 0.39 | 0.4% | 30,000 / 3,000 |
| 5x | 0.94 | 0.59 | 0.73 | 0.4% | 30,000 / 3,000 |
| 10x | 0.95 | 0.93 | 0.94 | 0.5% | 30,000 / 3,000 |

### What the results show

- **The population model is a weak prior.** It catches large spikes (recall 0.76 at 10x)
  but misses most spikes below 5x, because real spending in each category varies widely
  and a 3x amount is often still plausible. This is why the personal baseline takes over
  once a user has enough history.
- **The personal baseline is strong for consistent spenders** (precision 0.95, recall 0.90
  at 3x with σ = 0.25) and **degrades sharply for erratic spenders** (recall 0.25 at 3x
  with σ = 0.5). How much a person's own spending varies is the biggest factor.
- **Neither method reliably catches spikes of 2x or less**, by design: the z-score
  threshold and the isolation contamination setting favour few false alarms
  (0.5% and 1.8%) over catching mild increases.

### Caveats (read before quoting any number)

- These measure detection of **synthetic spikes**, not real fraud or real overspending.
  No real user labels exist.
- The personal-baseline numbers come from **simulated users**. Their σ is an assumption,
  and the results change a lot with it.
- Precision depends on how common anomalies are. The ratio here is about 1 in 10; if real
  anomalies are rarer, precision will be lower.
- The evaluation trains on an 80% split to measure generalisation. The deployed
  `anomaly_model.pkl` is trained on 100% of the data, so it is not the exact object that
  was scored, but it uses the same method and settings.
- Only unusually **high** amounts are flagged by the personal baseline.

## Limitations

- The training data is **monthly spending totals per person**, but the app scores
  **individual transactions**. The population fallback is a rough prior, not a
  calibrated model.
- The Isolation Forest sees only the amount, not income, city, time of day or merchant.
- `contamination=0.02` means roughly 2% of normal data is flagged by design.
- Loading a `.pkl` runs pickle, so only load model files you created yourself.

## Possible improvements

- Collect real labelled feedback (for example a "this was a mistake / not unusual" button)
  and use it to tune thresholds.
- Sweep `contamination` and `Z_THRESHOLD` and plot the precision/recall trade-off.
- Add features: income band, day of week, recurring-payment detection.
- Seasonal baselines (festival months, rent due dates) instead of one flat history.

## Tests

`backend/tests/test_ml.py` has three unit tests: `personal_flag` flags a clear spike and
ignores a normal amount, it ignores unusually low spend, and `fit_models` skips categories
with too little data. They use synthetic data, so CI needs no dataset.