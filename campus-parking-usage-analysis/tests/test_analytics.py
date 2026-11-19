"""Unit tests for data loading, cleaning edge cases, and analytics calculations."""

import io
import unittest

import pandas as pd

from modules.analytics import (
    calculate_kpis,
    compute_occupancy_alerts,
    generate_insights_and_recommendations,
)
from modules.data_cleaning import clean_parking_data
from modules.data_loader import load_parking_csv, load_sample_dataset


class TestCampusParkingPipeline(unittest.TestCase):
    def test_sample_dataset_loads_and_exceeds_300_rows(self) -> None:
        raw_df, err = load_sample_dataset()
        self.assertIsNone(err)
        self.assertGreaterEqual(len(raw_df), 300)
        cleaned, report = clean_parking_data(raw_df)
        self.assertGreaterEqual(report["cleaned_rows"], 300)
        self.assertFalse(cleaned.empty)

    def test_empty_dataset_handling(self) -> None:
        empty_csv = io.StringIO("Date,Time,Parking_Location,Total_Capacity,Occupied_Spaces\n")
        df, err = load_parking_csv(empty_csv)
        self.assertIsNotNone(err)
        self.assertTrue(df.empty)

        cleaned, report = clean_parking_data(pd.DataFrame())
        self.assertTrue(cleaned.empty)
        self.assertEqual(report["cleaned_rows"], 0)
        kpis = calculate_kpis(cleaned)
        self.assertEqual(kpis["total_capacity"], 0)
        self.assertEqual(kpis["avg_occupancy_pct"], 0.0)

    def test_missing_values_duplicates_and_invalid_capacity(self) -> None:
        csv_text = (
            "Date,Time,Day,Parking_Location,Total_Capacity,Occupied_Spaces,Vehicle_Type\n"
            "2026-10-05,09:00,Monday,Main Gate Parking,100,85,Car\n"
            "2026-10-05,09:00,Monday,Main Gate Parking,100,85,Car\n"
            "2026-10-05,10:00,,Library Parking,0,10,Car\n"
            "2026-10-05,11:00,,Library Parking,120,150,EV\n"
            "2026-10-05,12:00,,Library Parking,120,,\n"
        )
        raw_df, err = load_parking_csv(io.StringIO(csv_text))
        self.assertIsNone(err)
        cleaned, report = clean_parking_data(raw_df)

        self.assertEqual(report["invalid_capacity_rows_dropped"], 1)
        self.assertEqual(report["duplicates_removed"], 1)
        self.assertEqual(report["clamped_occupied_rows"], 1)
        self.assertEqual(len(cleaned), 3)
        self.assertTrue((cleaned["Available_Spaces"] >= 0).all())
        self.assertTrue((cleaned["Occupancy_Percentage"] <= 100.0).all())

    def test_alerts_and_dynamic_insights(self) -> None:
        df = pd.DataFrame(
            [
                {
                    "Date": "2026-10-05",
                    "Time": "09:00",
                    "Day": "Monday",
                    "Parking_Location": "Main Gate Parking",
                    "Total_Capacity": 100,
                    "Occupied_Spaces": 90,
                    "Vehicle_Type": "Car",
                },
                {
                    "Date": "2026-10-05",
                    "Time": "09:00",
                    "Day": "Monday",
                    "Parking_Location": "Sports Complex Parking",
                    "Total_Capacity": 100,
                    "Occupied_Spaces": 20,
                    "Vehicle_Type": "Two-Wheeler",
                },
            ]
        )
        cleaned, _ = clean_parking_data(df)
        alerts = compute_occupancy_alerts(cleaned)
        self.assertEqual(len(alerts["high_alerts"]), 1)
        self.assertEqual(alerts["high_alerts"][0]["location"], "Main Gate Parking")
        self.assertEqual(len(alerts["low_alerts"]), 1)
        self.assertEqual(alerts["low_alerts"][0]["location"], "Sports Complex Parking")

        insights = generate_insights_and_recommendations(cleaned)
        self.assertTrue(any("Main Gate Parking" in s for s in insights["insights"]))


if __name__ == "__main__":
    unittest.main()
