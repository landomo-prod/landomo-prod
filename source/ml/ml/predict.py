#!/usr/bin/env python3
"""
CLI inference script for property price prediction.

Usage:
    python predict.py --model /app/models/czech_republic/apartment/v1.pkl --features '{"bedrooms":2,"sqm":65}'
    python predict.py --model /app/models/czech_republic/apartment/v1.pkl --features-file input.json

Output is JSON on stdout with __RESULT_JSON__ prefix for programmatic parsing.
"""

import argparse
import json
import sys
import time

import joblib
import numpy as np
import pandas as pd


def load_model(model_path: str):
    """Load a trained LightGBM model from disk."""
    return joblib.load(model_path)


def load_metadata(model_path: str) -> dict | None:
    """Load model metadata JSON (same path, .json extension)."""
    metadata_path = model_path.replace(".pkl", ".json")
    try:
        with open(metadata_path) as f:
            return json.load(f)
    except FileNotFoundError:
        return None


def predict_price(model, features: dict, metadata: dict | None = None) -> dict:
    """
    Predict price for a single property.

    Args:
        model: Loaded LightGBM Booster
        features: Dict of property features
        metadata: Optional model metadata for feature ordering

    Returns:
        Dict with predicted_price and metadata
    """
    start = time.time()

    # Use feature names from metadata if available, otherwise from model
    if metadata and "training_info" in metadata:
        feature_names = metadata["training_info"]["feature_names"]
    else:
        feature_names = model.feature_name()

    # Build DataFrame with correct column order
    row = {}
    for col in feature_names:
        val = features.get(col)
        row[col] = val

    df = pd.DataFrame([row])

    # Convert categorical columns to category dtype
    category = metadata.get("property_category", "apartment") if metadata else "apartment"
    cat_cols_map = {
        "apartment": ["construction_type", "condition", "heating_type", "energy_class", "furnished", "city"],
        "house": ["construction_type", "condition", "heating_type", "energy_class", "furnished", "city"],
        "land": ["city"],
        "commercial": ["condition", "city"],
    }
    for col in cat_cols_map.get(category, []):
        if col in df.columns:
            df[col] = df[col].astype("category")

    prediction = model.predict(df, num_iteration=model.best_iteration)[0]
    elapsed_ms = (time.time() - start) * 1000

    # Confidence interval: approximate using training MAE if available
    mae = None
    if metadata and "metrics" in metadata:
        mae = metadata["metrics"].get("mae")

    result = {
        "predicted_price": round(float(prediction)),
        "prediction_time_ms": round(elapsed_ms, 1),
    }

    if mae:
        result["confidence_interval"] = {
            "lower": round(float(prediction - 1.96 * mae)),
            "upper": round(float(prediction + 1.96 * mae)),
            "confidence_level": 0.95,
        }

    if metadata:
        result["model_version"] = f"{metadata.get('country', '')}_{metadata.get('property_category', '')}_v{metadata.get('version', '?')}"
        result["trained_at"] = metadata.get("trained_at")

    return result


def main():
    parser = argparse.ArgumentParser(description="Predict property price")
    parser.add_argument("--model", required=True, help="Path to .pkl model file")
    parser.add_argument("--features", default=None, help="JSON string of features")
    parser.add_argument("--features-file", default=None, help="Path to JSON file with features")
    args = parser.parse_args()

    if not args.features and not args.features_file:
        print("Error: provide --features or --features-file", file=sys.stderr)
        sys.exit(1)

    # Load features
    if args.features_file:
        with open(args.features_file) as f:
            features = json.load(f)
    else:
        features = json.loads(args.features)

    # Load model and metadata
    model = load_model(args.model)
    metadata = load_metadata(args.model)

    # Predict
    result = predict_price(model, features, metadata)

    # Output for programmatic parsing
    print(f"__RESULT_JSON__:{json.dumps(result)}")


if __name__ == "__main__":
    main()
