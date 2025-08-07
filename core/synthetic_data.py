import pandas as pd
import numpy as np
from faker import Faker
import uuid
import random
from datetime import datetime, timedelta

# Removed Plotly/Chart.js plotting imports

# Initialize Faker with different locales
faker_en_us = Faker('en_US')
faker_en_gb = Faker('en_GB')
faker_en_ca = Faker('en_CA')
faker_en_au = Faker('en_AU')
faker_en_in = Faker('en_IN')

LOCALITY_FAKERS = {
    "US": faker_en_us,
    "UK": faker_en_gb,
    "Canada": faker_en_ca,
    "Australia": faker_en_au,
    "India": faker_en_in,
}

# --- Custom Faker-like Generators ---
def generate_full_name(locality_faker):
    return locality_faker.name()

def generate_phone_number(locality_faker):
    return locality_faker.phone_number()

def generate_street_address(locality_faker):
    return locality_faker.street_address()

def generate_city(locality_faker):
    return locality_faker.city()

def generate_country(locality_faker):
    return locality_faker.country()

def generate_zip_code(locality_faker):
    return locality_faker.postcode()

def generate_email_address(locality_faker):
    # Use a generic faker object for email if locality specific isn't needed for format
    return faker_en_us.email() 

def generate_recent_date(faker_obj, days_ago=365):
    return faker_obj.date_between(start_date=f'-{days_ago}d', end_date='today').isoformat()

def generate_future_date(faker_obj, years_from_now=3):
    return faker_obj.date_between(start_date='today', end_date=f'+{years_from_now}y').isoformat()

def generate_account_number():
    return str(random.randint(1000000000, 9999999999))

def generate_university_name():
    universities = ["University of Delhi", "Indian Institute of Science", "University of Mumbai", "University of Oxford", "University of Cambridge", "Harvard University", "Stanford University", "University of Toronto", "University of British Columbia", "University of Melbourne", "University of Sydney", "Delhi University", "Amity University", "BITS Pilani"]
    return random.choice(universities)

def generate_model_name(make):
    models_by_make = {
        "Toyota": ["Camry", "Corolla", "RAV4", "Highlander"],
        "Honda": ["Civic", "Accord", "CR-V", "Pilot"],
        "Ford": ["F-150", "Mustang", "Escape", "Explorer"],
        "BMW": ["3 Series", "5 Series", "X3", "X5"],
        "Tesla": ["Model 3", "Model Y", "Model S", "Model X"],
        "Mercedes-Benz": ["C-Class", "E-Class", "GLC", "GLE"],
        "Audi": ["A4", "A6", "Q5", "Q7"],
        "Hyundai": ["Elantra", "Sonata", "Tucson", "Santa Fe"],
        "Kia": ["Forte", "K5", "Sportage", "Sorento"],
        "Nissan": ["Altima", "Sentra", "Rogue", "Titan"]
    }
    return random.choice(models_by_make.get(make, ["Generic Sedan", "Generic SUV", "Generic Truck"]))

def generate_license_plate():
    letters = ''.join(random.choices('ABCDEFGHIJKLMNOPQRSTUVWXYZ', k=3))
    digits = ''.join(random.choices('0123456789', k=3))
    return f"{letters}{digits}"


# --- Schema Definitions ---
SCHEMAS = {
    "medical": {
        "fields": {
            "Patient_ID": "UUID",
            "Name": "Full Name",
            "Age": {"type": "Integer", "range": (18, 90)},
            "Gender": {"type": "Categorical", "values": ["Male", "Female", "Other"]},
            "Contact": "Phone Number",
            "Symptom_1": {"type": "Categorical", "values": ["Fever", "Cough", "Headache", "Fatigue", "Sore throat"]},
            "Symptom_2": {"type": "Categorical", "values": ["Nausea", "Fatigue", "Rash", "Dizziness", "Sore Throat"]},
            "Diagnosis": {"type": "Categorical", "values": ["Flu", "Cold", "Allergy", "Fracture", "Pneumonia", "Bronchitis", "Diabetes", "Hypertension", "COVID-19", "Migraine", "Asthma"]},
            "Medications": {"type": "Categorical", "values": ["Insulin", "Lisinopril", "Paracetamol", "Aspirin", "Albuterol", "Amoxicillin", "Ibuprofen"]},
            "DoctorVisit_Date": {"type": "Date", "days_ago": 365},
            "Follow_Up": {"type": "Categorical", "values": ["Yes", "No"]}
        },
        "default_columns": ["Patient_ID", "Name", "Age", "Gender", "Contact", "Symptom_1", "Symptom_2", "Diagnosis", "Medications", "DoctorVisit_Date", "Follow_Up"]
    },
    "finance": {
        "fields": {
            "Transaction_ID": "UUID",
            "Name": "Full Name",
            "Amount": {"type": "Float", "range": (10.00, 5000.00), "decimal_places": 2},
            "Transaction_Type": {"type": "Categorical", "values": ["Debit", "Credit", "Transfer"]},
            "Account_Number": "Account_Number",
            "Bank_Name": {"type": "Categorical", "values": ["State Bank of India", "HDFC Bank", "ICICI Bank", "Axis Bank", "JP Morgan Chase", "Bank of America", "HSBC", "RBC Royal Bank", "Commonwealth Bank of Australia", "National Bank of Canada"]},
            "Transaction_Date": {"type": "Date", "days_ago": 365}
        },
        "default_columns": ["Transaction_ID", "Name", "Amount", "Transaction_Type", "Account_Number", "Bank_Name", "Transaction_Date"]
    },
    "retail": {
        "fields": {
            "Order_ID": "UUID",
            "Customer_Name": "Full Name",
            "Product": {"type": "Categorical", "values": ["Laptop", "Mobile Phone", "Headphones", "Smartwatch", "Tablet", "T-Shirt", "Jeans", "Sneakers", "Dress", "Coffee Maker", "Blender", "Toaster", "Vacuum Cleaner", "Microwave", "Refrigerator"]},
            "Quantity": {"type": "Integer", "range": (1, 10)},
            "Price": {"type": "Float", "range": (5.00, 500.00), "decimal_places": 2},
            "Payment_Method": {"type": "Categorical", "values": ["Credit Card", "Debit Card", "Cash", "Online Payment", "UPI", "Bank Transfer", "PayPal"]},
            "Order_Date": {"type": "Date", "days_ago": 365}
        },
        "default_columns": ["Order_ID", "Customer_Name", "Product", "Quantity", "Price", "Payment_Method", "Order_Date"]
    },
    "education": {
        "fields": {
            "Student_ID": "UUID",
            "Name": "Full Name",
            "Age": {"type": "Integer", "range": (5, 25)},
            "Gender": {"type": "Categorical", "values": ["Male", "Female", "Other"]},
            "Course": {"type": "Categorical", "values": ["Engineering", "Medicine", "Arts", "Business", "Law", "Computer Science", "Physics", "Chemistry", "Biology", "History", "Literature"]},
            "Year": {"type": "Integer", "range": (1, 4)},
            "Grade": {"type": "Categorical", "values": ["A", "B", "C", "D", "F"]},
            "GPA": {"type": "Float", "range": (0.0, 4.0), "decimal_places": 2},
            "University": "University_Name",
            "Graduation_Year": {"type": "Integer", "range": (2000, 2030)}
        },
        "default_columns": ["Student_ID", "Name", "Age", "Gender", "Course", "Year", "Grade", "GPA", "University", "Graduation_Year"]
    },
    "automotive": {
        "fields": {
            "Vehicle_ID": "UUID",
            "Owner_Name": "Full Name",
            "Make": {"type": "Categorical", "values": ["Toyota", "Honda", "Ford", "BMW", "Tesla", "Mercedes-Benz", "Audi", "Hyundai", "Kia", "Nissan"]},
            "Model": "Model_Name",
            "Year": {"type": "Integer", "range": (2000, 2023)},
            "License_Plate": "License_Plate",
            "Mileage": {"type": "Integer", "range": (1000, 200000)},
            "Fuel_Type": {"type": "Categorical", "values": ["Petrol", "Diesel", "Electric", "Hybrid"]},
            "Service_Date": {"type": "Date", "days_ago": 365},
            "Next_Service_Due": {"type": "Date", "years_from_now": 3}
        },
        "default_columns": ["Vehicle_ID", "Owner_Name", "Make", "Model", "Year", "License_Plate", "Mileage", "Fuel_Type", "Service_Date", "Next_Service_Due"]
    }
}

# Mapping of data types to their Python generator functions
GENERATORS = {
    "UUID": lambda f, params=None: str(uuid.uuid4()),
    "Integer": lambda f, params: random.randint(params["range"][0], params["range"][1]),
    "Float": lambda f, params: round(random.uniform(params["range"][0], params["range"][1]), params.get("decimal_places", 2)),
    "String": lambda f, params=None: f.word(),
    "Boolean": lambda f, params=None: random.choice([True, False]),
    "Date": lambda f, params: (f.date_between(start_date=f'-{params.get("days_ago", 365)}d', end_date='today') if "days_ago" in params else \
                               f.date_between(start_date='today', end_date=f'+{params.get("years_from_now", 3)}y')).isoformat(),
    "Email Address": lambda f, params=None: generate_email_address(f),
    "Phone Number": lambda f, params=None: generate_phone_number(f),
    "Full Name": lambda f, params=None: generate_full_name(f),
    "Street Address": lambda f, params=None: generate_street_address(f),
    "City": lambda f, params=None: generate_city(f),
    "Country": lambda f, params=None: generate_country(f),
    "Zip Code": lambda f, params=None: generate_zip_code(f),
    "Categorical": lambda f, params: random.choice(params["values"]),
    "Account_Number": lambda f, params=None: generate_account_number(),
    "University_Name": lambda f, params=None: generate_university_name(),
    "License_Plate": lambda f, params=None: generate_license_plate(),
}

def generate_synthetic_dataframe(
    num_records: int,
    missing_percentage: float,
    variance_ratio: float,
    schema_name: str,
    locality: str,
    selected_columns: list,
    custom_columns: list = None
) -> pd.DataFrame:
    """
    Generates a synthetic pandas DataFrame based on specified parameters.
    """
    if schema_name not in SCHEMAS:
        raise ValueError(f"Schema '{schema_name}' not found.")
    
    if locality not in LOCALITY_FAKERS:
        raise ValueError(f"Locality '{locality}' not supported.")
    
    faker_obj = LOCALITY_FAKERS[locality]
    
    all_fields_definition = SCHEMAS[schema_name]["fields"].copy()

    if custom_columns:
        for col_def in custom_columns:
            col_name = col_def['name']
            col_type = col_def['type']
            
            if col_type == 'Categorical' and ('values' not in col_def or not isinstance(col_def['values'], list) or not col_def['values']):
                raise ValueError(f"Custom column '{col_name}': Categorical type requires a non-empty 'values' list (e.g., ['A','B']).")
            if col_type in ['Integer', 'Float'] and ('range' not in col_def or not isinstance(col_def['range'], list) or len(col_def['range']) != 2):
                raise ValueError(f"Custom column '{col_name}': Numeric type requires 'range' as a list of two numbers (e.g., [1,10]).")
            
            if col_name in all_fields_definition:
                print(f"Warning: Custom column '{col_name}' conflicts with a pre-defined schema column. Overwriting pre-defined.")
            all_fields_definition[col_name] = col_def

    data = []
    for _ in range(num_records):
        record = {}
        for col_name, col_params in all_fields_definition.items():
            if col_name == "Model" and schema_name == "automotive":
                continue
            
            value = None
            generator_type = col_params if isinstance(col_params, str) else col_params.get('type')

            try:
                if generator_type in GENERATORS:
                    params_for_generator = col_params if isinstance(col_params, dict) else None
                    value = GENERATORS[generator_type](faker_obj, params_for_generator)
                else:
                    value = faker_obj.word()

            except Exception as e:
                print(f"Error generating data for column {col_name} with type {generator_type}: {e}")
                value = None

            record[col_name] = value
        
        if schema_name == "automotive" and "Model" in selected_columns and "Model" in all_fields_definition:
            make_value = record.get("Make")
            record["Model"] = generate_model_name(make_value)
        
        data.append(record)

    df = pd.DataFrame(data)

    # Apply missing values
    if missing_percentage > 0:
        total_cells = df.size
        if total_cells > 0:
            num_missing_cells = int(total_cells * (missing_percentage / 100))
            if num_missing_cells > 0:
                rows, cols = df.shape
                all_coords = [(r, c) for r in range(rows) for c in range(cols)]
                missing_coords = random.sample(all_coords, min(num_missing_cells, len(all_coords)))
                for r, c in missing_coords:
                    df.iloc[r, c] = np.nan

    # Apply variance to numerical columns
    if variance_ratio > 0:
        for col_name in df.select_dtypes(include=np.number).columns:
            numeric_col_data = df[col_name].dropna()
            if not numeric_col_data.empty:
                mean_val = numeric_col_data.mean()
                std_dev = numeric_col_data.std()
                if not pd.isna(std_dev) and std_dev != 0:
                    scale_factor = 1 + (variance_ratio / 100.0)
                    df.loc[df[col_name].notna(), col_name] = mean_val + (df.loc[df[col_name].notna(), col_name] - mean_val) * scale_factor

    # Filter by selected_columns at the end and maintain order
    final_columns = [col for col in selected_columns if col in df.columns]
    df = df[final_columns]
    
    return df


def get_dataframe_summary(df: pd.DataFrame):
    """
    Calculates summary statistics for a DataFrame.
    """
    summary = {
        "total_rows": int(df.shape[0]),
        "total_columns": int(df.shape[1]),
        "missing_values": f"{df.isnull().sum().sum() / df.size * 100:.1f}%" if df.size > 0 else "0.0%",
        "column_details": []
    }

    numeric_cols = df.select_dtypes(include=np.number)
    total_cov = 0
    numeric_col_count = 0
    for col_name in numeric_cols.columns:
        col_data = numeric_cols[col_name].dropna()
        if not col_data.empty:
            mean = col_data.mean()
            std_dev = col_data.std()
            if pd.notna(mean) and mean != 0 and pd.notna(std_dev) and std_dev != 0:
                total_cov += (std_dev / abs(mean))
                numeric_col_count += 1
    
    avg_cov = (total_cov / numeric_col_count) * 100 if numeric_col_count > 0 else 0
    summary["data_variance"] = f"{float(avg_cov):.1f}%"


    for col_name in df.columns:
        col_series = df[col_name]
        col_type = str(col_series.dtype)
        non_null_count = int(col_series.count())
        missing_percentage = f"{col_series.isnull().sum() / len(col_series) * 100:.1f}%" if len(col_series) > 0 else "0.0%"
        unique_values = int(col_series.nunique())

        col_detail = {
            "name": col_name,
            "dtype": col_type,
            "non_null_count": non_null_count,
            "missing_percentage": missing_percentage,
            "unique_values": unique_values,
            "min": None,
            "max": None,
            "mean": None,
            "median": None,
            "mode": None,
            "std": None,
        }

        if pd.api.types.is_numeric_dtype(col_series):
            numeric_data = col_series.dropna()
            if not numeric_data.empty:
                col_detail["min"] = float(round(numeric_data.min(), 2)) if pd.notna(numeric_data.min()) else 'N/A'
                col_detail["max"] = float(round(numeric_data.max(), 2)) if pd.notna(numeric_data.max()) else 'N/A'
                col_detail["mean"] = float(round(numeric_data.mean(), 2)) if pd.notna(numeric_data.mean()) else 'N/A'
                col_detail["median"] = float(round(numeric_data.median(), 2)) if pd.notna(numeric_data.median()) else 'N/A'
                
                mode_val = numeric_data.mode()
                if not mode_val.empty and pd.notna(mode_val[0]):
                    col_detail["mode"] = float(round(mode_val[0], 2)) 
                else:
                    col_detail["mode"] = 'N/A'

                col_detail["std"] = float(round(numeric_data.std(), 2)) if pd.notna(numeric_data.std()) else 'N/A'
            else:
                col_detail["min"] = col_detail["max"] = col_detail["mean"] = col_detail["median"] = col_detail["mode"] = col_detail["std"] = 'N/A'
        elif pd.api.types.is_object_dtype(col_series) or pd.api.types.is_string_dtype(col_series) or pd.api.types.is_categorical_dtype(col_series):
            mode_val = col_series.mode()
            col_detail["mode"] = str(mode_val[0]) if not mode_val.empty and pd.notna(mode_val[0]) else 'N/A'
        elif pd.api.types.is_datetime64_any_dtype(col_series):
            datetime_data = col_series.dropna()
            if not datetime_data.empty:
                col_detail["min"] = datetime_data.min().isoformat(timespec='minutes') if pd.notna(datetime_data.min()) else 'N/A'
                col_detail["max"] = datetime_data.max().isoformat(timespec='minutes') if pd.notna(datetime_data.max()) else 'N/A'
            else:
                col_detail["min"] = col_detail["max"] = 'N/A'

        for key, value in col_detail.items():
            if isinstance(value, (np.int64, np.int32)):
                col_detail[key] = int(value)
            elif isinstance(value, (np.float64, np.float32)):
                col_detail[key] = float(value)
            elif pd.isna(value):
                col_detail[key] = 'N/A'

        summary["column_details"].append(col_detail)

    return summary

def get_schema_fields_for_frontend(schema_name: str):
    """
    Returns the default column names for a given schema, suitable for frontend display.
    """
    if schema_name in SCHEMAS:
        return SCHEMAS[schema_name]["default_columns"]
    return []

# --- Plotting Data Preparation Functions for Chart.js (Removed) ---
# Removed get_empty_plot_data
# Removed get_histogram_data
# Removed get_bar_chart_data
# Removed get_correlation_heatmap_data
# Removed get_scatter_plot_data