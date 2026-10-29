"""Measure how well the anomaly detectors catch injected spikes.

Run from the project root:   python -m ml_logic.evaluate

The Kaggle data has no anomaly labels, so we build them: held-out real amounts are
"normal", and real amounts multiplied by k are "anomalous". This measures spike
detection on synthetic anomalies, NOT real-world fraud detection.
"""
import numpy as np
import pandas as pd
from sklearn.metrics import f1_score, precision_score, recall_score
from sklearn.model_selection import train_test_split

from ml_logic.data_conv import prepare_data
from ml_logic.model import MIN_HISTORY, fit_models, personal_flag

SEED = 42
MULTIPLIERS = [2, 3, 5, 10]
ANOMALY_RATIO = 0.10      # about 1 anomaly for every 10 normals
HIST_LEN = 20


def summarise(k, y_true, y_pred):
    y_true, y_pred = np.asarray(y_true), np.asarray(y_pred)
    return {
        "k": k,
        "precision": precision_score(y_true, y_pred, zero_division=0),
        "recall": recall_score(y_true, y_pred, zero_division=0),
        "f1": f1_score(y_true, y_pred, zero_division=0),
        "fpr": float(y_pred[y_true == 0].mean()),
        "n_norm": int((y_true == 0).sum()),
        "n_anom": int((y_true == 1).sum()),
    }


def eval_population(data, rng):
    """Isolation Forest fallback: train on 80% of rows, test on the held-out 20%."""
    train, test = train_test_split(
        data, test_size=0.2, random_state=SEED, stratify=data["category_id"]
    )
    models = fit_models(train)
    rows = []
    for k in MULTIPLIERS:
        y_true, y_pred = [], []
        for cid, model in models.items():
            normals = test.loc[test["category_id"] == cid, "amount"].to_numpy()
            if len(normals) == 0:
                continue
            n_anom = max(1, int(len(normals) * ANOMALY_RATIO))
            anoms = rng.choice(normals, size=n_anom) * k
            amounts = np.concatenate([normals, anoms])
            labels = np.concatenate([np.zeros(len(normals), int), np.ones(n_anom, int)])
            preds = (model.predict(pd.DataFrame({"amount": amounts})) == -1).astype(int)
            y_true.extend(labels)
            y_pred.extend(preds)
        rows.append(summarise(k, y_true, y_pred))
    return rows


def eval_personal(data, rng, sigma, n_users=3000, normals_per_user=10):
    """Personal z-score baseline on SIMULATED users (the dataset has no per-user history)."""
    assert HIST_LEN >= MIN_HISTORY
    typical = rng.choice(data["amount"].to_numpy(), size=n_users)
    rows = []
    for k in MULTIPLIERS:
        y_true, y_pred = [], []
        for t in typical:
            hist = t * np.exp(rng.normal(0, sigma, HIST_LEN))
            tests = t * np.exp(rng.normal(0, sigma, normals_per_user + 1))
            tests[-1] *= k
            y_true.extend([0] * normals_per_user + [1])
            y_pred.extend(int(personal_flag(a, hist)) for a in tests)
        rows.append(summarise(k, y_true, y_pred))
    return rows


def print_table(title, rows):
    print(f"\n### {title}\n")
    print("| Spike size | Precision | Recall | F1 | False-positive rate | Normals / anomalies |")
    print("|---|---|---|---|---|---|")
    for r in rows:
        print(
            f"| {r['k']}x | {r['precision']:.2f} | {r['recall']:.2f} | {r['f1']:.2f} "
            f"| {r['fpr']:.1%} | {r['n_norm']} / {r['n_anom']} |"
        )


def main():
    data, _ = prepare_data("data.csv")
    rng = np.random.default_rng(SEED)
    print(f"Rows: {len(data)} | seed={SEED} | anomaly ratio ~{ANOMALY_RATIO:.0%} of normals")
    print_table("Population fallback (Isolation Forest), held-out real data", eval_population(data, rng))
    for sigma in (0.25, 0.5):
        print_table(
            f"Personal baseline (z-score), simulated users, history spread sigma={sigma}",
            eval_personal(data, rng, sigma),
        )


if __name__ == "__main__":
    main()