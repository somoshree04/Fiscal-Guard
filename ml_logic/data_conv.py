from pathlib import Path

import pandas as pd

from ml_logic.categories import CATEGORY_MAP, SPENDING_COLS

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

def prepare_data(csv_name: str = "data.csv"):
    path = DATA_DIR / csv_name
    if not path.exists():
        raise FileNotFoundError(f"{csv_name} not found at {path}")

    df = pd.read_csv(path)
    long_df = pd.melt(df, value_vars=SPENDING_COLS, var_name="category", value_name="amount")
    long_df["amount"] = pd.to_numeric(long_df["amount"], errors="coerce")
    long_df = long_df.dropna(subset=["amount"])
    long_df = long_df[long_df["amount"] > 0]            # zeros are "didn't spend", not data
    long_df["category_id"] = long_df["category"].map(CATEGORY_MAP)
    return long_df[["amount", "category_id"]].reset_index(drop=True), CATEGORY_MAP