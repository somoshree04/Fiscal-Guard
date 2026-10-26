import os
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest

BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_PATH = Path(os.getenv("MODEL_PATH", BASE_DIR / "anomaly_model.pkl"))

MIN_HISTORY = 10        # personal history needed before we trust it
Z_THRESHOLD = 3.0
_models: dict | None = None


def train_isolation_forest(data: pd.DataFrame, contamination: float = 0.02) -> str:
    """One Isolation Forest per category, trained on amount only."""
    models = {}
    for cat_id, group in data.groupby("category_id"):
        if len(group) < 50:
            continue
        m = IsolationForest(n_estimators=200, contamination=contamination, random_state=42)
        m.fit(group[["amount"]])
        models[int(cat_id)] = m
    joblib.dump(models, MODEL_PATH)
    return f"Trained {len(models)} category models on {len(data)} rows -> {MODEL_PATH}"


def load_model() -> dict:
    global _models
    if _models is None:
        if not MODEL_PATH.exists():
            raise RuntimeError(f"Model not found at {MODEL_PATH}. Run: python train_launcher.py")
        _models = joblib.load(MODEL_PATH)       # load once, trusted file only
    return _models


def is_anomaly(amount: float, category_id: int, history: list[float]) -> bool:
    # 1) Personal baseline: flag unusually HIGH spend vs this user's own history
    if len(history) >= MIN_HISTORY:
        logs = np.log1p(np.asarray(history, dtype=float))
        std = max(float(logs.std(ddof=1)), 0.1)
        z = (np.log1p(amount) - float(logs.mean())) / std
        return bool(z > Z_THRESHOLD)

    # 2) New user: fall back to the population model for that category
    model = load_model().get(category_id)
    if model is None:
        return False
    X = pd.DataFrame({"amount": [amount]})
    return bool(model.predict(X)[0] == -1)