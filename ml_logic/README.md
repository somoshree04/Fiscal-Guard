
# ML: Spending Anomaly Detection

Flags unusually high expenses when a user logs them. Two strategies, chosen by how much history the user has.

## How scoring works

`is_anomaly(amount, category_id, history)` in `model.py`:

1. **Personal baseline** (the user has 10 or more past expenses in this category):
   take `log(1 + amount)` for the history and the new amount, and compute a z-score.
   Flag it if `z > 3`. The standard deviation has a floor of 0.1 so tightly clustered
   history doesn't make every small change look extreme. Only unusually *high*
   spending is flagged.
2. **Population fallback** (a new user, or fewer than 10 expenses in the category):
   use that category's Isolation Forest, trained on the dataset below, and flag
   the amount if the model predicts `-1`.

If a category has no trained model (fewer than 50 training rows), the fallback does not flag.

## Files

| File | Purpose |
|---|---|
| `categories.py` | Single source of truth for the 11 categories and their numeric ids |
| `data_conv.py` | Reshapes the wide survey data into one row per (category, amount); drops missing and zero amounts |
| `model.py` | Training (`train_isolation_forest`), one-time model loading, and scoring |
| `../train_launcher.py` | Runs data prep and training; writes `anomaly_model.pkl` |

## Training

```bash
python train_launcher.py   # run from the project root
```

One `IsolationForest` per category on the `amount` feature only
(`n_estimators=200`, `contamination=0.02`, `random_state=42`). The models are
saved together in `anomaly_model.pkl` and loaded once at API startup.
Set `MODEL_PATH` to use a different file.

## Data

*Indian Personal Finance and Spending Habits* (Kaggle), at `data/data.csv`.
Check the dataset's license on its Kaggle page before redistributing it.

## Limitations (read before trusting the output)

- The training data is **monthly spending totals per person**, but the app scores
  **individual transactions**. The fallback model is a rough prior, not a calibrated one.
- The Isolation Forest sees only the amount, not income, city tier or time of day.
- `contamination=0.02` means roughly 2% of training data is flagged by design.
- The personal baseline needs history. New users get the weaker population check.
- Loading a `.pkl` runs pickle; only load model files you created yourself.
- Evaluation against labelled test cases is planned; no accuracy figures are claimed yet.