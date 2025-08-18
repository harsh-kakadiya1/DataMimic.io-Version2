import pandas as pd
import numpy as np
from sklearn.preprocessing import MinMaxScaler, StandardScaler
import uuid
import io

# Removed Plotly/Chart.js plotting imports

# In-memory storage for DataFrames.
current_dataframes = {}

def load_dataframe(file_stream, filename: str):
    """Loads a DataFrame from a file stream (CSV or XLSX)."""
    file_content = io.BytesIO(file_stream.read())

    if filename.endswith('.csv'):
        try:
            df = pd.read_csv(file_content, encoding='utf-8')
        except UnicodeDecodeError:
            file_content.seek(0)
            df = pd.read_csv(file_content, encoding='latin1')
    elif filename.endswith('.xlsx'):
        df = pd.read_excel(file_content)
    else:
        raise ValueError("Unsupported file type. Please upload .csv or .xlsx.")
    
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
    """
    summary = {
        "total_rows": int(df.shape[0]),
        "total_columns": int(df.shape[1]),
        "missing_values": f"{df.isnull().sum().sum() / df.size * 100:.1f}%" if df.size > 0 else "0.0%",
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

# --- Data Pre-processing Operations ---

def remove_rows_with_any_missing(df: pd.DataFrame):
    """Removes rows that contain at least one missing value."""
    return df.dropna().copy()

def remove_columns_with_high_missing(df: pd.DataFrame, threshold_percent: float):
    """Removes columns with missing value percentage above a given threshold."""
    if not (0 <= threshold_percent <= 100):
        raise ValueError("Threshold must be between 0 and 100.")
    
    threshold_count = len(df) * (threshold_percent / 100)
    df_cleaned = df.dropna(axis=1, thresh=len(df) - threshold_count).copy()
    return df_cleaned

def impute_missing_numerical(df: pd.DataFrame, columns: list, strategy: str):
    """Imputes missing numerical values using mean, median, or mode."""
    df_copy = df.copy()
    if not columns: return df_copy
    
    for col in columns:
        if col not in df_copy.columns:
            print(f"Warning: Column '{col}' not found for imputation.")
            continue
        if pd.api.types.is_numeric_dtype(df_copy[col]):
            fill_value = None
            if strategy == 'mean':
                fill_value = df_copy[col].mean()
            elif strategy == 'median':
                fill_value = df_copy[col].median()
            elif strategy == 'mode':
                mode_val = df_copy[col].mode()
                fill_value = mode_val[0] if not mode_val.empty else None
            else:
                raise ValueError(f"Unknown imputation strategy: {strategy}")
            
            if fill_value is not None and pd.notna(fill_value):
                df_copy[col].fillna(fill_value, inplace=True)
            else:
                print(f"Warning: Could not determine valid fill value for column '{col}' with strategy '{strategy}'. No imputation performed for this column.")
        else:
            print(f"Warning: Column '{col}' is not numerical, skipping numerical imputation.")
    return df_copy

def impute_missing_categorical(df: pd.DataFrame, columns: list):
    """Imputes missing categorical values with the mode."""
    df_copy = df.copy()
    if not columns: return df_copy
    
    for col in columns:
        if col not in df_copy.columns:
            print(f"Warning: Column '{col}' not found for imputation.")
            continue
        mode_val = df_copy[col].mode()
        if not mode_val.empty and pd.notna(mode_val[0]):
            fill_value = mode_val[0]
            df_copy[col].fillna(fill_value, inplace=True)
        else:
            print(f"Warning: Could not determine valid mode for categorical column '{col}'. No imputation performed for this column.")
    return df_copy

def remove_duplicate_rows(df: pd.DataFrame):
    """Removes exact duplicate rows from the DataFrame."""
    return df.drop_duplicates().copy()

def remove_specific_columns(df: pd.DataFrame, columns_to_remove: list):
    """Removes a list of specified columns from the DataFrame."""
    existing_columns = [col for col in columns_to_remove if col in df.columns]
    return df.drop(columns=existing_columns, errors='ignore').copy()

def change_data_type(df: pd.DataFrame, column: str, target_type: str):
    """Converts a column to a specified data type."""
    if column not in df.columns:
        raise ValueError(f"Column '{column}' not found for type conversion.")
    
    df_copy = df.copy()
    
    try:
        if target_type == 'int':
            df_copy[column] = pd.to_numeric(df_copy[column], errors='coerce').astype('Int64')
        elif target_type == 'float':
            df_copy[column] = pd.to_numeric(df_copy[column], errors='coerce')
        elif target_type == 'str':
            df_copy[column] = df_copy[column].astype(str)
        elif target_type == 'bool':
            df_copy[column] = df_copy[column].apply(lambda x: bool(x) if pd.notna(x) else False) 
        elif target_type == 'datetime':
            df_copy[column] = pd.to_datetime(df_copy[column], errors='coerce')
        else:
            raise ValueError(f"Unsupported target data type: {target_type}")
    except Exception as e:
        raise ValueError(f"Failed to convert column '{column}' to '{target_type}': {e}. Ensure data is compatible with target type.")
    
    return df_copy

def scale_columns(df: pd.DataFrame, columns: list, method: str):
    """Applies Min-Max Scaling or Standardization to selected numerical columns."""
    df_copy = df.copy()
    if not columns: return df_copy
    
    for col in columns:
        if col not in df_copy.columns:
            print(f"Warning: Column '{col}' not found for scaling.")
            continue
        if not pd.api.types.is_numeric_dtype(df_copy[col]):
            print(f"Warning: Column '{col}' is not numerical, skipping scaling.")
            continue
        
        data_to_scale_mask = df_copy[col].notna()
        data_to_scale = df_copy.loc[data_to_scale_mask, col].values.reshape(-1, 1)
        
        if data_to_scale.size == 0: 
            print(f"Warning: Column '{col}' has no non-null numeric data for scaling. Skipping.")
            continue

        if method == 'min_max':
            scaler = MinMaxScaler()
        elif method == 'standardize':
            scaler = StandardScaler()
        else:
            raise ValueError(f"Unsupported scaling method: {method}")
        
        try:
            scaler.fit(data_to_scale)
            df_copy.loc[data_to_scale_mask, col] = scaler.transform(data_to_scale).flatten()
        except Exception as e:
            print(f"Error scaling column '{col}' with method '{method}': {e}. Skipping.")
            
    return df_copy

def clean_text_capitalization(df: pd.DataFrame, columns: list, case_type: str):
    """Converts capitalization of selected string columns."""
    df_copy = df.copy()
    if not columns: return df_copy
    
    for col in columns:
        if col not in df_copy.columns:
            print(f"Warning: Column '{col}' not found for text cleaning.")
            continue
        
        mask = df_copy[col].notna()
        series_as_str = df_copy.loc[mask, col].astype(str)

        if case_type == 'uppercase':
            df_copy.loc[mask, col] = series_as_str.str.upper()
        elif case_type == 'lowercase':
            df_copy.loc[mask, col] = series_as_str.str.lower()
        elif case_type == 'titlecase':
            df_copy.loc[mask, col] = series_as_str.str.title()
        else:
            raise ValueError(f"Unsupported case type: {case_type}")
    
    return df_copy

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

# Removed Chart.js data preparation functions