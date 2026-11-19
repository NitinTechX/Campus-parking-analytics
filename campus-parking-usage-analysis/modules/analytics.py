"""Core Pandas & NumPy analytics engine for Campus Parking Usage Analysis."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List

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


def calculate_kpis(df: pd.DataFrame) -> Dict[str, Any]:
    """Compute the 6 core dashboard KPIs dynamically from the filtered dataset."""
    if df is None or df.empty:
        return {
            "total_capacity": 0,
            "occupied_spaces": 0,
            "available_spaces": 0,
            "avg_occupancy_pct": 0.0,
            "peak_hour_label": "N/A",
            "peak_hour_occupancy": 0.0,
            "most_crowded_location": "N/A",
            "most_crowded_occupancy": 0.0,
            "record_count": 0,
        }

    # Physical capacity across the selected parking zones
    loc_summary = (
        df.groupby("Parking_Location", as_index=False)
        .agg(
            zone_capacity=("Total_Capacity", "max"),
            avg_occupied=("Occupied_Spaces", "mean"),
            avg_occupancy_pct=("Occupancy_Percentage", "mean"),
        )
    )

    total_capacity = int(round(loc_summary["zone_capacity"].sum()))
    occupied_spaces = int(round(loc_summary["avg_occupied"].sum()))
    occupied_spaces = min(occupied_spaces, total_capacity)
    available_spaces = max(total_capacity - occupied_spaces, 0)

    avg_occupancy_pct = float(np.round(df["Occupancy_Percentage"].mean(), 2))

    # Peak Parking Hour
    hourly = df.groupby("Hour", as_index=False)["Occupancy_Percentage"].mean()
    peak_row = hourly.loc[hourly["Occupancy_Percentage"].idxmax()]
    peak_hour_int = int(peak_row["Hour"])
    peak_hour_label = f"{peak_hour_int:02d}:00"
    peak_hour_occupancy = float(np.round(peak_row["Occupancy_Percentage"], 2))

    # Most Crowded Parking Location
    crowded_row = loc_summary.loc[loc_summary["avg_occupancy_pct"].idxmax()]
    most_crowded_location = str(crowded_row["Parking_Location"])
    most_crowded_occupancy = float(np.round(crowded_row["avg_occupancy_pct"], 2))

    return {
        "total_capacity": total_capacity,
        "occupied_spaces": occupied_spaces,
        "available_spaces": available_spaces,
        "avg_occupancy_pct": avg_occupancy_pct,
        "peak_hour_label": peak_hour_label,
        "peak_hour_occupancy": peak_hour_occupancy,
        "most_crowded_location": most_crowded_location,
        "most_crowded_occupancy": most_crowded_occupancy,
        "record_count": int(len(df)),
    }


def compute_hourly_usage(df: pd.DataFrame) -> pd.DataFrame:
    """Analyze average occupancy and space counts grouped by hour."""
    if df is None or df.empty:
        return pd.DataFrame(
            columns=["Hour", "Time_Label", "Avg_Occupancy_Pct", "Avg_Occupied", "Avg_Available"]
        )

    hourly = (
        df.groupby("Hour", as_index=False)
        .agg(
            Avg_Occupancy_Pct=("Occupancy_Percentage", "mean"),
            Avg_Occupied=("Occupied_Spaces", "mean"),
            Avg_Available=("Available_Spaces", "mean"),
            Observations=("Occupancy_Percentage", "count"),
        )
        .sort_values("Hour")
    )
    hourly["Time_Label"] = hourly["Hour"].apply(lambda h: f"{int(h):02d}:00")
    hourly["Avg_Occupancy_Pct"] = hourly["Avg_Occupancy_Pct"].round(2)
    hourly["Avg_Occupied"] = hourly["Avg_Occupied"].round(1)
    hourly["Avg_Available"] = hourly["Avg_Available"].round(1)
    return hourly


def compute_day_usage(df: pd.DataFrame) -> pd.DataFrame:
    """Compare parking occupancy across Monday through Sunday."""
    if df is None or df.empty:
        return pd.DataFrame(
            columns=["Day", "Avg_Occupancy_Pct", "Avg_Occupied", "Avg_Available"]
        )

    day_df = df.groupby("Day", as_index=False).agg(
        Avg_Occupancy_Pct=("Occupancy_Percentage", "mean"),
        Avg_Occupied=("Occupied_Spaces", "mean"),
        Avg_Available=("Available_Spaces", "mean"),
        Observations=("Occupancy_Percentage", "count"),
    )
    day_df["Day"] = pd.Categorical(day_df["Day"], categories=DAY_ORDER, ordered=True)
    day_df = day_df.sort_values("Day").dropna(subset=["Day"]).reset_index(drop=True)
    day_df["Avg_Occupancy_Pct"] = day_df["Avg_Occupancy_Pct"].round(2)
    day_df["Avg_Occupied"] = day_df["Avg_Occupied"].round(1)
    day_df["Avg_Available"] = day_df["Avg_Available"].round(1)
    return day_df


def compute_location_usage(df: pd.DataFrame) -> pd.DataFrame:
    """Compare parking zones by capacity, occupied spaces, available spaces, and occupancy %."""
    if df is None or df.empty:
        return pd.DataFrame(
            columns=[
                "Parking_Location",
                "Total_Capacity",
                "Avg_Occupied",
                "Avg_Available",
                "Avg_Occupancy_Pct",
                "Peak_Occupancy_Pct",
                "Status",
            ]
        )

    loc_df = (
        df.groupby("Parking_Location", as_index=False)
        .agg(
            Total_Capacity=("Total_Capacity", "max"),
            Avg_Occupied=("Occupied_Spaces", "mean"),
            Avg_Available=("Available_Spaces", "mean"),
            Avg_Occupancy_Pct=("Occupancy_Percentage", "mean"),
            Peak_Occupancy_Pct=("Occupancy_Percentage", "max"),
            Observations=("Occupancy_Percentage", "count"),
        )
        .sort_values("Avg_Occupancy_Pct", ascending=False)
        .reset_index(drop=True)
    )

    loc_df["Avg_Occupied"] = loc_df["Avg_Occupied"].round(1)
    loc_df["Avg_Available"] = loc_df["Avg_Available"].round(1)
    loc_df["Avg_Occupancy_Pct"] = loc_df["Avg_Occupancy_Pct"].round(2)
    loc_df["Peak_Occupancy_Pct"] = loc_df["Peak_Occupancy_Pct"].round(2)

    def _status(pct: float) -> str:
        if pct > 80.0:
            return "High Congestion (>80%)"
        if pct < 30.0:
            return "Underutilized (<30%)"
        return "Balanced (30%-80%)"

    loc_df["Status"] = loc_df["Avg_Occupancy_Pct"].apply(_status)
    return loc_df


def compute_day_hour_matrix(df: pd.DataFrame) -> pd.DataFrame:
    """Create a Day (rows) x Hour (columns) pivot matrix of average occupancy %."""
    if df is None or df.empty:
        return pd.DataFrame()

    pivot = df.pivot_table(
        index="Day",
        columns="Hour",
        values="Occupancy_Percentage",
        aggfunc="mean",
    )
    existing_days = [d for d in DAY_ORDER if d in pivot.index]
    pivot = pivot.reindex(existing_days)
    pivot = pivot.reindex(sorted(pivot.columns), axis=1)
    pivot.columns = [f"{int(h):02d}:00" for h in pivot.columns]
    return pivot.round(2)


def compute_vehicle_distribution(df: pd.DataFrame) -> pd.DataFrame:
    """Aggregate records and occupied spaces by Vehicle_Type."""
    if df is None or df.empty:
        return pd.DataFrame(columns=["Vehicle_Type", "Record_Count", "Total_Occupied", "Share_Pct"])

    veh = (
        df.groupby("Vehicle_Type", as_index=False)
        .agg(
            Record_Count=("Vehicle_Type", "count"),
            Total_Occupied=("Occupied_Spaces", "sum"),
        )
        .sort_values("Total_Occupied", ascending=False)
        .reset_index(drop=True)
    )
    total_occ = veh["Total_Occupied"].sum()
    veh["Share_Pct"] = np.where(
        total_occ > 0,
        np.round((veh["Total_Occupied"] / total_occ) * 100.0, 2),
        0.0,
    )
    return veh


def compute_date_trends(df: pd.DataFrame) -> pd.DataFrame:
    """Compute date-wise average occupancy and occupied volume trends."""
    if df is None or df.empty:
        return pd.DataFrame(columns=["Date", "Avg_Occupancy_Pct", "Avg_Occupied"])

    trend = (
        df.groupby("Date", as_index=False)
        .agg(
            Avg_Occupancy_Pct=("Occupancy_Percentage", "mean"),
            Avg_Occupied=("Occupied_Spaces", "mean"),
        )
        .sort_values("Date")
        .reset_index(drop=True)
    )
    trend["Avg_Occupancy_Pct"] = trend["Avg_Occupancy_Pct"].round(2)
    trend["Avg_Occupied"] = trend["Avg_Occupied"].round(1)
    return trend


def detect_peak_periods(df: pd.DataFrame) -> Dict[str, Any]:
    """Detect peak hours, busiest days, and crowded locations (>80% occupancy)."""
    if df is None or df.empty:
        return {
            "peak_hours": [],
            "busiest_day": None,
            "quietest_day": None,
            "crowded_locations": [],
            "underutilized_locations": [],
        }

    hourly = compute_hourly_usage(df)
    top_hours = hourly.sort_values("Avg_Occupancy_Pct", ascending=False).head(3)
    peak_hours = [
        {"time": row["Time_Label"], "occupancy_pct": float(row["Avg_Occupancy_Pct"])}
        for _, row in top_hours.iterrows()
    ]

    daily = compute_day_usage(df)
    busiest_row = daily.loc[daily["Avg_Occupancy_Pct"].idxmax()]
    quietest_row = daily.loc[daily["Avg_Occupancy_Pct"].idxmin()]

    loc = compute_location_usage(df)
    crowded = loc[loc["Avg_Occupancy_Pct"] > 80.0]["Parking_Location"].tolist()
    underutilized = loc[loc["Avg_Occupancy_Pct"] < 30.0]["Parking_Location"].tolist()

    return {
        "peak_hours": peak_hours,
        "busiest_day": {
            "day": str(busiest_row["Day"]),
            "occupancy_pct": float(busiest_row["Avg_Occupancy_Pct"]),
        },
        "quietest_day": {
            "day": str(quietest_row["Day"]),
            "occupancy_pct": float(quietest_row["Avg_Occupancy_Pct"]),
        },
        "crowded_locations": crowded,
        "underutilized_locations": underutilized,
    }


def compute_occupancy_alerts(df: pd.DataFrame) -> Dict[str, List[Dict[str, Any]]]:
    """Identify high occupancy (>80%) and low occupancy (<30%) zones and peak windows."""
    if df is None or df.empty:
        return {"high_alerts": [], "low_alerts": []}

    loc_df = compute_location_usage(df)
    high_alerts: List[Dict[str, Any]] = []
    low_alerts: List[Dict[str, Any]] = []

    for _, row in loc_df.iterrows():
        avg_pct = float(row["Avg_Occupancy_Pct"])
        peak_pct = float(row["Peak_Occupancy_Pct"])
        loc_name = str(row["Parking_Location"])

        if avg_pct > 80.0 or peak_pct > 80.0:
            high_alerts.append(
                {
                    "location": loc_name,
                    "avg_occupancy_pct": avg_pct,
                    "peak_occupancy_pct": peak_pct,
                    "avg_available": float(row["Avg_Available"]),
                    "severity": "Critical" if avg_pct > 80.0 else "Peak Surge",
                }
            )
        if avg_pct < 30.0:
            low_alerts.append(
                {
                    "location": loc_name,
                    "avg_occupancy_pct": avg_pct,
                    "avg_available": float(row["Avg_Available"]),
                }
            )

    return {"high_alerts": high_alerts, "low_alerts": low_alerts}


def generate_insights_and_recommendations(df: pd.DataFrame) -> Dict[str, List[str]]:
    """Generate automated, purely data-driven insights and operational recommendations."""
    if df is None or df.empty:
        return {
            "insights": ["No records match the current filters. Adjust or reset filters to generate insights."],
            "recommendations": ["Broaden the selected date, location, or time filters to inspect campus demand."],
        }

    kpis = calculate_kpis(df)
    loc_df = compute_location_usage(df)
    hourly_df = compute_hourly_usage(df)
    day_df = compute_day_usage(df)
    veh_df = compute_vehicle_distribution(df)

    insights: List[str] = []
    recommendations: List[str] = []

    # 1. Location insight
    top_loc = loc_df.iloc[0]
    bottom_loc = loc_df.iloc[-1]
    insights.append(
        f"{top_loc['Parking_Location']} records the highest average occupancy at "
        f"{top_loc['Avg_Occupancy_Pct']:.1f}% (peak {top_loc['Peak_Occupancy_Pct']:.1f}%), "
        f"leaving an average of {top_loc['Avg_Available']:.0f} open spaces."
    )
    if len(loc_df) > 1:
        insights.append(
            f"{bottom_loc['Parking_Location']} has the lowest average utilization at "
            f"{bottom_loc['Avg_Occupancy_Pct']:.1f}%, offering approximately "
            f"{bottom_loc['Avg_Available']:.0f} spare spaces on average."
        )

    # 2. Hourly peak insight
    if not hourly_df.empty:
        sorted_hours = hourly_df.sort_values("Avg_Occupancy_Pct", ascending=False)
        peak_h = sorted_hours.iloc[0]
        quiet_h = sorted_hours.iloc[-1]
        insights.append(
            f"Campus-wide parking demand peaks around {peak_h['Time_Label']} at "
            f"{peak_h['Avg_Occupancy_Pct']:.1f}% average occupancy, while demand is lowest "
            f"near {quiet_h['Time_Label']} ({quiet_h['Avg_Occupancy_Pct']:.1f}%)."
        )

    # 3. Weekday comparison insight
    if len(day_df) >= 2:
        busiest_day = day_df.loc[day_df["Avg_Occupancy_Pct"].idxmax()]
        quietest_day = day_df.loc[day_df["Avg_Occupancy_Pct"].idxmin()]
        delta = busiest_day["Avg_Occupancy_Pct"] - quietest_day["Avg_Occupancy_Pct"]
        insights.append(
            f"{busiest_day['Day']} is the busiest day ({busiest_day['Avg_Occupancy_Pct']:.1f}% avg occupancy), "
            f"exceeding {quietest_day['Day']} ({quietest_day['Avg_Occupancy_Pct']:.1f}%) by {delta:.1f} percentage points."
        )

    # 4. Vehicle mix insight
    if not veh_df.empty:
        top_veh = veh_df.iloc[0]
        insights.append(
            f"{top_veh['Vehicle_Type']} accounts for the largest share of parked volume at "
            f"{top_veh['Share_Pct']:.1f}% across {int(top_veh['Record_Count'])} observed records."
        )

    # Recommendations driven by thresholds
    crowded_zones = loc_df[loc_df["Peak_Occupancy_Pct"] > 80.0]["Parking_Location"].tolist()
    spare_zones = loc_df[loc_df["Avg_Occupancy_Pct"] < 55.0]["Parking_Location"].tolist()

    if crowded_zones and spare_zones:
        recommendations.append(
            f"Redirect overflow traffic from high-pressure zones ({', '.join(crowded_zones[:2])}) "
            f"toward underutilized zones ({', '.join(spare_zones[:2])}) during peak hours around {kpis['peak_hour_label']}."
        )
    elif crowded_zones:
        recommendations.append(
            f"Implement dynamic digital signage and staggered arrival windows for {', '.join(crowded_zones[:2])}, "
            f"which regularly exceed the 80% congestion threshold."
        )

    if kpis["avg_occupancy_pct"] > 75.0:
        recommendations.append(
            f"Overall campus utilization is elevated at {kpis['avg_occupancy_pct']:.1f}%. "
            "Consider expanding shuttle frequency from outer lots or encouraging two-wheeler/EV carpooling."
        )
    elif kpis["avg_occupancy_pct"] < 40.0:
        recommendations.append(
            f"Overall utilization averages {kpis['avg_occupancy_pct']:.1f}%. "
            "Consolidate night/weekend security lighting and maintenance to active zones to optimize operating cost."
        )
    else:
        recommendations.append(
            f"Campus utilization is balanced overall ({kpis['avg_occupancy_pct']:.1f}%), "
            f"so targeted demand management should focus specifically on {kpis['peak_hour_label']} peak arrivals."
        )

    if not veh_df.empty and "Two-Wheeler" in veh_df["Vehicle_Type"].values:
        two_w_share = float(veh_df.loc[veh_df["Vehicle_Type"] == "Two-Wheeler", "Share_Pct"].iloc[0])
        if two_w_share >= 35.0:
            recommendations.append(
                f"Two-wheelers represent {two_w_share:.1f}% of parked volume; converting 10-15 standard car bays "
                "near Academic Block and Main Gate into compact two-wheeler bays can increase effective bay count."
            )

    return {"insights": insights, "recommendations": recommendations}


def compute_statistical_summary(df: pd.DataFrame) -> pd.DataFrame:
    """Return a formatted Pandas statistical summary for key numeric fields."""
    if df is None or df.empty:
        return pd.DataFrame()
    numeric_cols = ["Total_Capacity", "Occupied_Spaces", "Available_Spaces", "Occupancy_Percentage"]
    existing = [c for c in numeric_cols if c in df.columns]
    return df[existing].describe().round(2)


def build_analysis_report(df: pd.DataFrame, cleaning_report: Dict[str, Any] | None = None) -> str:
    """Generate a comprehensive downloadable Markdown/text analysis report."""
    kpis = calculate_kpis(df)
    loc_df = compute_location_usage(df)
    day_df = compute_day_usage(df)
    insights_pkg = generate_insights_and_recommendations(df)
    alerts = compute_occupancy_alerts(df)

    lines = [
        "# Campus Parking Usage Analysis - Analytical Report",
        f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "Dataset Note: Simulated campus parking records for academic analytics.",
        "",
        "## 1. Executive KPI Summary",
        f"- Records Analyzed: {kpis['record_count']}",
        f"- Total Parking Capacity: {kpis['total_capacity']} spaces",
        f"- Average Occupied Spaces: {kpis['occupied_spaces']} spaces",
        f"- Available Parking Spaces: {kpis['available_spaces']} spaces",
        f"- Average Occupancy Percentage: {kpis['avg_occupancy_pct']:.2f}%",
        f"- Peak Parking Hour: {kpis['peak_hour_label']} ({kpis['peak_hour_occupancy']:.2f}%)",
        f"- Most Crowded Location: {kpis['most_crowded_location']} ({kpis['most_crowded_occupancy']:.2f}%)",
        "",
    ]

    if cleaning_report:
        lines.extend(
            [
                "## 2. Data Quality & Cleaning Summary",
                f"- Raw Rows Loaded: {cleaning_report.get('raw_rows', 0)}",
                f"- Cleaned Rows Retained: {cleaning_report.get('cleaned_rows', 0)}",
                f"- Duplicates Removed: {cleaning_report.get('duplicates_removed', 0)}",
                f"- Missing Values Handled: {cleaning_report.get('missing_values_handled', 0)}",
                f"- Invalid Capacity Rows Dropped: {cleaning_report.get('invalid_capacity_rows_dropped', 0)}",
                "",
            ]
        )

    lines.append("## 3. Location Utilization Breakdown")
    for _, row in loc_df.iterrows():
        lines.append(
            f"- {row['Parking_Location']}: Capacity {int(row['Total_Capacity'])}, "
            f"Avg Occupied {row['Avg_Occupied']:.1f}, Avg Available {row['Avg_Available']:.1f}, "
            f"Avg Occupancy {row['Avg_Occupancy_Pct']:.2f}% (Peak {row['Peak_Occupancy_Pct']:.2f}%) [{row['Status']}]"
        )

    lines.extend(["", "## 4. Day-of-Week Occupancy Summary"])
    for _, row in day_df.iterrows():
        lines.append(f"- {row['Day']}: {row['Avg_Occupancy_Pct']:.2f}% avg occupancy")

    lines.extend(["", "## 5. Occupancy Threshold Alerts"])
    if alerts["high_alerts"]:
        for item in alerts["high_alerts"]:
            lines.append(
                f"- [HIGH >80%] {item['location']}: Avg {item['avg_occupancy_pct']:.1f}%, Peak {item['peak_occupancy_pct']:.1f}%"
            )
    else:
        lines.append("- No locations exceed 80% occupancy in the current selection.")

    if alerts["low_alerts"]:
        for item in alerts["low_alerts"]:
            lines.append(
                f"- [LOW <30%] {item['location']}: Avg {item['avg_occupancy_pct']:.1f}% ({item['avg_available']:.0f} spaces open)"
            )

    lines.extend(["", "## 6. Automated Insights"])
    for idx, item in enumerate(insights_pkg["insights"], 1):
        lines.append(f"{idx}. {item}")

    lines.extend(["", "## 7. Recommendations"])
    for idx, item in enumerate(insights_pkg["recommendations"], 1):
        lines.append(f"{idx}. {item}")

    return "\n".join(lines)
