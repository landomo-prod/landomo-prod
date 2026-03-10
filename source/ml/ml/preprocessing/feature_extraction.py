"""
Feature extraction from PostgreSQL materialized views.

Queries ml_training_features_{category} views, converts to pandas DataFrame,
handles missing data, and engineers derived features.
"""

import os
from datetime import datetime

import numpy as np
import pandas as pd
import psycopg2


# Features per category that map to materialized view columns
APARTMENT_FEATURES = [
    "price",
    "bedrooms",
    "bathrooms",
    "sqm",
    "floor",
    "total_floors",
    "rooms",
    "has_elevator",
    "has_balcony",
    "has_parking",
    "has_basement",
    "has_loggia",
    "has_terrace",
    "has_garage",
    "year_built",
    "construction_type",
    "condition",
    "heating_type",
    "energy_class",
    "furnished",
    "renovation_year",
    "hoa_fees",
    "city",
    "district",
    "region",
    "neighbourhood",
    "municipality",
    "latitude",
    "longitude",
    "transaction_type",
]

HOUSE_FEATURES = [
    "price",
    "bedrooms",
    "bathrooms",
    "sqm_living",
    "sqm_plot",
    "total_floors",
    "rooms",
    "has_garden",
    "has_garage",
    "has_parking",
    "has_basement",
    "has_terrace",
    "has_pool",
    "year_built",
    "construction_type",
    "condition",
    "heating_type",
    "energy_class",
    "furnished",
    "renovation_year",
    "city",
    "district",
    "region",
    "neighbourhood",
    "municipality",
    "latitude",
    "longitude",
    "transaction_type",
]

LAND_FEATURES = [
    "price",
    "area_plot_sqm",
    "city",
    "district",
    "region",
    "neighbourhood",
    "municipality",
    "latitude",
    "longitude",
    "transaction_type",
]

COMMERCIAL_FEATURES = [
    "price",
    "sqm_total",
    "has_elevator",
    "has_parking",
    "bathrooms",
    "year_built",
    "condition",
    "city",
    "district",
    "region",
    "neighbourhood",
    "municipality",
    "latitude",
    "longitude",
    "transaction_type",
]

CATEGORY_FEATURES = {
    "apartment": APARTMENT_FEATURES,
    "house": HOUSE_FEATURES,
    "land": LAND_FEATURES,
    "commercial": COMMERCIAL_FEATURES,
}

# Numerical columns for median imputation (per category)
NUMERICAL_COLS = {
    "apartment": [
        "bedrooms", "bathrooms", "sqm", "floor", "total_floors", "rooms",
        "year_built", "renovation_year", "hoa_fees", "latitude", "longitude",
    ],
    "house": [
        "bedrooms", "bathrooms", "sqm_living", "sqm_plot", "total_floors",
        "rooms", "year_built", "renovation_year", "latitude", "longitude",
    ],
    "land": ["area_plot_sqm", "latitude", "longitude"],
    "commercial": [
        "sqm_total", "bathrooms", "year_built", "latitude", "longitude",
    ],
}

# Categorical columns for mode imputation
CATEGORICAL_COLS = {
    "apartment": [
        "construction_type", "condition", "heating_type", "energy_class",
        "furnished", "city", "district", "region", "neighbourhood", "municipality",
        "transaction_type",
    ],
    "house": [
        "construction_type", "condition", "heating_type", "energy_class",
        "furnished", "city", "district", "region", "neighbourhood", "municipality",
        "transaction_type",
    ],
    "land": ["city", "district", "region", "neighbourhood", "municipality", "transaction_type"],
    "commercial": [
        "condition", "city", "district", "region", "neighbourhood", "municipality",
        "transaction_type",
    ],
}

# Boolean columns (fill False for missing)
BOOLEAN_COLS = {
    "apartment": [
        "has_elevator", "has_balcony", "has_parking", "has_basement",
        "has_loggia", "has_terrace", "has_garage",
    ],
    "house": [
        "has_garden", "has_garage", "has_parking", "has_basement",
        "has_terrace", "has_pool",
    ],
    "land": [],
    "commercial": ["has_elevator", "has_parking"],
}


def get_db_connection(country: str) -> psycopg2.extensions.connection:
    """Create database connection for given country."""
    db_host = os.environ.get("DB_HOST", "localhost")
    db_port = int(os.environ.get("DB_PORT", "5432"))
    db_user = os.environ.get("DB_READ_USER", os.environ.get("DB_USER", "landomo"))
    db_password = os.environ.get("DB_PASSWORD", "landomo")
    db_name = os.environ.get("DB_NAME", f"landomo_{country}")

    return psycopg2.connect(
        host=db_host,
        port=db_port,
        user=db_user,
        password=db_password,
        dbname=db_name,
    )


def extract_features(
    country: str,
    category: str,
    transaction_type: str | None = None,
    min_price: float = 0,
    max_price: float | None = None,
    limit: int | None = None,
) -> pd.DataFrame:
    """
    Extract training features from PostgreSQL materialized view.

    Args:
        country: Country code (e.g., 'czech_republic')
        category: Property category ('apartment', 'house', 'land', 'commercial')
        transaction_type: Filter by 'sale' or 'rent' (None = both)
        min_price: Minimum price filter (default: 0, excludes free listings)
        max_price: Maximum price filter (None = no upper bound)
        limit: Max rows to fetch (None = all)

    Returns:
        pandas DataFrame with features and target (price)
    """
    if category not in CATEGORY_FEATURES:
        raise ValueError(f"Unknown category: {category}. Use: {list(CATEGORY_FEATURES.keys())}")

    view_name = f"ml_training_features_{category}"
    columns = CATEGORY_FEATURES[category]
    col_list = ", ".join(columns)

    where_clauses = ["price > %s"]
    params: list = [min_price]

    if transaction_type:
        where_clauses.append("transaction_type = %s")
        params.append(transaction_type)

    if max_price is not None:
        where_clauses.append("price <= %s")
        params.append(max_price)

    where_sql = " AND ".join(where_clauses)
    query = f"SELECT {col_list} FROM {view_name} WHERE {where_sql}"

    if limit:
        query += " LIMIT %s"
        params.append(limit)

    conn = get_db_connection(country)
    try:
        df = pd.read_sql_query(query, conn, params=params)
    finally:
        conn.close()

    print(f"Extracted {len(df)} rows from {view_name}")
    return df


def impute_missing(df: pd.DataFrame, category: str) -> pd.DataFrame:
    """
    Handle missing values with category-appropriate strategies.

    - Numerical: median imputation
    - Categorical: mode imputation (most frequent value)
    - Boolean: fill with False
    """
    df = df.copy()

    # Boolean columns: fill with False
    for col in BOOLEAN_COLS.get(category, []):
        if col in df.columns:
            df[col] = df[col].fillna(False).astype(bool)

    # Numerical columns: median imputation
    for col in NUMERICAL_COLS.get(category, []):
        if col in df.columns and df[col].isna().any():
            median_val = df[col].median()
            df[col] = df[col].fillna(median_val)

    # Categorical columns: mode imputation
    for col in CATEGORICAL_COLS.get(category, []):
        if col in df.columns and df[col].isna().any():
            mode_val = df[col].mode()
            if len(mode_val) > 0:
                df[col] = df[col].fillna(mode_val.iloc[0])
            else:
                df[col] = df[col].fillna("unknown")

    return df


def engineer_features(df: pd.DataFrame, category: str) -> pd.DataFrame:
    """
    Create derived features from raw data.

    - property_age: current_year - year_built
    - price_per_sqm: price / sqm (for apartment/house/commercial)
    - floor_ratio: floor / total_floors (for apartments)
    - years_since_renovation: current_year - renovation_year
    """
    df = df.copy()
    current_year = datetime.now().year

    # Property age
    if "year_built" in df.columns:
        df["property_age"] = current_year - df["year_built"]
        df["property_age"] = df["property_age"].clip(lower=0, upper=200)

    # Price per sqm
    sqm_col = {"apartment": "sqm", "house": "sqm_living", "commercial": "sqm_total"}.get(category)
    if sqm_col and sqm_col in df.columns:
        mask = df[sqm_col] > 0
        df.loc[mask, "price_per_sqm"] = df.loc[mask, "price"] / df.loc[mask, sqm_col]
        df["price_per_sqm"] = df["price_per_sqm"].fillna(0)

    # Floor ratio (apartments)
    if category == "apartment" and "floor" in df.columns and "total_floors" in df.columns:
        mask = df["total_floors"] > 0
        df.loc[mask, "floor_ratio"] = df.loc[mask, "floor"] / df.loc[mask, "total_floors"]
        df["floor_ratio"] = df["floor_ratio"].fillna(0.5)

    # Years since renovation
    if "renovation_year" in df.columns:
        has_reno = df["renovation_year"] > 0
        df.loc[has_reno, "years_since_renovation"] = (
            current_year - df.loc[has_reno, "renovation_year"]
        )
        df["years_since_renovation"] = df["years_since_renovation"].fillna(-1)

    return df


def prepare_training_data(
    country: str,
    category: str,
    transaction_type: str | None = "sale",
    min_price: float = 100000,
    max_price: float | None = None,
    limit: int | None = None,
) -> tuple[pd.DataFrame, pd.Series]:
    """
    Full pipeline: extract, impute, engineer features, return X and y.

    Returns:
        (X, y) tuple where X is features DataFrame and y is price Series
    """
    df = extract_features(
        country=country,
        category=category,
        transaction_type=transaction_type,
        min_price=min_price,
        max_price=max_price,
        limit=limit,
    )

    if len(df) == 0:
        raise ValueError(f"No training data found for {country}/{category}")

    print(f"Raw data shape: {df.shape}")
    print(f"Missing values:\n{df.isna().sum()[df.isna().sum() > 0]}")

    df = impute_missing(df, category)
    df = engineer_features(df, category)

    # Separate target
    y = df["price"].copy()
    X = df.drop(columns=["price"])

    # Remove non-feature columns
    drop_cols = [c for c in ["transaction_type"] if c in X.columns]
    X = X.drop(columns=drop_cols)

    print(f"Final feature shape: {X.shape}, target shape: {y.shape}")
    return X, y
