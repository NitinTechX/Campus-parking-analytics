"""Data loading and schema validation utilities for Campus Parking Usage Analysis."""

from __future__ import annotations

from pathlib import Path
from typing import IO, Tuple, Union

import pandas as pd

REQUIRED_COLUMNS = [
    "Date",
    "Time",
    "Day",
    "Parking_Location",
    "Total_Capacity",
    "Occupied_Spaces",
    "Available_Spaces",
    "Occupancy_Percentage",
    "Vehicle_Type",
]

CORE_UPLOAD_COLUMNS = [
    "Date",
    "Time",
    "Parking_Location",
    "Total_Capacity",
    "Occupied_Spaces",
]

SAMPLE_LOCATIONS = [
    "Main Gate Parking",
    "Academic Block Parking",
    "Library Parking",
    "Hostel Parking",
    "Canteen Parking",
    "Sports Complex Parking",
]

VEHICLE_TYPES = ["Car", "Two-Wheeler", "EV", "Faculty Van"]

DEFAULT_SAMPLE_PATH = Path(__file__).resolve().parent.parent / "data" / "sample_parking_data.csv"


def load_sample_dataset(path: Union[str, Path, None] = None) -> Tuple[pd.DataFrame, str | None]:
    """Load the bundled simulated campus parking dataset."""
    target = Path(path) if path else DEFAULT_SAMPLE_PATH
    if not target.exists():
        return pd.DataFrame(columns=REQUIRED_COLUMNS), (
            f"Sample dataset file was not found at '{target}'."
        )
    return load_parking_csv(target)


def load_parking_csv(
    source: Union[str, Path, IO[bytes], IO[str]]
) -> Tuple[pd.DataFrame, str | None]:
    """Read and validate a campus parking CSV file.

    Returns a tuple of (DataFrame, error_message). When valid, error_message is None.
    """
    try:
        df = pd.read_csv(source)
    except pd.errors.EmptyDataError:
        return pd.DataFrame(columns=REQUIRED_COLUMNS), (
            "The uploaded CSV file is empty. Please upload a file containing header columns and rows."
        )
    except UnicodeDecodeError:
        return pd.DataFrame(columns=REQUIRED_COLUMNS), (
            "Unable to decode the CSV file. Please save the file using UTF-8 encoding."
        )
    except Exception as exc:  # noqa: BLE001
        return pd.DataFrame(columns=REQUIRED_COLUMNS), f"Failed to parse CSV file: {exc}"

    if df.empty:
        return pd.DataFrame(columns=REQUIRED_COLUMNS), (
            "The uploaded dataset contains zero data rows. Add at least one parking record and try again."
        )

    # Normalize column whitespace
    df.columns = [str(col).strip() for col in df.columns]

    missing_core = [col for col in CORE_UPLOAD_COLUMNS if col not in df.columns]
    if missing_core:
        return pd.DataFrame(columns=REQUIRED_COLUMNS), (
            "Missing required column(s): "
            + ", ".join(missing_core)
            + ". Download the sample CSV template to verify the expected schema."
        )

    # Optional columns can be reconstructed during cleaning if omitted
    if "Day" not in df.columns:
        df["Day"] = None
    if "Available_Spaces" not in df.columns:
        df["Available_Spaces"] = None
    if "Occupancy_Percentage" not in df.columns:
        df["Occupancy_Percentage"] = None
    if "Vehicle_Type" not in df.columns:
        df["Vehicle_Type"] = "Car"

    # Validate numeric convertibility on capacity and occupied columns
    cap_numeric = pd.to_numeric(df["Total_Capacity"], errors="coerce")
    occ_numeric = pd.to_numeric(df["Occupied_Spaces"], errors="coerce")
    if cap_numeric.isna().all() or occ_numeric.isna().all():
        return pd.DataFrame(columns=REQUIRED_COLUMNS), (
            "Columns 'Total_Capacity' and 'Occupied_Spaces' must contain numeric values."
        )

    # Validate dates can be parsed for at least one row
    parsed_dates = pd.to_datetime(df["Date"], errors="coerce")
    if parsed_dates.isna().all():
        return pd.DataFrame(columns=REQUIRED_COLUMNS), (
            "Column 'Date' does not contain recognizable dates (expected YYYY-MM-DD)."
        )

    return df[REQUIRED_COLUMNS].copy(), None


def generate_sample_template_csv() -> str:
    """Return a clean downloadable CSV template string with realistic simulated rows."""
    template_rows = [
        {
            "Date": "2026-10-05",
            "Time": "09:00",
            "Day": "Monday",
            "Parking_Location": "Main Gate Parking",
            "Total_Capacity": 150,
            "Occupied_Spaces": 132,
            "Available_Spaces": 18,
            "Occupancy_Percentage": 88.0,
            "Vehicle_Type": "Car",
        },
        {
            "Date": "2026-10-05",
            "Time": "10:00",
            "Day": "Monday",
            "Parking_Location": "Academic Block Parking",
            "Total_Capacity": 200,
            "Occupied_Spaces": 176,
            "Available_Spaces": 24,
            "Occupancy_Percentage": 88.0,
            "Vehicle_Type": "Two-Wheeler",
        },
        {
            "Date": "2026-10-05",
            "Time": "12:00",
            "Day": "Monday",
            "Parking_Location": "Library Parking",
            "Total_Capacity": 120,
            "Occupied_Spaces": 58,
            "Available_Spaces": 62,
            "Occupancy_Percentage": 48.33,
            "Vehicle_Type": "EV",
        },
    ]
    return pd.DataFrame(template_rows).to_csv(index=False)
