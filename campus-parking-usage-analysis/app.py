"""Campus Parking Analytics Dashboard - Streamlit Web Application."""

from __future__ import annotations

from pathlib import Path
import pandas as pd
import streamlit as st

from modules.analytics import (
    build_analysis_report,
    calculate_kpis,
    compute_date_trends,
    compute_day_hour_matrix,
    compute_day_usage,
    compute_hourly_usage,
    compute_location_usage,
    compute_occupancy_alerts,
    compute_statistical_summary,
    compute_vehicle_distribution,
    detect_peak_periods,
    generate_insights_and_recommendations,
)
from modules.data_cleaning import DAY_ORDER, clean_parking_data
from modules.data_loader import (
    generate_sample_template_csv,
    load_parking_csv,
    load_sample_dataset,
)
from modules.visualizations import (
    create_seaborn_distribution_figure,
    plot_capacity_vs_occupied,
    plot_date_trends,
    plot_day_hour_heatmap,
    plot_hourly_trends,
    plot_occupancy_by_location,
    plot_occupied_vs_available_pie,
    plot_vehicle_donut,
    plot_weekday_occupancy,
)

st.set_page_config(
    page_title="Campus Parking Analytics Dashboard",
    page_icon="🅿️",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Dark Navy & Blue Professional Styling
st.markdown(
    """
    <style>
    .stApp {
        background-color: #0A1120;
        color: #E2E8F0;
    }
    section[data-testid="stSidebar"] {
        background-color: #0F172A;
        border-right: 1px solid rgba(148, 163, 184, 0.16);
    }
    .kpi-card {
        background-color: #131F33;
        border: 1px solid rgba(59, 130, 246, 0.25);
        border-radius: 10px;
        padding: 16px 18px;
        margin-bottom: 8px;
    }
    .kpi-label {
        font-size: 12px;
        color: #94A3B8;
        margin-bottom: 6px;
    }
    .kpi-value {
        font-size: 24px;
        font-weight: 700;
        color: #F8FAFC;
        font-variant-numeric: tabular-nums;
    }
    .kpi-sub {
        font-size: 12px;
        color: #60A5FA;
        margin-top: 4px;
    }
    .notice-box {
        background-color: #131F33;
        border: 1px solid rgba(56, 189, 248, 0.28);
        border-radius: 8px;
        padding: 12px 16px;
        font-size: 13px;
        color: #CBD5E1;
        margin-bottom: 16px;
    }
    </style>
    """,
    unsafe_allow_html=True,
)


def _render_kpi_card(label: str, value: str, subtitle: str) -> None:
    st.markdown(
        f"""
        <div class="kpi-card">
            <div class="kpi-label">{label}</div>
            <div class="kpi-value">{value}</div>
            <div class="kpi-sub">{subtitle}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def _reset_filters() -> None:
    for key in [
        "filter_days",
        "filter_locations",
        "filter_vehicles",
        "filter_periods",
        "filter_date_range",
    ]:
        if key in st.session_state:
            del st.session_state[key]


def main() -> None:
    # Header
    st.title("Campus Parking Analytics Dashboard")
    st.caption("Smart Data Insights for Efficient Campus Parking Management")

    # Sidebar Navigation
    st.sidebar.header("Navigation")
    pages = [
        "Overview Dashboard",
        "Parking Analytics",
        "Location Analysis",
        "Time & Day Analysis",
        "Dataset Explorer",
        "Insights & Recommendations",
        "About Project",
    ]
    selected_page = st.sidebar.radio("Go to Page", pages, label_visibility="collapsed")

    # Dataset Management in Sidebar
    st.sidebar.markdown("---")
    st.sidebar.subheader("Dataset Source")
    uploaded_file = st.sidebar.file_uploader(
        "Upload Custom Parking CSV",
        type=["csv"],
        help="Required columns: Date, Time, Parking_Location, Total_Capacity, Occupied_Spaces",
    )

    st.sidebar.download_button(
        label="Download Sample CSV Template",
        data=generate_sample_template_csv(),
        file_name="campus_parking_template.csv",
        mime="text/csv",
        use_container_width=True,
    )

    using_simulated = True
    if uploaded_file is not None:
        raw_df, load_error = load_parking_csv(uploaded_file)
        if load_error:
            st.error(f"Dataset Validation Error: {load_error}")
            raw_df, _ = load_sample_dataset()
        else:
            using_simulated = False
    else:
        raw_df, load_error = load_sample_dataset()
        if load_error:
            st.error(load_error)
            return

    cleaned_df, cleaning_report = clean_parking_data(raw_df)

    if using_simulated:
        st.markdown(
            '<div class="notice-box">'
            "<strong>Simulated Dataset Notice:</strong> Currently displaying the bundled simulated academic dataset "
            f"({cleaning_report['cleaned_rows']} cleaned records across 6 campus zones). "
            "Values represent simulated patterns for data science analysis—not live parking sensor feeds."
            "</div>",
            unsafe_allow_html=True,
        )

    if cleaned_df.empty:
        st.warning("No valid records remained after data cleaning. Please upload a valid CSV dataset.")
        return

    # Sidebar Filters
    st.sidebar.markdown("---")
    st.sidebar.subheader("Interactive Filters")

    min_date = pd.to_datetime(cleaned_df["Date"]).min().date()
    max_date = pd.to_datetime(cleaned_df["Date"]).max().date()

    date_range = st.sidebar.date_input(
        "Select Date Range",
        value=(min_date, max_date),
        min_value=min_date,
        max_value=max_date,
        key="filter_date_range",
    )

    available_days = [d for d in DAY_ORDER if d in cleaned_df["Day"].unique()]
    selected_days = st.sidebar.multiselect(
        "Select Day",
        options=available_days,
        default=available_days,
        key="filter_days",
    )

    available_locs = sorted(cleaned_df["Parking_Location"].unique().tolist())
    selected_locs = st.sidebar.multiselect(
        "Select Parking Location",
        options=available_locs,
        default=available_locs,
        key="filter_locations",
    )

    available_vehicles = sorted(cleaned_df["Vehicle_Type"].unique().tolist())
    selected_vehicles = st.sidebar.multiselect(
        "Select Vehicle Type",
        options=available_vehicles,
        default=available_vehicles,
        key="filter_vehicles",
    )

    available_periods = sorted(cleaned_df["Time_Period"].unique().tolist())
    selected_periods = st.sidebar.multiselect(
        "Select Time Period",
        options=available_periods,
        default=available_periods,
        key="filter_periods",
    )

    st.sidebar.button("Reset Filters", on_click=_reset_filters, use_container_width=True)

    # Apply Filters
    filtered_df = cleaned_df.copy()
    if isinstance(date_range, tuple) and len(date_range) == 2:
        start_d, end_d = str(date_range[0]), str(date_range[1])
        filtered_df = filtered_df[(filtered_df["Date"] >= start_d) & (filtered_df["Date"] <= end_d)]

    if selected_days:
        filtered_df = filtered_df[filtered_df["Day"].isin(selected_days)]
    else:
        filtered_df = filtered_df.iloc[0:0]

    if selected_locs:
        filtered_df = filtered_df[filtered_df["Parking_Location"].isin(selected_locs)]
    else:
        filtered_df = filtered_df.iloc[0:0]

    if selected_vehicles:
        filtered_df = filtered_df[filtered_df["Vehicle_Type"].isin(selected_vehicles)]
    else:
        filtered_df = filtered_df.iloc[0:0]

    if selected_periods:
        filtered_df = filtered_df[filtered_df["Time_Period"].isin(selected_periods)]
    else:
        filtered_df = filtered_df.iloc[0:0]

    # Precompute analytics
    kpis = calculate_kpis(filtered_df)
    loc_df = compute_location_usage(filtered_df)
    hourly_df = compute_hourly_usage(filtered_df)
    day_df = compute_day_usage(filtered_df)
    matrix_df = compute_day_hour_matrix(filtered_df)
    veh_df = compute_vehicle_distribution(filtered_df)
    trend_df = compute_date_trends(filtered_df)
    alerts = compute_occupancy_alerts(filtered_df)
    insights_pkg = generate_insights_and_recommendations(filtered_df)

    # Page Routing
    if selected_page == "Overview Dashboard":
        c1, c2, c3, c4, c5, c6 = st.columns(6)
        with c1:
            _render_kpi_card("Total Parking Capacity", f"{kpis['total_capacity']:,}", "Total zone bays")
        with c2:
            _render_kpi_card("Occupied Spaces", f"{kpis['occupied_spaces']:,}", "Filtered avg occupied")
        with c3:
            _render_kpi_card("Available Spaces", f"{kpis['available_spaces']:,}", "Open capacity")
        with c4:
            _render_kpi_card("Average Occupancy", f"{kpis['avg_occupancy_pct']:.1f}%", f"{kpis['record_count']} records")
        with c5:
            _render_kpi_card("Peak Parking Hour", kpis["peak_hour_label"], f"{kpis['peak_hour_occupancy']:.1f}% avg load")
        with c6:
            _render_kpi_card("Most Crowded Zone", kpis["most_crowded_location"], f"{kpis['most_crowded_occupancy']:.1f}% avg load")

        if filtered_df.empty:
            st.warning("No matching records for the active filter selection. Click 'Reset Filters' in the sidebar.")
            return

        # Capacity Utilization Indicator & Threshold Alerts
        st.subheader("Campus Capacity Utilization & Alerts")
        st.progress(min(max(int(round(kpis["avg_occupancy_pct"])), 0), 100), text=f"Overall Campus Utilization: {kpis['avg_occupancy_pct']:.1f}%")

        col_a, col_b = st.columns(2)
        with col_a:
            if alerts["high_alerts"]:
                for a in alerts["high_alerts"]:
                    st.error(
                        f"High Occupancy Alert (>80%): {a['location']} — Avg {a['avg_occupancy_pct']:.1f}%, Peak {a['peak_occupancy_pct']:.1f}%"
                    )
            else:
                st.success("No zones exceed 80% occupancy under the current filters.")
        with col_b:
            if alerts["low_alerts"]:
                for a in alerts["low_alerts"]:
                    st.info(
                        f"Low Occupancy Alert (<30%): {a['location']} — Avg {a['avg_occupancy_pct']:.1f}% ({a['avg_available']:.0f} open spaces)"
                    )
            else:
                st.info("All selected zones maintain at least 30% average utilization.")

        ch1, ch2 = st.columns([3, 2])
        with ch1:
            st.plotly_chart(plot_occupancy_by_location(loc_df), use_container_width=True)
        with ch2:
            st.plotly_chart(
                plot_occupied_vs_available_pie(kpis["occupied_spaces"], kpis["available_spaces"]),
                use_container_width=True,
            )

        ch3, ch4 = st.columns([3, 2])
        with ch3:
            st.plotly_chart(plot_hourly_trends(hourly_df), use_container_width=True)
        with ch4:
            st.subheader("Key Data Insights")
            for idx, item in enumerate(insights_pkg["insights"], 1):
                st.markdown(f"**{idx}.** {item}")

    elif selected_page == "Parking Analytics":
        st.subheader("Comprehensive Parking Analytics")
        if filtered_df.empty:
            st.warning("No matching records for the active filter selection.")
            return

        r1c1, r1c2 = st.columns([3, 2])
        with r1c1:
            st.plotly_chart(plot_capacity_vs_occupied(loc_df), use_container_width=True)
        with r1c2:
            st.plotly_chart(plot_vehicle_donut(veh_df), use_container_width=True)

        st.plotly_chart(plot_date_trends(trend_df), use_container_width=True)

        st.subheader("Seaborn Distribution & Outlier Analysis")
        st.pyplot(create_seaborn_distribution_figure(filtered_df))

        st.subheader("Statistical Summary")
        st.dataframe(compute_statistical_summary(filtered_df), use_container_width=True)

    elif selected_page == "Location Analysis":
        st.subheader("Location-Based Parking Utilization")
        if filtered_df.empty:
            st.warning("No matching records for the active filter selection.")
            return

        c1, c2 = st.columns(2)
        with c1:
            st.plotly_chart(plot_occupancy_by_location(loc_df), use_container_width=True)
        with c2:
            st.plotly_chart(plot_capacity_vs_occupied(loc_df), use_container_width=True)

        st.subheader("Location Comparison Matrix")
        st.dataframe(loc_df, use_container_width=True, hide_index=True)

    elif selected_page == "Time & Day Analysis":
        st.subheader("Temporal Demand & Peak Period Detection")
        if filtered_df.empty:
            st.warning("No matching records for the active filter selection.")
            return

        peaks = detect_peak_periods(filtered_df)
        p1, p2, p3 = st.columns(3)
        with p1:
            top_h_str = ", ".join([f"{h['time']} ({h['occupancy_pct']:.1f}%)" for h in peaks["peak_hours"]])
            st.info(f"**Top Peak Hours:** {top_h_str}")
        with p2:
            if peaks["busiest_day"]:
                st.warning(
                    f"**Busiest Day:** {peaks['busiest_day']['day']} ({peaks['busiest_day']['occupancy_pct']:.1f}%)"
                )
        with p3:
            if peaks["quietest_day"]:
                st.success(
                    f"**Quietest Day:** {peaks['quietest_day']['day']} ({peaks['quietest_day']['occupancy_pct']:.1f}%)"
                )

        c1, c2 = st.columns(2)
        with c1:
            st.plotly_chart(plot_hourly_trends(hourly_df), use_container_width=True)
        with c2:
            st.plotly_chart(plot_weekday_occupancy(day_df), use_container_width=True)

        st.plotly_chart(plot_day_hour_heatmap(matrix_df), use_container_width=True)

    elif selected_page == "Dataset Explorer":
        st.subheader("Dataset Cleaning Summary & Record Explorer")

        m1, m2, m3, m4 = st.columns(4)
        m1.metric("Raw Rows Loaded", cleaning_report["raw_rows"])
        m2.metric("Cleaned Rows", cleaning_report["cleaned_rows"])
        m3.metric("Duplicates Removed", cleaning_report["duplicates_removed"])
        m4.metric("Invalid Capacity Dropped", cleaning_report["invalid_capacity_rows_dropped"])

        search_query = st.text_input(
            "Search records (by location, day, date, time, or vehicle type)",
            placeholder="e.g. Main Gate, Monday, EV...",
        )
        display_df = filtered_df.copy()
        if search_query.strip():
            q = search_query.strip().lower()
            mask = display_df.apply(
                lambda row: row.astype(str).str.lower().str.contains(q, regex=False).any(),
                axis=1,
            )
            display_df = display_df[mask]

        sort_col = st.selectbox("Sort by column", options=display_df.columns.tolist(), index=0)
        sort_asc = st.checkbox("Ascending order", value=True)
        display_df = display_df.sort_values(by=sort_col, ascending=sort_asc)

        st.dataframe(display_df, use_container_width=True, hide_index=True, height=420)

        d1, d2 = st.columns(2)
        with d1:
            st.download_button(
                "Download Filtered Data (CSV)",
                data=display_df.to_csv(index=False),
                file_name="filtered_campus_parking_data.csv",
                mime="text/csv",
                use_container_width=True,
            )
        with d2:
            report_md = build_analysis_report(display_df, cleaning_report)
            st.download_button(
                "Download Complete Analysis Report (.md)",
                data=report_md,
                file_name="campus_parking_analysis_report.md",
                mime="text/markdown",
                use_container_width=True,
            )

    elif selected_page == "Insights & Recommendations":
        st.subheader("Automated Insights & Administrative Recommendations")
        col1, col2 = st.columns(2)
        with col1:
            st.markdown("### Calculated Insights")
            for idx, item in enumerate(insights_pkg["insights"], 1):
                st.markdown(f"**{idx}.** {item}")
        with col2:
            st.markdown("### Actionable Recommendations")
            for idx, item in enumerate(insights_pkg["recommendations"], 1):
                st.markdown(f"**{idx}.** {item}")

        st.markdown("---")
        report_md = build_analysis_report(filtered_df, cleaning_report)
        st.download_button(
            "Download Complete Analysis Report",
            data=report_md,
            file_name="campus_parking_analysis_report.md",
            mime="text/markdown",
        )

    elif selected_page == "About Project":
        banner_path = Path(__file__).resolve().parent / "assets" / "project_banner.png"
        if banner_path.exists():
            st.image(str(banner_path), use_container_width=True)

        st.markdown(
            """
            ### Campus Parking Usage Analysis
            **Problem Statement:** University campuses face recurring parking congestion near academic blocks and entry gates during morning lecture peaks, while peripheral zones often remain underutilized. Administrators lack unified analytics across hours, days, and zones to rebalance demand.

            **Objectives:**
            - Quantify parking occupancy rates across six major campus zones.
            - Identify peak hours, busiest weekdays, and congestion bottlenecks (>80% occupancy).
            - Highlight underutilized parking zones (<30% occupancy) for overflow redirection.
            - Provide CSV upload, automated data cleaning, interactive filtering, and exportable analytical reports.

            **Technologies Used:** Python, Streamlit, Pandas, NumPy, Plotly, Matplotlib, Seaborn, CSV.

            **Data Science Methodology:**
            1. Data Ingestion & Schema Validation (`data_loader.py`)
            2. Missing-Value Imputation, Duplicate Removal & Capacity Bounds Cleaning (`data_cleaning.py`)
            3. Exploratory Data Analysis, Time-Series & Cross-Tab Aggregation (`analytics.py`)
            4. Interactive Visualization & Automated Threshold Alerting (`visualizations.py`)
            """
        )


if __name__ == "__main__":
    main()
