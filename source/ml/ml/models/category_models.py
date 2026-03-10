"""
Category-specific LightGBM model wrappers.

Handles categorical feature encoding and category-specific hyperparameters.
"""

import lightgbm as lgb
import numpy as np
import pandas as pd


# LightGBM categorical feature names per category
CATEGORICAL_FEATURE_NAMES = {
    "apartment": ["construction_type", "condition", "heating_type", "energy_class", "furnished", "city", "district", "region", "municipality"],
    "house": ["construction_type", "condition", "heating_type", "energy_class", "furnished", "city", "district", "region", "municipality"],
    "land": ["city", "district", "region", "municipality"],
    "commercial": ["condition", "city", "district", "region", "municipality"],
}

# Default hyperparameters
DEFAULT_PARAMS = {
    "objective": "regression",
    "metric": "mae",
    "num_leaves": 31,
    "learning_rate": 0.05,
    "feature_fraction": 0.8,
    "bagging_fraction": 0.8,
    "bagging_freq": 5,
    "min_child_samples": 20,
    "verbose": -1,
    "n_jobs": -1,
    "seed": 42,
}

# Category-specific parameter overrides
CATEGORY_PARAMS = {
    "apartment": {"num_leaves": 63, "min_child_samples": 20},
    "house": {"num_leaves": 31, "min_child_samples": 30},
    "land": {"num_leaves": 15, "min_child_samples": 50},
    "commercial": {"num_leaves": 31, "min_child_samples": 30},
}


def get_model_params(category: str, custom_params: dict | None = None) -> dict:
    """Get LightGBM parameters for a category, with optional overrides."""
    params = {**DEFAULT_PARAMS}
    params.update(CATEGORY_PARAMS.get(category, {}))
    if custom_params:
        params.update(custom_params)
    return params


def encode_categoricals(df: pd.DataFrame, category: str) -> pd.DataFrame:
    """
    Convert categorical columns to pandas Categorical type for LightGBM native handling.
    """
    df = df.copy()
    cat_cols = CATEGORICAL_FEATURE_NAMES.get(category, [])
    for col in cat_cols:
        if col in df.columns:
            df[col] = df[col].astype("category")
    return df


def get_categorical_feature_indices(df: pd.DataFrame, category: str) -> list[int]:
    """Get column indices of categorical features for LightGBM."""
    cat_cols = CATEGORICAL_FEATURE_NAMES.get(category, [])
    return [i for i, col in enumerate(df.columns) if col in cat_cols]


def train_lgbm(
    X_train: pd.DataFrame,
    y_train: pd.Series,
    X_val: pd.DataFrame,
    y_val: pd.Series,
    category: str,
    num_boost_round: int = 1000,
    early_stopping_rounds: int = 50,
    custom_params: dict | None = None,
) -> tuple[lgb.Booster, dict]:
    """
    Train a LightGBM model for a property category.

    Returns:
        (model, training_info) tuple
    """
    params = get_model_params(category, custom_params)

    X_train = encode_categoricals(X_train, category)
    X_val = encode_categoricals(X_val, category)
    cat_indices = get_categorical_feature_indices(X_train, category)

    train_data = lgb.Dataset(
        X_train, label=y_train,
        categorical_feature=cat_indices if cat_indices else "auto",
        free_raw_data=False,
    )
    val_data = lgb.Dataset(
        X_val, label=y_val,
        reference=train_data,
        categorical_feature=cat_indices if cat_indices else "auto",
        free_raw_data=False,
    )

    callbacks = [
        lgb.early_stopping(stopping_rounds=early_stopping_rounds),
        lgb.log_evaluation(period=100),
    ]

    model = lgb.train(
        params,
        train_data,
        num_boost_round=num_boost_round,
        valid_sets=[train_data, val_data],
        valid_names=["train", "val"],
        callbacks=callbacks,
    )

    # Feature importance
    importance = dict(zip(
        model.feature_name(),
        model.feature_importance(importance_type="gain").tolist(),
    ))
    sorted_importance = dict(sorted(importance.items(), key=lambda x: x[1], reverse=True))

    training_info = {
        "best_iteration": model.best_iteration,
        "best_score": float(model.best_score["val"]["l1"]),
        "num_features": len(X_train.columns),
        "feature_names": list(X_train.columns),
        "feature_importance": sorted_importance,
        "params": params,
        "train_samples": len(X_train),
        "val_samples": len(X_val),
    }

    return model, training_info


def predict(model: lgb.Booster, X: pd.DataFrame, category: str) -> np.ndarray:
    """Run prediction with proper categorical encoding."""
    X = encode_categoricals(X, category)
    return model.predict(X, num_iteration=model.best_iteration)
