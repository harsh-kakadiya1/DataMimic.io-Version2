# [DataMimic.io](http://synxdatagen.netlify.app): Advanced Synthetic Data Generation & No-Code EDA/Pre-processing Platform

## Project Goal
To develop a comprehensive web application, DataMimic.io, that serves as a powerful, user-friendly tool for both generating highly customizable synthetic datasets and performing intuitive, no-code Exploratory Data Analysis (EDA) and data pre-processing on uploaded files. The platform will empower data scientists, analysts, students, and learners by simplifying complex data tasks.

## Technologies Used
*   **Backend**: Python (Flask, Pandas, NumPy, Scikit-learn, Faker)
*   **Frontend**: HTML, CSS (Bootstrap 5), JavaScript

## Features (Planned)

### Module 1: Synthetic Data Generation
*   **Core Dataset Parameters**: Number of Records, Missing Value Percentage, Feature Covariance/Correlation Control.
*   **Geographical Locality/Context**: India, UK, US, Canada, Australia.
*   **Schema Definition & Customization**:
    *   Pre-defined Industry Schemas (Medical, Finance, Retail, Education, Automotive).
    *   Custom Column Definition (various data types including Categorical).
*   **Download Options**: CSV, Excel, JSON.

### Module 2: No-Code EDA & Pre-processing
*   **File Upload Interface**: Support for .csv and .xlsx files.
*   **Data Overview & Summary**: General statistics, column-wise details (data type, missing values, unique values), numerical/categorical stats.
*   **(Highly Desirable Visualizations)**: Histograms, Bar charts, Correlation Heatmap.
*   **Data Pre-processing Operations**:
    *   Missing Value Handling (remove rows/cols, impute with mean/median/mode).
    *   Duplicate Handling (remove duplicate rows).
    *   Column Management (remove specific columns).
    *   Data Type Conversion (Numeric, String, Date).
    *   Data Scaling & Normalization (Min-Max, Standardization).
    *   Text Cleaning (Inconsistent Capitalization Repair: UPPERCASE, lowercase, Title Case).

## Setup and Running the Application

### 1. Clone the Repository (Once available)
```bash
git clone <your-repo-url>

cd DataMimic.io
