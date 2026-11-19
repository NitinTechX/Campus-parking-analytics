"""Interactive Plotly visualizations and Matplotlib/Seaborn statistical plots."""

from __future__ import annotations

import matplotlib.pyplot as plt
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import seaborn as sns

NAVY_BG = "#0F172A"
CARD_BG = "#131F33"
GRID_COLOR = "rgba(148, 163, 184, 0.14)"
TEXT_COLOR = "#E2E8F0"
MUTED_TEXT = "#94A3B8"
BLUE_PRIMARY = "#3B82F6"
BLUE_LIGHT = "#60A5FA"
CYAN_ACCENT = "#38BDF8"
EMERALD = "#10B981"
AMBER = "#F59E0B"
CRIMSON = "#EF4444"


def _apply_navy_layout(fig: go.Figure, title: str, height: int = 380) -> go.Figure:
    """Apply consistent dark navy & blue styling to all Plotly charts."""
    fig.update_layout(
        title=dict(text=title, font=dict(size=15, color=TEXT_COLOR)),
        paper_bgcolor=CARD_BG,
        plot_bgcolor=CARD_BG,
        font=dict(color=TEXT_COLOR, family="DM Sans, sans-serif", size=12),
        height=height,
        margin=dict(l=45, r=24, t=52, b=45),
        legend=dict(
            bgcolor="rgba(15, 23, 42, 0.6)",
            bordercolor="rgba(148, 163, 184, 0.2)",
            borderwidth=1,
            font=dict(color=TEXT_COLOR),
        ),
        hoverlabel=dict(
            bgcolor="#0B1220",
            bordercolor=BLUE_PRIMARY,
            font=dict(color="#F8FAFC", size=12),
        ),
    )
    fig.update_xaxes(gridcolor=GRID_COLOR, zerolinecolor=GRID_COLOR, tickfont=dict(color=MUTED_TEXT))
    fig.update_yaxes(gridcolor=GRID_COLOR, zerolinecolor=GRID_COLOR, tickfont=dict(color=MUTED_TEXT))
    return fig


def plot_occupancy_by_location(loc_df: pd.DataFrame) -> go.Figure:
    """1. Bar chart: Parking occupancy % by location."""
    if loc_df.empty:
        return _apply_navy_layout(go.Figure(), "Parking Occupancy by Location (No Data)")

    colors = [
        CRIMSON if pct > 80 else (EMERALD if pct < 30 else BLUE_PRIMARY)
        for pct in loc_df["Avg_Occupancy_Pct"]
    ]
    fig = go.Figure(
        data=[
            go.Bar(
                x=loc_df["Parking_Location"],
                y=loc_df["Avg_Occupancy_Pct"],
                marker_color=colors,
                text=[f"{v:.1f}%" for v in loc_df["Avg_Occupancy_Pct"]],
                textposition="outside",
                hovertemplate="<b>%{x}</b><br>Avg Occupancy: %{y:.2f}%<extra></extra>",
            )
        ]
    )
    fig.add_hline(y=80, line_dash="dash", line_color=CRIMSON, annotation_text="80% High Alert")
    fig.add_hline(y=30, line_dash="dot", line_color=EMERALD, annotation_text="30% Low Threshold")
    fig.update_yaxes(range=[0, 108], title_text="Occupancy (%)")
    return _apply_navy_layout(fig, "Average Parking Occupancy by Location")


def plot_hourly_trends(hourly_df: pd.DataFrame) -> go.Figure:
    """2. Line chart: Hourly parking usage trends."""
    if hourly_df.empty:
        return _apply_navy_layout(go.Figure(), "Hourly Parking Usage Trends (No Data)")

    fig = go.Figure(
        data=[
            go.Scatter(
                x=hourly_df["Time_Label"],
                y=hourly_df["Avg_Occupancy_Pct"],
                mode="lines+markers",
                line=dict(color=CYAN_ACCENT, width=3),
                marker=dict(size=8, color=BLUE_PRIMARY, line=dict(width=2, color="#F8FAFC")),
                fill="tozeroy",
                fillcolor="rgba(59, 130, 246, 0.16)",
                hovertemplate="<b>%{x}</b><br>Avg Occupancy: %{y:.2f}%<extra></extra>",
            )
        ]
    )
    fig.update_yaxes(range=[0, 105], title_text="Occupancy (%)")
    fig.update_xaxes(title_text="Hour of Day")
    return _apply_navy_layout(fig, "Hourly Parking Usage Trends")


def plot_occupied_vs_available_pie(occupied: int, available: int) -> go.Figure:
    """3. Pie chart: Occupied vs available parking spaces."""
    if occupied + available == 0:
        return _apply_navy_layout(go.Figure(), "Occupied vs Available Spaces (No Data)")

    fig = go.Figure(
        data=[
            go.Pie(
                labels=["Occupied Spaces", "Available Spaces"],
                values=[occupied, available],
                marker=dict(colors=[BLUE_PRIMARY, "#1E3A5F"], line=dict(color=NAVY_BG, width=2)),
                textinfo="label+percent",
                hovertemplate="<b>%{label}</b><br>Spaces: %{value}<br>Share: %{percent}<extra></extra>",
            )
        ]
    )
    return _apply_navy_layout(fig, "Occupied vs Available Parking Spaces")


def plot_day_hour_heatmap(matrix_df: pd.DataFrame) -> go.Figure:
    """4. Heatmap: Parking occupancy by day and hour."""
    if matrix_df.empty:
        return _apply_navy_layout(go.Figure(), "Day & Hour Occupancy Heatmap (No Data)")

    fig = go.Figure(
        data=go.Heatmap(
            z=matrix_df.values,
            x=matrix_df.columns.tolist(),
            y=matrix_df.index.tolist(),
            colorscale=[
                [0.0, "#0F2942"],
                [0.4, "#1D4ED8"],
                [0.75, "#38BDF8"],
                [1.0, "#EF4444"],
            ],
            zmin=0,
            zmax=100,
            colorbar=dict(title="Occ %", tickfont=dict(color=TEXT_COLOR)),
            hovertemplate="Day: %{y}<br>Time: %{x}<br>Occupancy: %{z:.1f}%<extra></extra>",
        )
    )
    fig.update_xaxes(title_text="Time of Day")
    fig.update_yaxes(autorange="reversed")
    return _apply_navy_layout(fig, "Parking Occupancy Heatmap by Day & Hour", height=400)


def plot_weekday_occupancy(day_df: pd.DataFrame) -> go.Figure:
    """5. Bar chart: Average occupancy by weekday (Monday-Sunday)."""
    if day_df.empty:
        return _apply_navy_layout(go.Figure(), "Average Occupancy by Weekday (No Data)")

    fig = px.bar(
        day_df,
        x="Day",
        y="Avg_Occupancy_Pct",
        text=day_df["Avg_Occupancy_Pct"].apply(lambda v: f"{v:.1f}%"),
        color="Avg_Occupancy_Pct",
        color_continuous_scale=["#1E40AF", "#3B82F6", "#38BDF8"],
    )
    fig.update_traces(textposition="outside", hovertemplate="<b>%{x}</b><br>Avg Occupancy: %{y:.2f}%<extra></extra>")
    fig.update_coloraxes(showscale=False)
    fig.update_yaxes(range=[0, 105], title_text="Average Occupancy (%)")
    return _apply_navy_layout(fig, "Average Parking Occupancy by Weekday")


def plot_vehicle_donut(veh_df: pd.DataFrame) -> go.Figure:
    """6. Donut chart: Vehicle type distribution."""
    if veh_df.empty:
        return _apply_navy_layout(go.Figure(), "Vehicle Type Distribution (No Data)")

    fig = go.Figure(
        data=[
            go.Pie(
                labels=veh_df["Vehicle_Type"],
                values=veh_df["Total_Occupied"],
                hole=0.55,
                marker=dict(
                    colors=["#3B82F6", "#38BDF8", "#10B981", "#F59E0B"],
                    line=dict(color=NAVY_BG, width=2),
                ),
                textinfo="label+percent",
                hovertemplate="<b>%{label}</b><br>Parked Volume: %{value}<br>Share: %{percent}<extra></extra>",
            )
        ]
    )
    return _apply_navy_layout(fig, "Vehicle Type Distribution")


def plot_capacity_vs_occupied(loc_df: pd.DataFrame) -> go.Figure:
    """7. Comparative grouped bar chart: Total Capacity vs Average Occupied Spaces."""
    if loc_df.empty:
        return _apply_navy_layout(go.Figure(), "Capacity vs Occupied Spaces (No Data)")

    fig = go.Figure(
        data=[
            go.Bar(
                name="Total Capacity",
                x=loc_df["Parking_Location"],
                y=loc_df["Total_Capacity"],
                marker_color="#1E3A5F",
            ),
            go.Bar(
                name="Avg Occupied Spaces",
                x=loc_df["Parking_Location"],
                y=loc_df["Avg_Occupied"],
                marker_color=BLUE_PRIMARY,
            ),
        ]
    )
    fig.update_layout(barmode="group")
    fig.update_yaxes(title_text="Parking Spaces")
    return _apply_navy_layout(fig, "Total Capacity vs Average Occupied Spaces by Location")


def plot_date_trends(trend_df: pd.DataFrame) -> go.Figure:
    """Additional date-wise parking occupancy trend line chart."""
    if trend_df.empty:
        return _apply_navy_layout(go.Figure(), "Date-Wise Parking Trends (No Data)")

    fig = go.Figure(
        data=[
            go.Scatter(
                x=trend_df["Date"],
                y=trend_df["Avg_Occupancy_Pct"],
                mode="lines+markers",
                line=dict(color=BLUE_LIGHT, width=2.5),
                marker=dict(size=7, color=CYAN_ACCENT),
                hovertemplate="<b>%{x}</b><br>Avg Occupancy: %{y:.2f}%<extra></extra>",
            )
        ]
    )
    fig.update_yaxes(range=[0, 105], title_text="Avg Occupancy (%)")
    return _apply_navy_layout(fig, "Date-Wise Average Occupancy Trend")


def create_seaborn_distribution_figure(df: pd.DataFrame) -> plt.Figure:
    """Create a Matplotlib + Seaborn statistical distribution figure of occupancy by location."""
    plt.style.use("dark_background")
    fig, ax = plt.subplots(figsize=(9, 4.2), facecolor=CARD_BG)
    ax.set_facecolor(CARD_BG)

    if df.empty:
        ax.text(0.5, 0.5, "No data available for current filter", ha="center", va="center", color=TEXT_COLOR)
        ax.axis("off")
        return fig

    sns.boxplot(
        data=df,
        x="Parking_Location",
        y="Occupancy_Percentage",
        palette="Blues_r",
        ax=ax,
    )
    ax.axhline(80, color=CRIMSON, linestyle="--", linewidth=1.2, label="80% Congestion Threshold")
    ax.axhline(30, color=EMERALD, linestyle=":", linewidth=1.2, label="30% Low Utilization")
    ax.set_title("Occupancy Distribution & Variance by Parking Location (Seaborn)", color=TEXT_COLOR, fontsize=12, pad=10)
    ax.set_xlabel("")
    ax.set_ylabel("Occupancy (%)", color=MUTED_TEXT)
    ax.tick_params(axis="x", rotation=18, colors=MUTED_TEXT, labelsize=9)
    ax.tick_params(axis="y", colors=MUTED_TEXT, labelsize=9)
    ax.grid(axis="y", color="#334155", alpha=0.4)
    ax.legend(frameon=False, loc="upper right", fontsize=8)
    fig.tight_layout()
    return fig
