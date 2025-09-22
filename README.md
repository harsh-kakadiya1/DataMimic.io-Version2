# [DataMimic.io](https://datamimic-io.onrender.com/home) - Realistic Synthetic Data Generation & No-Code EDA Platform

[![Python Version](https://img.shields.io/badge/python-3.9%2B-blue.svg)](https://python.org)
[![Flask Version](https://img.shields.io/badge/flask-2.3.3-orange.svg)](https://flask.palletsprojects.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Deployment](https://img.shields.io/badge/Live%20Demo-datamimic--io.onrender.com-brightgreen)](https://datamimic-io.onrender.com/home)

DataMimic.io is a web-based platform empowering data scientists, developers, and QA engineers to generate realistic synthetic datasets and perform no-code Exploratory Data Analysis (EDA). This project addresses critical challenges in data privacy and accessibility by providing a powerful, intuitive interface to create, analyze, and clean tabular data on demand.

### Live Demo : [Here](https://datamimic-io.onrender.com/home)

---

## Key Features

### 1. Synthetic Data Generation

*   **Pre-defined Schemas:** Generate data for common domains like Medical, Finance, Retail, Education, and Automotive.
*   **Locality-Based Data:** Create realistic data for different regions (US, UK, India, Canada, Australia).
*   **Data Quality Controls:** Fine-tune the dataset with adjustable missing value ratios and data variance.
*   **AI-Powered Custom Columns:** A standout feature that leverages the Google Gemini API to generate entire columns of data based on natural language prompts.
*   **Flexible Export:** Download generated data in CSV, JSON, or Excel formats.

### Generator Page Screenshot
<img width="1919" height="1006" alt="image" src="https://github.com/user-attachments/assets/5f5338ef-560f-4c3a-8951-da2efc4187e3" />
*The main generator interface, configured to generate Retail data.*

### AI Custom Column Feature Screenshot
<img width="1317" height="638" alt="image" src="https://github.com/user-attachments/assets/eecc3d21-4bb2-48f9-a37b-621b56640a26" />
*Defining an AI-powered custom column with a simple prompt filed to configure its details.*

### 2. No-Code EDA & Pre-processing

*   **Easy Data Upload:** Upload your CSV or XLSX files and get an instant, comprehensive data overview.
*   **Detailed Summary:** View total rows/columns, file size, missing value percentages, and detailed column-wise statistics (mean, median, std dev, etc.).
*   **Powerful Pre-processing Suite:** Clean and transform your data with a few clicks:
    *   **Missing Value Handling:** Remove rows/columns or impute with mean, median, or mode.
    *   **Duplicate Removal:** Eliminate duplicate rows.
    *   **Column Management:** Remove specific columns or change data types.
    *   **Data Scaling:** Apply Min-Max Scaling or Standardization (Z-score).
    *   **Text Cleaning:** Standardize text with uppercase, lowercase, or title case.
*   **Download Processed Data:** Export your cleaned dataset, ready for analysis or model training.

### EDA Page Screenshot
<img width="1919" height="1079" alt="image" src="https://github.com/user-attachments/assets/844937ae-7ec5-496e-b8fd-ca729834a8b2" />

*The EDA & Pre-processing page after a file has been uploaded, showing the data summary and available operations.*

---

## Technical Stack

*   **Backend:**
    *   **Framework:** Flask
    *   **Data Manipulation:** Pandas, NumPy
    *   **Data Preprocessing:** Scikit-learn
    *   **Synthetic Data:** Faker
    *   **AI Integration:** Google Gemini API (via `requests`)
    *   **Email:** Flask-Mail
*   **Frontend:**
    *   HTML5, CSS3, JavaScript (Vanilla JS)
    *   Jinja2 Templating
*   **Deployment:**
    *   **WSGI Server:** Gunicorn
    *   **Hosting:** Render.com (Web Service)

---

## Project Setup & Local Installation

To run DataMimic.io on your local machine, follow these steps:

### 1. Prerequisites

*   Python 3.9 or higher
*   `pip` and `venv`

### 2. Clone the Repository

```bash
git clone https://github.com/harsh-kakadiya1/datamimic.io.git
cd datamimic.io

