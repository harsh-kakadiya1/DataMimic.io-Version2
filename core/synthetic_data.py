import pandas as pd
import numpy as np
from faker import Faker
import uuid
import random
from datetime import datetime, timedelta
import requests
import os
import json

from config import Config # Import Config for Gemini API key

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
    # Generate a properly formatted phone number
    phone = locality_faker.phone_number()
    # Clean up the phone number - remove extra characters and format
    phone = ''.join(filter(str.isdigit, phone))
    
    # Handle empty or invalid phone numbers
    if not phone or len(phone) < 7:
        # Generate a simple 10-digit number if faker fails
        phone = ''.join([str(random.randint(0, 9)) for _ in range(10)])
    
    # Format based on length and locality
    if len(phone) == 10:
        # Format as XXX-XXX-XXXX
        return f"{phone[:3]}-{phone[3:6]}-{phone[6:]}"
    elif len(phone) == 11 and phone.startswith('1'):
        # Format as +1 (XXX) XXX-XXXX
        return f"+1 ({phone[1:4]}) {phone[4:7]}-{phone[7:]}"
    elif len(phone) == 12 and phone.startswith('91'):
        # Indian format: +91 XXXXX XXXXX
        return f"+91 {phone[2:7]} {phone[7:]}"
    elif len(phone) > 10:
        # International format
        return f"+{phone}"
    else:
        # For shorter numbers, pad with zeros and format
        padded_phone = phone.zfill(10)
        return f"{padded_phone[:3]}-{padded_phone[3:6]}-{padded_phone[6:]}"

def generate_street_address(locality_faker):
    return locality_faker.street_address()

def generate_city(locality_faker):
    return locality_faker.city()

def generate_country(locality_faker):
    return locality_faker.country()

def generate_zip_code(locality_faker):
    return locality_faker.postcode()

def generate_email_address(locality_faker):
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

# --- Gemini API Integration ---
def generate_content_with_gemini(prompt: str, api_key: str):
    """
    Calls the Gemini API to generate content based on a prompt.
    """
    if not api_key:
        raise ValueError("Gemini API key is not configured.")

    # FIX: Updated API URL to use 'gemini-2.5-flash' model
    # The documentation (https://ai.google.dev/gemini-api/docs/models#gemini-2.5-flash)
    # indicates the model code is 'models/gemini-2.5-flash' for the v1 API.
    url = f"https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key={api_key}"
    
    headers = {'Content-Type': 'application/json'}
    payload = {
        "contents": [
            {
                "parts": [
                    {
                        "text": prompt
                    }
                ]
            }
        ],
        "safety_settings": [
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
        ]
    }

    # FIX: Increased timeout to 60 seconds
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=60) # Increased timeout
        response.raise_for_status() # Raise HTTPError for bad responses (4xx or 5xx)
        
        response_json = response.json()
        
        # Extract content, assuming a simple structure for single text part response
        if 'candidates' in response_json and len(response_json['candidates']) > 0:
            first_candidate = response_json['candidates'][0]
            if 'content' in first_candidate and 'parts' in first_candidate['content']:
                for part in first_candidate['content']['parts']:
                    if 'text' in part:
                        return part['text'].strip()
            elif 'finishReason' in first_candidate and first_candidate['finishReason'] == 'SAFETY':
                 return "AI Generation Failed: Content blocked by safety filter."
        
        return "Error: No text generated by AI."

    except requests.exceptions.HTTPError as e:
        status_code = e.response.status_code
        response_text = e.response.text
        print(f"HTTP Error: {status_code} - {response_text}") # Log the specific error for debugging
        if status_code == 429:
            return "AI Generation Failed (Rate Limit): Please try again in a moment."
        elif status_code == 400 and "API key not valid" in response_text:
            return "AI Generation Failed (API Key Error): Invalid Gemini API key."
        return f"AI Generation Failed (HTTP Error): {status_code}. {response_text}"
    except requests.exceptions.ConnectionError as e:
        print(f"Connection Error: {e}")
        return "AI Generation Failed (Connection Error): Could not connect to Gemini API. Check your internet connection or API endpoint."
    except requests.exceptions.Timeout as e:
        print(f"Timeout Error: {e}")
        return "AI Generation Failed (Timeout): Gemini API call timed out. The request took too long."
    except requests.exceptions.RequestException as e:
        print(f"Request Error: {e}")
        return f"AI Generation Failed (Request Error): {e}. This covers any non-HTTP related request errors."
    except Exception as e:
        print(f"Unexpected Error during AI generation: {e}")
        return f"AI Generation Failed (Unexpected Error): {e}"


# --- Schema Definitions ---
SCHEMAS = {
    "medical": {
        "fields": {
            "Patient_ID": "UUID",
            "Name": "Full Name",
            "Age": {"type": "Integer", "range": (18, 90)},
            "Gender": {"type": "Categorical", "values": ["Male", "Female", "Other"]},
            "Contact": {"type": "Phone Number"},
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

# Mapping of data types to their Python generator functions (Faker-based)
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
    # NEW: Parameter to receive AI-generated custom column definitions with their values
    ai_custom_columns_definitions: list = None
) -> pd.DataFrame:
    """
    Generates a synthetic pandas DataFrame based on specified parameters.
    Integrates AI-generated column data if provided.
    """
    if schema_name not in SCHEMAS:
        raise ValueError(f"Schema '{schema_name}' not found.")
    
    if locality not in LOCALITY_FAKERS:
        raise ValueError(f"Locality '{locality}' not supported.")
    
    faker_obj = LOCALITY_FAKERS[locality]
    
    # Start with standard schema fields
    all_fields_definition = SCHEMAS[schema_name]["fields"].copy()
    
    # Prepare AI-generated columns for direct injection
    ai_column_data = {}
    if ai_custom_columns_definitions:
        for col_def in ai_custom_columns_definitions:
            col_name = col_def['name']
            generated_values = col_def['generated_values'] # These are the actual values from AI
            col_type = col_def['type']
            
            # Warn if AI column conflicts with a pre-defined schema column. AI data will override.
            if col_name in all_fields_definition and 'ai_generated' not in all_fields_definition[col_name]:
                print(f"Warning: AI custom column '{col_name}' conflicts with a pre-defined schema column. AI data will override.")
            
            # Store values, handle cycling if num_records > len(generated_values)
            # This ensures we have enough data for all records
            if len(generated_values) > 0:
                full_column_values = (generated_values * ((num_records // len(generated_values)) + 1))[:num_records]
                random.shuffle(full_column_values) # Shuffle to add more randomness
            else:
                full_column_values = [None] * num_records # Fill with None if AI returned no values
            
            ai_column_data[col_name] = full_column_values
            
            # Add AI-generated columns to the overall field definition, so they are processed
            # We treat them as 'Faker.word()' essentially, but their values come from ai_column_data
            all_fields_definition[col_name] = {'type': col_type, 'ai_generated': True} 


    data = []
    for record_idx in range(num_records):
        record = {}
        for col_name, col_params in all_fields_definition.items():
            
            # Handle AI-generated columns first
            if col_name in ai_column_data:
                record[col_name] = ai_column_data[col_name][record_idx]
                continue # Skip Faker generation for AI columns

            # Special handling for Model column (if AI didn't generate it)
            if col_name == "Model" and schema_name == "automotive" and col_name not in ai_column_data:
                # Will be generated after 'Make' is available
                record[col_name] = None
                continue
            
            value = None
            generator_type = col_params if isinstance(col_params, str) else col_params.get('type')

            try:
                if generator_type in GENERATORS:
                    params_for_generator = col_params if isinstance(col_params, dict) else None
                    value = GENERATORS[generator_type](faker_obj, params_for_generator)
                else:
                    value = faker_obj.word() # Default fallback for unknown types not generated by AI

            except Exception as e:
                print(f"Error generating data for column {col_name} with type {generator_type}: {e}")
                value = None

            record[col_name] = value
        
        # Post-processing for interdependent columns like 'Model' (if not AI-generated)
        if schema_name == "automotive" and "Model" in selected_columns and "Model" not in ai_column_data:
            make_value = record.get("Make")
            if make_value:
                record["Model"] = generate_model_name(make_value)
            else:
                record["Model"] = "N/A"
        
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
                    # Use pd.NA for nullable types like 'Int64', np.nan for floats
                    if pd.api.types.is_numeric_dtype(df.iloc[:, c]):
                        df.iloc[r, c] = np.nan
                    else:
                        df.iloc[r, c] = pd.NA

    # Apply variance to numerical columns
    if variance_ratio > 0:
        for col_name in df.select_dtypes(include=np.number).columns:
            # Skip applying variance to AI-generated columns for now, as their distribution is already set by AI.
            # If you want AI-generated columns to also have variance applied, remove this check.
            if col_name in ai_column_data: 
                continue 
            
            numeric_col_data = df[col_name].dropna()
            if not numeric_col_data.empty:
                mean_val = numeric_col_data.mean()
                std_dev = numeric_col_data.std()
                if not pd.isna(std_dev) and std_dev != 0:
                    scale_factor = 1 + (variance_ratio / 100.0)
                    df.loc[df[col_name].notna(), col_name] = mean_val + (df.loc[df[col_name].notna(), col_name] - mean_val) * scale_factor
                    
                    # Ensure amount/price columns remain positive after variance
                    if col_name.lower() in ['amount', 'price', 'cost', 'value', 'balance', 'salary', 'income', 'expense', 'revenue', 'profit', 'loss', 'transaction_amount', 'payment_amount', 'loan_amount', 'interest_rate', 'rate', 'total', 'subtotal', 'tax', 'discount', 'fee', 'charge', 'payment', 'deposit', 'withdrawal', 'credit', 'debit']:
                        df.loc[df[col_name].notna(), col_name] = df.loc[df[col_name].notna(), col_name].abs()
                
                # Round age values to integers if it's an age column
                if col_name.lower() == 'age':
                    df[col_name] = df[col_name].round().astype('Int64')

    # Filter by selected_columns at the end and maintain order
    # Ensure AI-generated columns are included in selected_columns for final filtering if they are selected
    # This loop is technically redundant now as selectedSchemaColumns already includes AI columns
    # But it's good for robustness if selected_columns was assembled differently
    # for col_name in ai_column_data.keys():
    #     if col_name not in selected_columns:
    #         selected_columns.append(col_name)

    final_columns = [col for col in selected_columns if col in df.columns]
    df = df[final_columns]
    
    # Post-processing: Format specific columns for better display
    for col_name in df.columns:
        if col_name.lower() == 'age':
            # Ensure age is always an integer
            df[col_name] = pd.to_numeric(df[col_name], errors='coerce').round().astype('Int64')
        elif col_name.lower() in ['contact', 'phone', 'phone_number', 'mobile', 'telephone']:
            # Format phone numbers consistently
            df[col_name] = df[col_name].astype(str).apply(lambda x: format_phone_number(x) if pd.notna(x) and x != 'None' else x)
        elif col_name.lower() in ['amount', 'price', 'cost', 'value', 'balance', 'salary', 'income', 'expense', 'revenue', 'profit', 'loss', 'transaction_amount', 'payment_amount', 'loan_amount', 'interest_rate', 'rate', 'total', 'subtotal', 'tax', 'discount', 'fee', 'charge', 'payment', 'deposit', 'withdrawal', 'credit', 'debit']:
            # Format currency/amount columns to 2 decimal places and ensure positive values
            df[col_name] = pd.to_numeric(df[col_name], errors='coerce').round(2)
            # Ensure all amounts are positive (remove negative values)
            df[col_name] = df[col_name].abs()
    
    return df

def format_phone_number(phone_str):
    """Helper function to format phone numbers consistently"""
    if not phone_str or phone_str == 'None' or pd.isna(phone_str):
        return phone_str
    
    # Extract only digits
    digits = ''.join(filter(str.isdigit, str(phone_str)))
    
    # Handle empty or invalid phone numbers
    if not digits or len(digits) < 7:
        return phone_str
    
    if len(digits) == 10:
        return f"{digits[:3]}-{digits[3:6]}-{digits[6:]}"
    elif len(digits) == 11 and digits.startswith('1'):
        return f"+1 ({digits[1:4]}) {digits[4:7]}-{digits[7:]}"
    elif len(digits) == 12 and digits.startswith('91'):
        # Indian format: +91 XXXXX XXXXX
        return f"+91 {digits[2:7]} {digits[7:]}"
    elif len(digits) > 10:
        return f"+{digits}"
    else:
        # For shorter numbers, pad with zeros and format
        padded_digits = digits.zfill(10)
        return f"{padded_digits[:3]}-{padded_digits[3:6]}-{padded_digits[6:]}"


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