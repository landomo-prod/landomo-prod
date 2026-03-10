"""
Evaluation metrics for ML pricing models.

Calculates standard regression metrics and custom accuracy bands.
"""

import numpy as np
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score


def calculate_mape(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    """Mean Absolute Percentage Error. Filters out zero-price entries."""
    mask = y_true != 0
    if mask.sum() == 0:
        return float("inf")
    return float(np.mean(np.abs((y_true[mask] - y_pred[mask]) / y_true[mask])) * 100)


def calculate_within_band(y_true: np.ndarray, y_pred: np.ndarray, pct: float) -> float:
    """Percentage of predictions within ±pct% of true price."""
    mask = y_true != 0
    if mask.sum() == 0:
        return 0.0
    ratio = np.abs(y_true[mask] - y_pred[mask]) / y_true[mask]
    return float((ratio <= pct / 100).mean() * 100)


def evaluate_model(y_true: np.ndarray, y_pred: np.ndarray) -> dict:
    """
    Calculate all evaluation metrics.

    Returns dict with: mae, rmse, r2, mape, within_10pct, within_20pct
    """
    y_true = np.asarray(y_true, dtype=np.float64)
    y_pred = np.asarray(y_pred, dtype=np.float64)

    return {
        "mae": float(mean_absolute_error(y_true, y_pred)),
        "rmse": float(np.sqrt(mean_squared_error(y_true, y_pred))),
        "r2": float(r2_score(y_true, y_pred)),
        "mape": calculate_mape(y_true, y_pred),
        "within_10pct": calculate_within_band(y_true, y_pred, 10),
        "within_20pct": calculate_within_band(y_true, y_pred, 20),
        "sample_count": len(y_true),
    }


def print_metrics(metrics: dict, currency: str = "CZK") -> None:
    """Pretty-print evaluation metrics."""
    print(f"\n{'='*50}")
    print("Model Evaluation Results")
    print(f"{'='*50}")
    print(f"  MAE:          {metrics['mae']:,.0f} {currency}")
    print(f"  RMSE:         {metrics['rmse']:,.0f} {currency}")
    print(f"  R²:           {metrics['r2']:.4f}")
    print(f"  MAPE:         {metrics['mape']:.2f}%")
    print(f"  Within ±10%:  {metrics['within_10pct']:.1f}%")
    print(f"  Within ±20%:  {metrics['within_20pct']:.1f}%")
    print(f"  Samples:      {metrics['sample_count']:,}")
    print(f"{'='*50}\n")
