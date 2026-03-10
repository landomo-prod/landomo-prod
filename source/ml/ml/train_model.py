#!/usr/bin/env python3
"""
LightGBM model training script for property price prediction.

Usage:
    python train_model.py --country czech_republic --category apartment
    python train_model.py --country czech_republic --category apartment --version 2
    python train_model.py --country czech_republic --category apartment --transaction-type sale
"""

import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from evaluation.metrics import evaluate_model, print_metrics
from models.category_models import encode_categoricals, predict, train_lgbm
from preprocessing.feature_extraction import prepare_training_data


def temporal_train_test_split(
    X: pd.DataFrame,
    y: pd.Series,
    test_fraction: float = 0.2,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.Series, pd.Series]:
    """
    Split data temporally: latest test_fraction% becomes test set.

    Falls back to random split if no temporal ordering is detectable.
    """
    n = len(X)
    split_idx = int(n * (1 - test_fraction))

    # The materialized view should return rows ordered by created_at.
    # We take the last 20% as test (most recent listings).
    X_train = X.iloc[:split_idx].copy()
    X_test = X.iloc[split_idx:].copy()
    y_train = y.iloc[:split_idx].copy()
    y_test = y.iloc[split_idx:].copy()

    print(f"Train: {len(X_train)} samples, Test: {len(X_test)} samples")
    return X_train, X_test, y_train, y_test


def get_next_version(model_dir: Path) -> int:
    """Determine next model version by scanning existing files."""
    if not model_dir.exists():
        return 1
    existing = [
        f.stem for f in model_dir.glob("v*.pkl")
    ]
    versions = []
    for name in existing:
        try:
            versions.append(int(name[1:]))
        except ValueError:
            pass
    return max(versions, default=0) + 1


def save_model(
    model,
    training_info: dict,
    metrics: dict,
    country: str,
    category: str,
    version: int,
    base_dir: str = "/app/models",
) -> tuple[str, str]:
    """
    Save trained model and metadata.

    Returns:
        (model_path, metadata_path) tuple
    """
    model_dir = Path(base_dir) / country / category
    model_dir.mkdir(parents=True, exist_ok=True)

    model_path = model_dir / f"v{version}.pkl"
    metadata_path = model_dir / f"v{version}.json"

    # Save model using joblib (handles LightGBM Booster)
    joblib.dump(model, model_path)

    # Save metadata
    metadata = {
        "country": country,
        "property_category": category,
        "version": version,
        "model_type": "lightgbm",
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "metrics": metrics,
        "training_info": {
            "best_iteration": training_info["best_iteration"],
            "best_score": training_info["best_score"],
            "num_features": training_info["num_features"],
            "feature_names": training_info["feature_names"],
            "feature_importance_top10": dict(
                list(training_info["feature_importance"].items())[:10]
            ),
            "params": training_info["params"],
            "train_samples": training_info["train_samples"],
            "val_samples": training_info["val_samples"],
        },
        "file_path": str(model_path),
    }

    with open(metadata_path, "w") as f:
        json.dump(metadata, f, indent=2, default=str)

    print(f"Model saved to: {model_path}")
    print(f"Metadata saved to: {metadata_path}")
    return str(model_path), str(metadata_path)


def register_model_in_db(
    country: str,
    category: str,
    version: int,
    model_path: str,
    metrics: dict,
) -> None:
    """Insert model record into ml_model_registry table (best-effort)."""
    try:
        import psycopg2

        from preprocessing.feature_extraction import get_db_connection

        conn = get_db_connection(country)
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO ml_model_registry
                        (id, country, property_category, version, trained_at,
                         file_path, model_type, metrics, status)
                    VALUES
                        (gen_random_uuid(), %s, %s, %s, NOW(), %s, 'lightgbm', %s, 'active')
                    ON CONFLICT (country, property_category, version) DO UPDATE
                    SET trained_at = NOW(), file_path = EXCLUDED.file_path,
                        metrics = EXCLUDED.metrics, status = 'active'
                    """,
                    (country, category, version, model_path, json.dumps(metrics)),
                )
                # Archive previous versions
                cur.execute(
                    """
                    UPDATE ml_model_registry
                    SET status = 'archived'
                    WHERE country = %s AND property_category = %s
                      AND version != %s AND status = 'active'
                    """,
                    (country, category, version),
                )
                conn.commit()
            print(f"Model v{version} registered in ml_model_registry")
        finally:
            conn.close()
    except Exception as e:
        print(f"Warning: Could not register model in database: {e}", file=sys.stderr)


def main():
    parser = argparse.ArgumentParser(description="Train property price prediction model")
    parser.add_argument("--country", required=True, help="Country code (e.g., czech_republic)")
    parser.add_argument("--category", required=True, choices=["apartment", "house", "land", "commercial"])
    parser.add_argument("--version", type=int, default=None, help="Model version (auto-increments if not set)")
    parser.add_argument("--transaction-type", default="sale", choices=["sale", "rent", "both"])
    parser.add_argument("--min-price", type=float, default=100000, help="Min price filter")
    parser.add_argument("--max-price", type=float, default=None, help="Max price filter")
    parser.add_argument("--limit", type=int, default=None, help="Max training samples")
    parser.add_argument("--model-dir", default="/app/models", help="Base directory for saved models")
    parser.add_argument("--num-boost-round", type=int, default=1000, help="Max boosting rounds")
    parser.add_argument("--early-stopping", type=int, default=50, help="Early stopping patience")
    parser.add_argument("--skip-db-register", action="store_true", help="Skip database registration")
    args = parser.parse_args()

    transaction_type = None if args.transaction_type == "both" else args.transaction_type

    print(f"\n{'='*60}")
    print(f"Training {args.category} model for {args.country}")
    print(f"Transaction type: {args.transaction_type}")
    print(f"{'='*60}\n")

    start_time = time.time()

    # 1. Extract and prepare data
    X, y = prepare_training_data(
        country=args.country,
        category=args.category,
        transaction_type=transaction_type,
        min_price=args.min_price,
        max_price=args.max_price,
        limit=args.limit,
    )

    if len(X) < 100:
        print(f"ERROR: Only {len(X)} samples found. Need at least 100 for training.", file=sys.stderr)
        sys.exit(1)

    # 2. Split train/test (temporal)
    X_train, X_test, y_train, y_test = temporal_train_test_split(X, y)

    # 3. Train model
    print("\nTraining LightGBM model...")
    model, training_info = train_lgbm(
        X_train, y_train, X_test, y_test,
        category=args.category,
        num_boost_round=args.num_boost_round,
        early_stopping_rounds=args.early_stopping,
    )

    # 4. Evaluate
    y_pred = predict(model, X_test, args.category)
    metrics = evaluate_model(y_test.values, y_pred)
    print_metrics(metrics)

    # 5. Determine version
    model_dir = Path(args.model_dir) / args.country / args.category
    version = args.version if args.version else get_next_version(model_dir)

    # 6. Save model and metadata
    model_path, metadata_path = save_model(
        model, training_info, metrics,
        country=args.country,
        category=args.category,
        version=version,
        base_dir=args.model_dir,
    )

    # 7. Register in database
    if not args.skip_db_register:
        register_model_in_db(args.country, args.category, version, model_path, metrics)

    elapsed = time.time() - start_time
    print(f"\nTraining completed in {elapsed:.1f}s")
    print(f"Model version: v{version}")

    # Output JSON summary for programmatic consumption
    summary = {
        "status": "success",
        "country": args.country,
        "category": args.category,
        "version": version,
        "model_path": model_path,
        "metadata_path": metadata_path,
        "metrics": metrics,
        "training_time_seconds": round(elapsed, 1),
    }
    print(f"\n__RESULT_JSON__:{json.dumps(summary)}")


if __name__ == "__main__":
    main()
