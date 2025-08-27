import os
import uuid
from flask import Flask, render_template, request, jsonify, send_file, flash, redirect, url_for, session
from flask_mail import Mail, Message
from dotenv import load_dotenv

load_dotenv()

import pandas as pd
import numpy as np
import io
import json # Still needed for general JSON operations

# Import Config
from config import Config

# Removed Plotly/Chart.js specific imports
from core.synthetic_data import (
    generate_synthetic_dataframe, get_dataframe_summary, SCHEMAS, get_schema_fields_for_frontend
)
from core.eda_preprocessing import (
    load_dataframe, get_dataframe, update_dataframe, delete_dataframe, get_eda_summary,
    remove_rows_with_any_missing, remove_columns_with_high_missing,
    impute_missing_numerical, impute_missing_categorical,
    remove_duplicate_rows, remove_specific_columns, change_data_type,
    scale_columns, clean_text_capitalization, format_file_size, current_dataframes
)
from core.analytics import increment_data_generation, increment_eda_operations, get_current_stats

app = Flask(__name__)
app.config.from_object(Config)

mail = Mail(app)

# Only create generated data directory (no upload folder needed since we process files in memory)
os.makedirs(app.config['GENERATED_DATA_FOLDER'], exist_ok=True)

# --- Routes for Frontend Pages ---

@app.route('/')
@app.route('/home')
def home():
    """Landing page (Welcome)."""
    return render_template('home.html')

@app.route('/generator')
def generator():
    """Synthetic Data Generation page."""
    return render_template('index.html')

@app.route('/about')
def about():
    """About page."""
    return render_template('about.html')

@app.route('/features')
def features():
    """Features page."""
    return render_template('features.html')

@app.route('/contact')
def contact():
    """Contact page."""
    return render_template('contact.html')

@app.route('/eda')
def eda():
    # Clean up any old EDA dataframe for this session when navigating to EDA page
    if 'current_eda_df_id' in session:
        df_id_to_delete = session.pop('current_eda_df_id')
        if df_id_to_delete in current_dataframes:
            delete_dataframe(df_id_to_delete)
            app.logger.info(f"Cleaned up old EDA DataFrame: {df_id_to_delete} upon navigating to /eda")
    return render_template('eda.html')


# --- API Endpoints ---

@app.route('/api/get_schema_columns/<schema_name>')
def get_schema_columns(schema_name):
    """
    API to provide default columns for a selected schema to the frontend.
    This helps the frontend dynamically populate checkboxes.
    """
    if schema_name in SCHEMAS:
        return jsonify({
            "success": True,
            "default_columns": SCHEMAS[schema_name]["default_columns"]
        })
    return jsonify({"success": False, "message": "Schema not found."}), 404


@app.route('/api/generate_data', methods=['POST'])
def generate_data_api():
    """
    Handles the synthetic data generation request from the frontend.
    """
    try:
        data = request.get_json()
        
        num_records = data.get('numRecords')
        missing_percentage = data.get('missingRatio')
        variance_ratio = data.get('varianceRatio')
        schema_name = data.get('schemaSelect')
        locality = data.get('localitySelect')
        selected_columns = data.get('selectedColumns')
        custom_columns = data.get('customColumns', [])

        if not all([num_records, schema_name, locality, selected_columns is not None]):
            return jsonify({'success': False, 'message': 'Missing required parameters. Please fill all fields.'}), 400
        if not isinstance(selected_columns, list) or not all(isinstance(col, str) for col in selected_columns):
            return jsonify({'success': False, 'message': 'Invalid format for selected columns. Expected a list of strings.'}), 400
        if not isinstance(custom_columns, list):
             return jsonify({'success': False, 'message': 'Invalid format for custom columns. Expected a list.'}), 400

        df_generated = generate_synthetic_dataframe(
            num_records=num_records,
            missing_percentage=float(missing_percentage),
            variance_ratio=float(variance_ratio),
            schema_name=schema_name,
            locality=locality,
            selected_columns=selected_columns,
            custom_columns=custom_columns
        )

        # Increment data generation counter
        increment_data_generation()

        df_id = str(uuid.uuid4())
        current_dataframes[df_id] = df_generated

        preview_df = df_generated.head(10).copy() 
        
        for col in preview_df.columns:
            if pd.api.types.is_numeric_dtype(preview_df[col]):
                preview_df[col] = preview_df[col].replace({np.nan: None}).apply(lambda x: float(x) if pd.notna(x) else None)
            elif pd.api.types.is_datetime64_any_dtype(preview_df[col]):
                preview_df[col] = preview_df[col].dt.isoformat(timespec='minutes').replace({np.nan: None})
            else:
                preview_df[col] = preview_df[col].replace({np.nan: None})
        
        preview_data = preview_df.to_dict(orient='records')
        
        summary_stats = get_dataframe_summary(df_generated)
        summary_stats["fileSize"] = format_file_size(df_generated)

        # Removed plots_data from here

        download_paths = {
            "csv": url_for('download_generated_data', df_id=df_id, file_format='csv'),
            "json": url_for('download_generated_data', df_id=df_id, file_format='json'),
            "excel": url_for('download_generated_data', df_id=df_id, file_format='xlsx'),
        }

        return jsonify({
            'success': True,
            'message': 'Synthetic data generated successfully!',
            'preview_data': preview_data,
            'summary_stats': summary_stats,
            'download_paths': download_paths
            # Removed 'plots_data'
        })

    except ValueError as ve:
        app.logger.error(f"Validation error during data generation: {ve}")
        return jsonify({'success': False, 'message': str(ve)}), 400
    except Exception as e:
        app.logger.error(f"Error during data generation: {e}", exc_info=True)
        return jsonify({'success': False, 'message': 'An unexpected error occurred during data generation. Please check server logs for more details.'}), 500


@app.route('/download_generated_data/<df_id>/<file_format>')
def download_generated_data(df_id, file_format):
    try:
        df = get_dataframe(df_id)

        buffer = io.BytesIO()
        filename_prefix = f"synthetic_data_{uuid.uuid4().hex}" 
        filename = ""
        mimetype = ''

        if file_format == 'csv':
            df.to_csv(buffer, index=False, encoding='utf-8')
            mimetype = 'text/csv'
            filename = f"{filename_prefix}.csv"
        elif file_format == 'json':
            df_temp = df.copy()
            for col in df_temp.columns:
                if pd.api.types.is_numeric_dtype(df_temp[col]):
                    df_temp[col] = df_temp[col].replace({np.nan: None}).apply(lambda x: float(x) if pd.notna(x) else None)
                elif pd.api.types.is_datetime64_any_dtype(df_temp[col]):
                    df_temp[col] = df_temp[col].dt.isoformat(timespec='minutes').replace({np.nan: None})
                else:
                    df_temp[col] = df_temp[col].replace({np.nan: None})
            df_temp.to_json(buffer, orient='records', indent=4)
            mimetype = 'application/json'
            filename = f"{filename_prefix}.json"
        elif file_format == 'xlsx':
            df.to_excel(buffer, index=False, engine='openpyxl')
            mimetype = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            filename = f"{filename_prefix}.xlsx"
        else:
            flash("Unsupported download format.", 'danger')
            return redirect(url_for('generator'))

        buffer.seek(0)
        
        return send_file(
            buffer,
            mimetype=mimetype,
            as_attachment=True,
            download_name=filename
        )

    except ValueError as ve:
        flash(f"Download Error: {str(ve)}", 'danger')
        return redirect(url_for('generator'))
    except Exception as e:
        app.logger.error(f"Error downloading generated data {df_id} in {file_format}: {e}", exc_info=True)
        flash("An error occurred during file download. Please check server logs.", 'danger')
        return redirect(url_for('generator'))


@app.route('/api/upload_eda_file', methods=['POST'])
def upload_eda_file():
    if 'file' not in request.files:
        return jsonify({'success': False, 'message': 'No file part.'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'success': False, 'message': 'No selected file.'}), 400
    
    if not Config.allowed_file(file.filename):
        return jsonify({'success': False, 'message': 'Invalid file type. Please upload .csv or .xlsx files.'}), 400
    
    if 'current_eda_df_id' in session:
        df_id_to_delete = session.pop('current_eda_df_id')
        if df_id_to_delete in current_dataframes:
            delete_dataframe(df_id_to_delete)
            app.logger.info(f"Cleaned up old EDA DataFrame: {df_id_to_delete}")
        
    try:
        df_id, df = load_dataframe(file.stream, file.filename)

        summary = get_eda_summary(df)
        summary["fileSize"] = format_file_size(df)

        # Increment EDA operations counter for file upload
        increment_eda_operations()

        session['current_eda_df_id'] = df_id
        
        return jsonify({
            'success': True,
            'message': f'File "{file.filename}" uploaded and processed successfully!',
            'df_id': df_id,
            'summary': summary
        })
    except Exception as e:
        app.logger.error(f"Error processing uploaded EDA file: {e}", exc_info=True)
        return jsonify({'success': False, 'message': f'Error processing file: {str(e)}'}), 500


@app.route('/api/eda/preview/<df_id>')
def get_data_preview(df_id):
    """API to get a preview of the current dataframe."""
    try:
        df = get_dataframe(df_id)
        num_rows = request.args.get('rows', 10, type=int)
        
        # Limit the number of rows to prevent performance issues
        num_rows = min(num_rows, 100)
        
        preview_df = df.head(num_rows).copy()
        
        # Convert data for JSON serialization
        preview_data = []
        for _, row in preview_df.iterrows():
            row_data = {}
            for col in preview_df.columns:
                value = row[col]
                if pd.isna(value):
                    row_data[col] = None
                elif pd.api.types.is_numeric_dtype(preview_df[col]):
                    row_data[col] = float(value) if pd.notna(value) else None
                elif pd.api.types.is_datetime64_any_dtype(preview_df[col]):
                    row_data[col] = value.isoformat() if pd.notna(value) else None
                else:
                    row_data[col] = str(value) if pd.notna(value) else None
            preview_data.append(row_data)
        
        return jsonify({
            'success': True,
            'columns': list(preview_df.columns),
            'data': preview_data,
            'total_rows': len(df),
            'preview_rows': len(preview_data)
        })
        
    except ValueError as ve:
        app.logger.error(f"Data preview error: {ve}")
        return jsonify({'success': False, 'message': str(ve)}), 400
    except Exception as e:
        app.logger.error(f"Error getting data preview: {e}", exc_info=True)
        return jsonify({'success': False, 'message': 'An error occurred while getting data preview.'}), 500


@app.route('/api/eda/<action>', methods=['POST'])
def eda_action(action):
    df_id = session.get('current_eda_df_id')
    
    if not df_id:
        return jsonify({'success': False, 'message': 'No active dataset found. Please upload a file first on the EDA page.'}), 400

    try:
        df = get_dataframe(df_id)
        original_rows = df.shape[0]
        original_cols = df.shape[1]
        
        message = f"Applied '{action}' operation."

        if action == 'remove_rows_missing':
            df = remove_rows_with_any_missing(df)
            message = f"Removed {original_rows - df.shape[0]} rows with missing values."
        elif action == 'remove_cols_high_missing':
            threshold = request.json.get('threshold')
            if threshold is None:
                raise ValueError("Missing 'threshold' for removing columns.")
            df = remove_columns_with_high_missing(df, threshold)
            message = f"Removed {original_cols - df.shape[1]} columns with >{threshold}% missing values."
        elif action == 'impute_numerical':
            columns = request.json.get('columns')
            strategy = request.json.get('strategy')
            if not columns or not strategy:
                raise ValueError("Missing columns or strategy for numerical imputation.")
            df = impute_missing_numerical(df, columns, strategy)
            message = f"Missing numerical values in {len(columns)} columns imputed using '{strategy}'."
        elif action == 'impute_categorical':
            columns = request.json.get('columns')
            if not columns:
                raise ValueError("Missing columns for categorical imputation.")
            df = impute_missing_categorical(df, columns)
            message = f"Missing categorical values in {len(columns)} columns imputed using mode."
        elif action == 'remove_duplicate_rows':
            df = remove_duplicate_rows(df)
            message = f"Removed {original_rows - df.shape[0]} duplicate rows."
        elif action == 'remove_columns':
            columns_to_remove = request.json.get('columns')
            if not columns_to_remove:
                raise ValueError("Missing columns to remove.")
            df = remove_specific_columns(df, columns_to_remove)
            message = f"Removed {len(columns_to_remove)} selected columns."
        elif action == 'change_data_type':
            column = request.json.get('column')
            target_type = request.json.get('target_type')
            if not column or not target_type:
                raise ValueError("Missing column or target type for conversion.")
            df = change_data_type(df, column, target_type)
            message = f"Column '{column}' converted to '{target_type}'."
        elif action == 'scale_columns':
            columns = request.json.get('columns')
            method = request.json.get('method')
            if not columns or not method:
                raise ValueError("Missing columns or method for scaling.")
            df = scale_columns(df, columns, method)
            message = f"Selected numerical columns scaled using '{method}' method."
        elif action == 'clean_text_capitalization':
            columns = request.json.get('columns')
            case_type = request.json.get('case_type')
            if not columns or not case_type:
                raise ValueError("Missing columns or case type for text cleaning.")
            df = clean_text_capitalization(df, columns, case_type)
            message = f"Text capitalization applied ({case_type}) to selected columns."
        else:
            return jsonify({'success': False, 'message': 'Invalid EDA action.'}), 400

        # Increment EDA operations counter
        increment_eda_operations()

        update_dataframe(df_id, df)
        
        summary = get_eda_summary(df)
        summary["fileSize"] = format_file_size(df)

        return jsonify({
            'success': True,
            'message': message,
            'df_id': df_id,
            'summary': summary
        })

    except ValueError as ve:
        app.logger.error(f"EDA action validation error: {ve}")
        return jsonify({'success': False, 'message': str(ve)}), 400
    except Exception as e:
        app.logger.error(f"Error during EDA action '{action}': {e}", exc_info=True)
        return jsonify({'success': False, 'message': f'An unexpected error occurred during EDA operation: {str(e)}. Please check server logs.'}), 500


@app.route('/api/eda/download_processed_data/<df_id>/<file_format>')
def download_processed_data(df_id, file_format):
    try:
        df = get_dataframe(df_id)

        buffer = io.BytesIO()
        filename_prefix = f"processed_data_{uuid.uuid4().hex}"
        filename = ""
        mimetype = ''

        if file_format == 'csv':
            df.to_csv(buffer, index=False, encoding='utf-8')
            mimetype = 'text/csv'
            filename = f"{filename_prefix}.csv"
        elif file_format == 'json':
            df_temp = df.copy()
            for col in df_temp.columns:
                if pd.api.types.is_numeric_dtype(df_temp[col]):
                    df_temp[col] = df_temp[col].replace({np.nan: None}).apply(lambda x: float(x) if pd.notna(x) else None)
                elif pd.api.types.is_datetime64_any_dtype(df_temp[col]):
                    df_temp[col] = df_temp[col].dt.isoformat(timespec='minutes').replace({np.nan: None})
                else:
                    df_temp[col] = df_temp[col].replace({np.nan: None})
            df_temp.to_json(buffer, orient='records', indent=4)
            mimetype = 'application/json'
            filename = f"{filename_prefix}.json"
        elif file_format == 'xlsx':
            df.to_excel(buffer, index=False, engine='openpyxl')
            mimetype = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            filename = f"{filename_prefix}.xlsx"
        else:
            flash("Unsupported download format.", 'danger')
            return redirect(url_for('eda'))

        buffer.seek(0)
        
        return send_file(
            buffer,
            mimetype=mimetype,
            as_attachment=True,
            download_name=filename
        )

    except ValueError as ve:
        flash(f"Download Error: {str(ve)}", 'danger')
        return redirect(url_for('eda'))
    except Exception as e:
        app.logger.error(f"Error downloading processed data {df_id} in {file_format}: {e}", exc_info=True)
        flash("An error occurred during file download. Please check server logs.", 'danger')
        return redirect(url_for('eda'))


@app.route('/api/analytics/stats')
def get_analytics_stats():
    """API endpoint to get current analytics statistics."""
    try:
        stats = get_current_stats()
        return jsonify({
            'success': True,
            'stats': stats
        })
    except Exception as e:
        app.logger.error(f"Error getting analytics stats: {e}", exc_info=True)
        return jsonify({'success': False, 'message': 'Error retrieving analytics data.'}), 500


@app.route('/submit_contact', methods=['POST'])
def submit_contact():
    try:
        name = request.form.get('name')
        email = request.form.get('email')
        subject = request.form.get('subject')
        message_body = request.form.get('message')

        if not all([name, email, subject, message_body]):
            flash('All fields are required for the contact form.', 'danger')
            return redirect(url_for('contact'))

        recipient_email = app.config.get('MAIL_USERNAME')
        if not recipient_email:
            raise ValueError("Email recipient not configured (MAIL_USERNAME missing in .env or config.py).")

        msg = Message(
            subject=f"New Contact Form Submission: {subject}",
            recipients=[recipient_email],
            html=f"""
                <h3>New Contact Form Submission</h3>
                <p><strong>Name:</strong> {name}</p>
                <p><strong>Email:</strong> {email}</p>
                <p><strong>Subject:</strong> {subject}</p>
                <p><strong>Message:</strong> {message_body}</p>
            """
        )
        mail.send(msg)

        flash('Your message has been sent successfully!', 'success')
        return redirect(url_for('contact'))

    except Exception as e:
        app.logger.error(f"Error sending contact form email: {e}", exc_info=True)
        flash('Failed to send message. Please try again later. Check server logs for details.', 'danger')
        return redirect(url_for('contact'))


if __name__ == '__main__':
    app.run(debug=True)