"""Data cleaning, missing-value imputation, duplicate removal, and validation module."""

from __future__ import annotations

from typing import Any, Dict, Tuple

import numpy as np
import pandas as pd

DAY_ORDER = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
]


def _classify_time_period(hour: int) -> str:
    """Group an hour (0-23) into human-readable campus time periods."""
    if 5 <= hour < 12:
        return "Morning (05:00-11:59)"
    if 12 <= hour < 16:
        return "Afternoon (12:00-15:59)"
    if 16 <= hour < 20:
        return "Evening (16:00-19:59)"
    return "Night (20:00-04:59)"


def clean_parking_data(raw_df: pd.DataFrame) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """Clean, validate, and enrich campus parking records.

    Handles:
    - Empty datasets safely
    - Missing values in string/numeric columns
    - Duplicate row detection and removal
    - Invalid Total_Capacity values (<= 0) and negative Occupied_Spaces
    - Safe division preventing ZeroDivisionError
    - Recalculation of Available_Spaces and Occupancy_Percentage
    """
    if raw_df is None or raw_df.empty:
        empty_cols = [
            "Date",
            "Time",
            "Day",
            "Parking_Location",
            "Total_Capacity",
            "Occupied_Spaces",
            "Available_Spaces",
            "Occupancy_Percentage",
            "Vehicle_Type",
            "Hour",
            "Time_Period",
        ]
        return pd.DataFrame(columns=empty_cols), {
            "raw_rows": 0,
            "cleaned_rows": 0,
            "duplicates_removed": 0,
            "missing_values_handled": 0,
            "invalid_capacity_rows_dropped": 0,
            "clamped_occupied_rows": 0,
        }

    df = raw_df.copy()
    raw_rows = int(len(df))
    missing_values_handled = int(df.isna().sum().sum())

    # Clean string fields
    for str_col in ["Parking_Location", "Vehicle_Type", "Time", "Day"]:
        if str_col in df.columns:
            df[str_col] = df[str_col].astype(str).str.strip()
            df.loc[df[str_col].isin(["", "nan", "None", "null", "NaN"]), str_col] = np.nan

    # Parse dates and drop rows with unparseable dates
    df["Date_dt"] = pd.to_datetime(df["Date"], errors="coerce")
    df = df.dropna(subset=["Date_dt"]).copy()
    df["Date"] = df["Date_dt"].dt.strftime("%Y-%m-%d")

    # Fill or normalize Day from Date_dt when missing or invalid
    derived_day = df["Date_dt"].dt.day_name()
    if "Day" not in df.columns:
        df["Day"] = derived_day
    else:
        df["Day"] = df["Day"].where(df["Day"].isin(DAY_ORDER), derived_day)

    # Parse Time and extract Hour
    df["Time"] = df["Time"].fillna("09:00")
    parsed_time = pd.to_datetime(df["Time"], format="%H:%M", errors="coerce")
    fallback_time = pd.to_datetime(df["Time"], errors="coerce")
    parsed_time = parsed_time.fillna(fallback_time)
    df["Hour"] = parsed_time.dt.hour.fillna(9).astype(int).clip(0, 23)
    df["Time"] = df["Hour"].apply(lambda h: f"{h:02d}:00")
    df["Time_Period"] = df["Hour"].apply(_classify_time_period)

    # Fill missing Parking_Location & Vehicle_Type
    df["Parking_Location"] = df["Parking_Location"].fillna("Unassigned Parking")
    df["Vehicle_Type"] = df["Vehicle_Type"].fillna("Car")

    # Convert capacity & occupied to numeric
    df["Total_Capacity"] = pd.to_numeric(df["Total_Capacity"], errors="coerce")
    df["Occupied_Spaces"] = pd.to_numeric(df["Occupied_Spaces"], errors="coerce")

    # Drop rows with invalid/non-positive capacity (prevents division by zero)
    valid_capacity_mask = df["Total_Capacity"].notna() & (df["Total_Capacity"] > 0)
    invalid_capacity_rows_dropped = int((~valid_capacity_mask).sum())
    df = df.loc[valid_capacity_mask].copy()

    if df.empty:
        return df.drop(columns=["Date_dt"], errors="ignore"), {
            "raw_rows": raw_rows,
            "cleaned_rows": 0,
            "duplicates_removed": 0,
            "missing_values_handled": missing_values_handled,
            "invalid_capacity_rows_dropped": invalid_capacity_rows_dropped,
            "clamped_occupied_rows": 0,
        }

    # Clamp valid Occupied_Spaces between 0 and Total_Capacity before computing medians
    valid_occ = df["Occupied_Spaces"].notna()
    out_of_bounds_mask = valid_occ & (
        (df["Occupied_Spaces"] < 0) | (df["Occupied_Spaces"] > df["Total_Capacity"])
    )
    clamped_occupied_rows = int(out_of_bounds_mask.sum())
    df.loc[valid_occ, "Occupied_Spaces"] = df.loc[valid_occ, "Occupied_Spaces"].clip(
        lower=0, upper=df.loc[valid_occ, "Total_Capacity"]
    )

    # Impute missing Occupied_Spaces with median occupancy per location (or 0)
    if df["Occupied_Spaces"].isna().any():
        loc_medians = df.groupby("Parking_Location")["Occupied_Spaces"].transform("median")
        df["Occupied_Spaces"] = df["Occupied_Spaces"].fillna(loc_medians).fillna(0)
        df["Occupied_Spaces"] = df["Occupied_Spaces"].clip(
            lower=0, upper=df["Total_Capacity"]
        )

    df["Total_Capacity"] = df["Total_Capacity"].round().astype(int)
    df["Occupied_Spaces"] = df["Occupied_Spaces"].round().astype(int)

    # Detect and remove duplicate records based on Date, Time, Parking_Location, Vehicle_Type
    before_dedup = len(df)
    df = df.drop_duplicates(
        subset=["Date", "Time", "Parking_Location", "Vehicle_Type", "Occupied_Spaces"],
        keep="first",
    ).copy()
    duplicates_removed = int(before_dedup - len(df))

    # Recompute Available_Spaces & Occupancy_Percentage with zero-division guard
    df["Available_Spaces"] = (df["Total_Capacity"] - df["Occupied_Spaces"]).clip(lower=0)
    df["Occupancy_Percentage"] = np.where(
        df["Total_Capacity"] > 0,
        np.round((df["Occupied_Spaces"] / df["Total_Capacity"]) * 100.0, 2),
        0.0,
    )

    df = df.drop(columns=["Date_dt"], errors="ignore").sort_values(
        by=["Date", "Hour", "Parking_Location"], ascending=[True, True, True]
    ).reset_index(drop=True)

    report = {
        "raw_rows": raw_rows,
        "cleaned_rows": int(len(df)),
        "duplicates_removed": duplicates_removed,
        "missing_values_handled": missing_values_handled,
        "invalid_capacity_rows_dropped": invalid_capacity_rows_dropped,
        "clamped_occupied_rows": clamped_occupied_rows,
    }
    return df, report
