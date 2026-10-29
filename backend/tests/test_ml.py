
import numpy as np
import pandas as pd
from ml_logic.model import fit_models, personal_flag


def test_personal_flag_catches_spike_and_ignores_normal():
    history = [100, 110, 95, 105, 98, 102, 108, 99, 101, 104]
    assert personal_flag(1000, history) is True
    assert personal_flag(103, history) is False


def test_personal_flag_ignores_low_spend():
    history = [100, 110, 95, 105, 98, 102, 108, 99, 101, 104]
    assert personal_flag(5, history) is False     # we only flag unusually HIGH spend


def test_fit_models_skips_small_categories():
    rng = np.random.default_rng(0)
    big = pd.DataFrame({"amount": rng.normal(1000, 100, 200).clip(1), "category_id": 0})
    small = pd.DataFrame({"amount": [10.0, 20.0], "category_id": 1})
    models = fit_models(pd.concat([big, small], ignore_index=True))
    assert set(models) == {0}