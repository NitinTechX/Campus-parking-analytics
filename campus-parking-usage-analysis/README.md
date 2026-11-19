# Campus Parking Usage Analysis

**Smart Data Insights for Efficient Campus Parking Management**

A college-level Data Science Mini Project built with Python, Streamlit, Pandas, NumPy, Plotly, Matplotlib, and Seaborn to analyze university campus parking utilization, detect peak congestion windows, and generate data-driven traffic balancing recommendations.

![Campus Parking Analytics Banner](assets/project_banner.png)

## Problem Statement

Campus parking lots near main entry gates and academic buildings frequently experience severe morning congestion, causing delays and circling traffic, while peripheral parking zones often have surplus capacity. Without structured temporal and spatial analytics, campus facility managers cannot effectively optimize signage, bay allocation, or shuttle routing.

## Objectives

- Analyze campus parking occupancy across time of day, weekday (Monday–Sunday), and parking location.
- Calculate dynamic occupancy metrics (`Occupancy Percentage = (Occupied Spaces / Total Capacity) * 100`) with zero-division and boundary validation.
- Detect high-congestion alerts (`> 80%`) and underutilized zones (`< 30%`).
- Support custom CSV uploads with automated missing-value handling, duplicate removal, and downloadable reports.

## Key Features

- **6 Dynamic KPI Cards:** Total Capacity, Occupied Spaces, Available Spaces, Average Occupancy %, Peak Parking Hour, and Most Crowded Location.
- **7 Interactive Visualizations:** Location bar chart, hourly usage trend line, occupied vs available pie chart, Day × Hour heatmap, weekday comparison bar chart, vehicle type donut chart, and capacity vs occupied grouped bar chart (plus Seaborn statistical boxplots).
- **Interactive Filtering:** Filter across Date Range, Day, Parking Location, Vehicle Type, and Time Period with one-click Reset.
- **Dataset Management:** Bundled 588-record simulated dataset (clearly marked as simulated), custom CSV uploader with schema validation, downloadable CSV template, filtered CSV export, and complete Markdown analysis report export.

## Technologies Used

- **Python 3.10+**
- **Streamlit** — Interactive multi-page web dashboard
- **Pandas & NumPy** — Data cleaning, aggregation, and statistical summary
- **Plotly** — Interactive dark-themed charts and heatmaps
- **Matplotlib & Seaborn** — Distribution and outlier analysis

## Dataset Description

The bundled `data/sample_parking_data.csv` contains **588 simulated records** spanning two full weeks across six campus parking zones (`Main Gate Parking`, `Academic Block Parking`, `Library Parking`, `Hostel Parking`, `Canteen Parking`, `Sports Complex Parking`).

| Column | Description |
| --- | --- |
| `Date` | Observation date (`YYYY-MM-DD`) |
| `Time` | Observation hour (`HH:MM`) |
| `Day` | Weekday name (`Monday`–`Sunday`) |
| `Parking_Location` | Name of campus parking zone |
| `Total_Capacity` | Total physical bays in the zone |
| `Occupied_Spaces` | Number of occupied bays |
| `Available_Spaces` | Remaining open bays (`Total_Capacity - Occupied_Spaces`) |
| `Occupancy_Percentage` | Utilization rate (`(Occupied_Spaces / Total_Capacity) * 100`) |
| `Vehicle_Type` | Vehicle category (`Car`, `Two-Wheeler`, `EV`, `Faculty Van`) |

> **Note:** The included dataset is simulated for academic data science demonstration and is not live parking sensor telemetry.

## Methodology

1. **Data Ingestion & Schema Validation** (`modules/data_loader.py`)
2. **Data Cleaning & Feature Engineering** (`modules/data_cleaning.py`)
3. **Exploratory & Statistical Analytics** (`modules/analytics.py`)
4. **Interactive Visualization & Reporting** (`modules/visualizations.py` & `app.py`)

## Installation Instructions

```bash
git clone https://github.com/your-username/campus-parking-usage-analysis.git
cd campus-parking-usage-analysis
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

## How to Run the Application

```bash
streamlit run app.py
```

Run automated unit tests:

```bash
python -m unittest discover -s tests
```

## Screenshots

- *Overview Dashboard* — 6 KPI cards, occupancy alerts, location bar chart, and hourly trend line.
- *Time & Day Analysis* — Day × Hour congestion heatmap and weekday breakdown.
- *Dataset Explorer* — Live search, sorting, cleaning audit, and CSV/report downloads.

## Future Improvements

- Integration with live IoT ultrasonic or ANPR gate camera feeds via MQTT/REST APIs.
- Short-term occupancy forecasting using Prophet or gradient-boosted time-series models.
- Mobile student parking availability companion view.

## Author

- **Name:** [Your Name]
- **Department:** Department of Data Science / Computer Science
- **Institution:** [Your University / College Name]
- **Email:** [your.email@example.com]
- **GitHub:** [https://github.com/your-username](https://github.com/your-username)
