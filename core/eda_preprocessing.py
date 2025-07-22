import pandas as pd
import numpy as np
from sklearn.preprocessing import MinMaxScaler, StandardScaler
import uuid
import io

# In-memory storage for DataFrames.
current_dataframes = {}

def load_dataframe(file_stream, filename: str):
    """Loads a DataFrame from a file stream (CSV or XLSX)."""
    file_content = io.BytesIO(file_stream.read())

    try:
        if filename.endswith('.csv'):
            df = pd.read_csv(file_content)
        elif filename.endswith('.xlsx'):
            df = pd.read_excel(file_content)
        else:
            raise ValueError("Unsupported file type. Please upload .csv or .xlsx.")
    except Exception as e:
        raise ValueError(f"Could not read file: {e}. Ensure it's a valid CSV/XLSX.")
    
    if df.empty:
        raise ValueError("Uploaded file is empty or could not be parsed into a DataFrame.")

    df_id = str(uuid.uuid4())
    current_dataframes[df_id] = df
    return df_id, df

def get_dataframe(df_id: str):
    """Retrieves a DataFrame from in-memory storage using its ID."""
    if df_id not in current_dataframes:
        raise ValueError(f"DataFrame with ID {df_id} not found. It might have expired or been removed.")
    return current_dataframes[df_id]

def update_dataframe(df_id: str, new_df: pd.DataFrame):
    """Updates an existing DataFrame in storage."""
    current_dataframes[df_id] = new_df

def delete_dataframe(df_id: str):
    """Removes a DataFrame from storage."""
    if df_id in current_dataframes:
        del current_dataframes[df_id]

def get_eda_summary(df: pd.DataFrame):
    """
    Generates a comprehensive EDA summary for a DataFrame.
    Returns a dictionary suitable for JSON serialization and frontend display.
    """
    summary = {
        "total_rows": int(df.shape[0]),
        "total_columns": int(df.shape[1]),
        "column_details": []
    }

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
            "min": 'N/A',
            "max": 'N/A',
            "mean": 'N/A',
            "median": 'N/A',
            "mode": 'N/A',
            "std": 'N/A',
        }

        # Handle numerical column statistics
        if pd.api.types.is_numeric_dtype(col_series):
            numeric_data = col_series.dropna()
            if not numeric_data.empty:
                col_detail["min"] = float(round(numeric_data.min(), 2)) if pd.notna(numeric_data.min()) else 'N/A'
                col_detail["max"] = float(round(numeric_data.max(), 2)) if pd.notna(numeric_data.max()) else 'N/A'
                col_detail["mean"] = float(round(numeric_data.mean(), 2)) if pd.notna(numeric_data.mean()) else 'N/A'
                col_detail["median"] = float(round(numeric_data.median(), 2)) if pd.notna(numeric_data.median()) else 'N/A'
                
                mode_val = numeric_data.mode()
                if not mode_val.empty and pd.notna(mode_val.iloc[0]):
                    col_detail["mode"] = float(round(mode_val.iloc[0], 2)) 
                else:
                    col_detail["mode"] = 'N/A'

                col_detail["std"] = float(round(numeric_data.std(), 2)) if pd.notna(numeric_data.std()) else 'N/A'
        
        # Handle categorical/object/string column statistics
        elif pd.api.types.is_object_dtype(col_series) or pd.api.types.is_string_dtype(col_series) or pd.api.types.is_categorical_dtype(col_series):
            mode_val = col_series.mode()
            if not mode_val.empty and pd.notna(mode_val.iloc[0]):
                col_detail["mode"] = str(mode_val.iloc[0]) 
            else:
                col_detail["mode"] = 'N/A'
        
        # Handle datetime column statistics
        elif pd.api.types.is_datetime64_any_dtype(col_series):
            datetime_data = col_series.dropna()
            if not datetime_data.empty:
                col_detail["min"] = str(datetime_data.min().isoformat()) if pd.notna(datetime_data.min()) else 'N/A'
                col_detail["max"] = str(datetime_data.max().isoformat()) if pd.notna(datetime_data.max()) else 'N/A'
                mode_val = datetime_data.mode()
                if not mode_val.empty and pd.notna(mode_val.iloc[0]):
                    col_detail["mode"] = str(mode_val.iloc[0].isoformat())
                else:
                    col_detail["mode"] = 'N/A'

        # Final check for any remaining NumPy types just in case
        for key, value in col_detail.items():
            if isinstance(value, (np.int64, np.int32)):
                col_detail[key] = int(value)
            elif isinstance(value, (np.float64, np.float32)):
                col_detail[key] = float(value)

        summary["column_details"].append(col_detail)

    return summary

# --- Data Pre-processing Operations ---

def remove_rows_with_any_missing(df: pd.DataFrame):
    """Removes rows that contain at least one missing value."""
    if df.empty: return df.copy()
    initial_rows = df.shape[0]
    df_cleaned = df.dropna().copy()
    if df_cleaned.empty and initial_rows > 0:
        raise ValueError("Operation removed all rows. Consider different handling for missing values.")
    return df_cleaned

def remove_columns_with_high_missing(df: pd.DataFrame, threshold_percent: float):
    """Removes columns with missing value percentage above a given threshold."""
    if not (0 <= threshold_percent <= 100):
        raise ValueError("Threshold must be between 0 and 100.")
    if df.empty: return df.copy()

    initial_cols = df.shape[1]
    threshold_count = len(df) * (threshold_percent / 100)
    df_cleaned = df.dropna(axis=1, thresh=len(df) - threshold_count).copy()
    if df_cleaned.empty and initial_cols > 0:
        raise ValueError("Operation removed all columns. Adjust threshold or review data.")
    return df_cleaned

def impute_missing_numerical(df: pd.DataFrame, columns: list, strategy: str):
    """Imputes missing numerical values using mean, median, or mode."""
    df_copy = df.copy()
    if not columns: return df_copy
    
    for col in columns:
        if col not in df_copy.columns:
            print(f"Warning: Column '{col}' not found for imputation.")
            continue
        if not pd.api.types.is_numeric_dtype(df_copy[col]):
            raise ValueError(f"Column '{col}' is not numerical and cannot be imputed with numerical strategy.")
        
        numeric_data = df_copy[col].dropna()
        if numeric_data.empty:
            print(f"Warning: Column '{col}' contains no non-missing numerical data to calculate '{strategy}' for imputation.")
            continue

        fill_value = None
        if strategy == 'mean':
            fill_value = numeric_data.mean()
        elif strategy == 'median':
            fill_value = numeric_data.median()
        elif strategy == 'mode':
            mode_val = numeric_data.mode()
            fill_value = mode_val[0] if not mode_val.empty else None
        else:
            raise ValueError(f"Unknown numerical imputation strategy: {strategy}")
        
        if fill_value is not None and pd.notna(fill_value):
            df_copy[col].fillna(fill_value, inplace=True)
        else:
            print(f"Warning: Could not determine valid fill value for numerical column '{col}' with strategy '{strategy}'. No imputation applied to this column.")
    return df_copy

def impute_missing_categorical(df: pd.DataFrame, columns: list):
    """Imputes missing categorical values with the mode."""
    df_copy = df.copy()
    if not columns: return df_copy
    
    for col in columns:
        if col not in df_copy.columns:
            print(f"Warning: Column '{col}' not found for imputation.")
            continue
        
        categorical_data = df_copy[col].dropna()
        if categorical_data.empty:
            print(f"Warning: Column '{col}' contains no non-missing categorical data to calculate mode for imputation.")
            continue

        mode_val = categorical_data.mode()
        if not mode_val.empty and pd.notna(mode_val[0]):
            fill_value = mode_val[0]
            df_copy[col].fillna(fill_value, inplace=True)
        else:
            print(f"Warning: Could not determine valid mode for categorical column '{col}'. No imputation applied to this column.")
    return df_copy

def remove_duplicate_rows(df: pd.DataFrame):
    """Removes exact duplicate rows from the DataFrame."""
    return df.drop_duplicates().copy()

def remove_specific_columns(df: pd.DataFrame, columns_to_remove: list):
    """Removes a list of specified columns from the DataFrame."""
    if not columns_to_remove: return df.copy()
    
    existing_columns = [col for col in columns_to_remove if col in df.columns]
    if not existing_columns:
        print("Warning: No specified columns found to remove.")
        return df.copy()
    
    return df.drop(columns=existing_columns, errors='ignore').copy()

def change_data_type(df: pd.DataFrame, column: str, target_type: str):
    """Converts a column to a specified data type."""
    if column not in df.columns:
        raise ValueError(f"Column '{column}' not found for type conversion.")
    
    df_copy = df.copy()
    
    try:
        if target_type == 'int':
            # Convert to numeric first, coercing errors to NaN.
            # Then, fill NaNs (e.g., with 0 or a placeholder) if you want int, or convert to nullable Int64
            # We'll use Int64 which allows NaNs in integer columns
            df_copy[column] = pd.to_numeric(df_copy[column], errors='coerce').astype('Int64')
        elif target_type == 'float':
            df_copy[column] = pd.to_numeric(df_copy[column], errors='coerce')
        elif target_type == 'str':
            df_copy[column] = df_copy[column].astype(str).replace('nan', '') # Convert 'nan' string to empty string
        elif target_type == 'bool':
            # Convert to boolean. Handles various inputs, invalid to False.
            df_copy[column] = df_copy[column].apply(lambda x: bool(x) if pd.notna(x) else False) 
        elif target_type == 'datetime':
            df_copy[column] = pd.to_datetime(df_copy[column], errors='coerce')
        else:
            raise ValueError(f"Unsupported target data type: {target_type}")
    except Exception as e:
        raise ValueError(f"Failed to convert column '{column}' to '{target_type}': {e}. Check data format.")
    
    return df_copy.copy() # Ensure a fresh copy is returned

def scale_columns(df: pd.DataFrame, columns: list, method: str):
    """Applies Min-Max Scaling or Standardization to selected numerical columns."""
    df_copy = df.copy()
    if not columns: return df_copy
    
    for col in columns:
        if col not in df_copy.columns:
            print(f"Warning: Column '{col}' not found for scaling.")
            continue
        if not pd.api.types.is_numeric_dtype(df_copy[col]):
            raise ValueError(f"Column '{col}' is not numerical and cannot be scaled.")
        
        data_to_scale_mask = df_copy[col].notna()
        data_to_scale = df_copy.loc[data_to_scale_mask, col].values.reshape(-1, 1)
        
        if data_to_scale.size == 0: 
            print(f"Warning: Column '{col}' has no non-null numeric data for scaling. Skipping.")
            continue

        if method == 'min_max':
            scaler = MinMaxScaler()
        elif method == 'standard': # Corrected method name to match frontend JS
            scaler = StandardScaler()
        else:
            raise ValueError(f"Unsupported scaling method: {method}")
        
        scaler.fit(data_to_scale)
        df_copy.loc[data_to_scale_mask, col] = scaler.transform(data_to_scale).flatten()
        
    return df_copy.copy() # Ensure a fresh copy is returned

def clean_text_capitalization(df: pd.DataFrame, columns: list, case_type: str):
    """Converts capitalization of selected string columns."""
    df_copy = df.copy()
    if not columns: return df_copy
    
    for col in columns:
        if col not in df_copy.columns:
            print(f"Warning: Column '{col}' not found for text cleaning.")
            continue
        
        mask = df_copy[col].notna() & df_copy[col].apply(lambda x: isinstance(x, str))
        
        if case_type == 'upper': # Corrected case type name
            df_copy.loc[mask, col] = df_copy.loc[mask, col].str.upper()
        elif case_type == 'lower': # Corrected case type name
            df_copy.loc[mask, col] = df_copy.loc[mask, col].str.lower()
        elif case_type == 'title': # Corrected case type name
            df_copy.loc[mask, col] = df_copy.loc[mask, col].str.title()
        else:
            raise ValueError(f"Unsupported case type: {case_type}")
    
    return df_copy.copy() # Ensure a fresh copy is returned

# Utility to format file size for display
def format_file_size(df: pd.DataFrame):
    """Calculates approximate DataFrame size in memory and formats it."""
    bytes_size = df.memory_usage(deep=True).sum()
    
    if bytes_size < 1024:
        return f"{bytes_size} Bytes"
    elif bytes_size < 1024**2:
        return f"{bytes_size / 1024:.2f} KB"
    elif bytes_size < 1024**3:
        return f"{bytes_size / (1024**2):.2f} MB"
    else:
        return f"{bytes_size / (1024**3):.2f} GB"