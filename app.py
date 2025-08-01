import os
import 
from flask import Flask, render_template, request, jsonify, send_file, flash, redirect, url_for, session
from flask_mail import Mail, Message
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

import pandas as pd
import numpy as np
import io
from datetime import timedelta # For session timeout

from config import Config
from core.synthetic_data import generate_synthetic_dataframe, get_dataframe_summary, SCHEMAS, get_schema_fields_for_frontend
from core.eda_preprocessing import (
    load_dataframe, get_dataframe, update_dataframe, delete_dataframe, get_eda_summary,
    remove_rows_with_any_missing, remove_columns_with_high_missing,
    impute_missing_numerical, impute_missing_categorical,
    remove_duplicate_rows, remove_specific_columns, change_data_type,
    scale_columns, clean_text_capitalization, format_file_size, current_dataframes
)

app = Flask(__name__)
app.config.from_object(Config)

# Configure session (important for df_id persistence)
app.secret_key = app.config['SECRET_KEY'] # Ensure secret_key is set for session
app.permanent_session_lifetime = timedelta(minutes=30) # Session active for 30 min

# Initialize Flask-Mail
mail = Mail(app)

# Ensure necessary directories exist
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
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
    """No-Code EDA & Pre-processing page."""
    # Clean up any old EDA dataframe in memory if session exists and points to it
    if 'current_eda_df_id' in session:
        df_id = session['current_eda_df_id']
        if df_id in current_dataframes:
            delete_dataframe(df_id)
            app.logger.info(f"Cleaned up old EDA DataFrame {df_id} on new EDA page load.")
        session.pop('current_eda_df_id', None) # Always remove from session
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
        selected_columns = data.get('selectedColumns') # All columns (pre-defined + custom)
        custom_columns = data.get('customColumns', []) # Custom column definitions

        # Basic validation
        if not all([num_records, schema_name, locality, selected_columns is not None]):
            return jsonify({'success': False, 'message': 'Missing required parameters (records, schema, locality, columns).'}), 400
        if not isinstance(selected_columns, list) or not all(isinstance(col, str) for col in selected_columns):
            return jsonify({'success': False, 'message': 'Invalid format for selected columns (must be a list of strings).'}), 400
        if not isinstance(custom_columns, list):
             return jsonify({'success': False, 'message': 'Invalid format for custom columns (must be a list).'}), 400

        df_generated = generate_synthetic_dataframe(
            num_records=num_records,
            missing_percentage=float(missing_percentage),
            variance_ratio=float(variance_ratio),
            schema_name=schema_name,
            locality=locality,
            selected_columns=selected_columns,
            custom_columns=custom_columns
        )

        # Generate a unique ID for this DataFrame for later download
        df_id = str(uuid.uuid4())
        current_dataframes[df_id] = df_generated
        # No need to store df_id in session here, as downloads happen immediately with this ID

        # Generate preview data (first few rows) for display
        preview_df = df_generated.head(10).copy() 
        
        # Convert all numerical and datetime columns to standard Python types for JSON serialization
        for col in preview_df.columns:
            if pd.api.types.is_numeric_dtype(preview_df[col]):
                # Use .astype(object) to allow None for NaNs, then convert non-NaN to float
                preview_df[col] = preview_df[col].astype(object).apply(lambda x: float(x) if pd.notna(x) else None)
            elif pd.api.types.is_datetime64_any_dtype(preview_df[col]):
                preview_df[col] = preview_df[col].dt.isoformat().replace({np.nan: None})
            else: # For object/string/boolean types, just replace NaN with None
                preview_df[col] = preview_df[col].replace({np.nan: None})
        
        preview_data = preview_df.to_dict(orient='records')
        
        # Calculate summary statistics
        summary_stats = get_dataframe_summary(df_generated)
        summary_stats["fileSize"] = format_file_size(df_generated) # Add file size to summary

        # Generate download URLs
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
        })

    except ValueError as ve:
        app.logger.error(f"Validation error during data generation: {ve}", exc_info=True)
        return jsonify({'success': False, 'message': f'Input validation error: {str(ve)}'}), 400
    except Exception as e:
        app.logger.error(f"Error during data generation: {e}", exc_info=True)
        return jsonify({'success': False, 'message': f'An unexpected error occurred during data generation: {str(e)}. Please check server logs for full traceback.'}), 500


@app.route('/download_generated_data/<df_id>/<file_format>')
def download_generated_data(df_id, file_format):
    """
    Allows users to download the previously generated synthetic data.
    Sends data directly from memory.
    """
    try:
        df = get_dataframe(df_id)

        buffer = io.BytesIO()
        filename_prefix = f"synthetic_data_{df_id}"
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
                    df_temp[col] = df_temp[col].dt.isoformat().replace({np.nan: None})
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
            flash("Unsupported download format. Please choose CSV, JSON, or XLSX.", 'danger')
            return redirect(url_for('generator'))

        buffer.seek(0)
        
        # Use send_file for in-memory data
        return send_file(
            buffer,
            mimetype=mimetype,
            as_attachment=True,
            download_name=filename,
            last_modified=datetime.now() # Add last modified to help browser
        )

    except ValueError as ve:
        app.logger.error(f"Download error: {ve}", exc_info=True)
        flash(f"Download error: {str(ve)}", 'danger')
        return redirect(url_for('generator'))
    except Exception as e:
        app.logger.error(f"An unexpected error occurred during download: {e}", exc_info=True)
        flash(f"An unexpected error occurred during download: {str(e)}", 'danger')
        return redirect(url_for('generator'))


@app.route('/api/upload_eda_file', methods=['POST'])
def upload_eda_file():
    """
    Handles file uploads for the EDA module.
    """
    # Use session.permanent to keep session cookies for longer duration
    session.permanent = True 

    if 'file' not in request.files:
        return jsonify({'success': False, 'message': 'No file part in the request.'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'success': False, 'message': 'No selected file.'}), 400
    
    if file and Config.allowed_file(file.filename):
        # Before processing new file, clean up any previous DataFrame for this session
        if 'current_eda_df_id' in session:
            df_id_to_clear = session.pop('current_eda_df_id')
            if df_id_to_clear in current_dataframes:
                delete_dataframe(df_id_to_clear)
                app.logger.info(f"Cleaned up old EDA DataFrame {df_id_to_clear} before new upload.")

        try:
            # Load DataFrame directly from the file stream using its content
            df_id, df = load_dataframe(file.stream, file.filename)

            summary = get_eda_summary(df)
            summary["fileSize"] = format_file_size(df) # Add file size info

            session['current_eda_df_id'] = df_id # Store new df_id in Flask session
            
            return jsonify({
                'success': True,
                'message': f'File "{file.filename}" uploaded and processed successfully!',
                'df_id': df_id,
                'summary': summary
            })
        except ValueError as ve: # Catch specific value errors from pandas/read functions
            app.logger.error(f"File processing error: {ve}", exc_info=True)
            return jsonify({'success': False, 'message': f'File processing error: {str(ve)}. Please check file content and format.'}), 400
        except Exception as e:
            app.logger.error(f"Error processing uploaded EDA file: {e}", exc_info=True)
            return jsonify({'success': False, 'message': f'An unexpected error occurred during file upload: {str(e)}. Please check server logs.'}), 500
    else:
        return jsonify({'success': False, 'message': 'Invalid file type. Only .csv or .xlsx are allowed.'}), 400


@app.route('/api/eda/<action>', methods=['POST'])
def eda_action(action):
    """
    Generic endpoint for all EDA and pre-processing actions.
    """
    df_id = session.get('current_eda_df_id')
    
    if not df_id:
        return jsonify({'success': False, 'message': 'No active DataFrame found. Please upload a file first on the EDA page.'}), 400

    try:
        df = get_dataframe(df_id)
        original_rows = df.shape[0]
        original_cols = df.shape[1]
        
        message_prefix = f"Applied '{action}' operation."

        if action == 'remove_rows_missing':
            df = remove_rows_with_any_missing(df)
            message = f"Removed {original_rows - df.shape[0]} rows with missing values."
        elif action == 'remove_cols_high_missing':
            threshold = request.json.get('threshold')
            if threshold is None or not isinstance(threshold, (int, float)):
                raise ValueError("Missing or invalid 'threshold' for removing columns.")
            df = remove_columns_with_high_missing(df, threshold)
            message = f"Removed {original_cols - df.shape[1]} columns with >{threshold}% missing values."
        elif action == 'impute_numerical':
            columns = request.json.get('columns')
            strategy = request.json.get('strategy')
            if not columns or not isinstance(columns, list) or not strategy:
                raise ValueError("Missing or invalid 'columns' or 'strategy' for numerical imputation.")
            df = impute_missing_numerical(df, columns, strategy)
            message = f"Missing numerical values in {len(columns)} columns imputed using '{strategy}'."
        elif action == 'impute_categorical':
            columns = request.json.get('columns')
            if not columns or not isinstance(columns, list):
                raise ValueError("Missing or invalid 'columns' for categorical imputation.")
            df = impute_missing_categorical(df, columns)
            message = f"Missing categorical values in {len(columns)} columns imputed using mode."
        elif action == 'remove_duplicate_rows':
            df = remove_duplicate_rows(df)
            message = f"Removed {original_rows - df.shape[0]} duplicate rows."
        elif action == 'remove_columns':
            columns_to_remove = request.json.get('columns')
            if not columns_to_remove or not isinstance(columns_to_remove, list):
                raise ValueError("Missing or invalid 'columns' to remove.")
            df = remove_specific_columns(df, columns_to_remove)
            message = f"Removed {len(columns_to_remove)} selected columns."
        elif action == 'change_data_type':
            column = request.json.get('column')
            target_type = request.json.get('target_type')
            if not column or not target_type:
                raise ValueError("Missing 'column' or 'target_type' for conversion.")
            df = change_data_type(df, column, target_type)
            message = f"Column '{column}' converted to '{target_type}'."
        elif action == 'scale_columns':
            columns = request.json.get('columns')
            method = request.json.get('method')
            if not columns or not isinstance(columns, list) or not method:
                raise ValueError("Missing or invalid 'columns' or 'method' for scaling.")
            df = scale_columns(df, columns, method)
            message = f"Selected numerical columns scaled using '{method}' method."
        elif action == 'clean_text_capitalization':
            columns = request.json.get('columns')
            case_type = request.json.get('case_type')
            if not columns or not isinstance(columns, list) or not case_type:
                raise ValueError("Missing or invalid 'columns' or 'case_type' for text cleaning.")
            df = clean_text_capitalization(df, columns, case_type)
            message = f"Text capitalization applied ({case_type}) to selected columns."
        else:
            return jsonify({'success': False, 'message': 'Invalid EDA action specified.'}), 400

        update_dataframe(df_id, df) # Update the DataFrame in memory associated with df_id
        
        summary = get_eda_summary(df)
        summary["fileSize"] = format_file_size(df)

        return jsonify({
            'success': True,
            'message': message_prefix, # Use a more generic message here, specific messages for row/col changes are good
            'df_id': df_id,
            'summary': summary
        })

    except ValueError as ve:
        app.logger.error(f"EDA action validation/processing error for action '{action}': {ve}", exc_info=True)
        return jsonify({'success': False, 'message': f'Processing error: {str(ve)}'}), 400
    except Exception as e:
        app.logger.error(f"An unexpected error occurred during EDA action '{action}': {e}", exc_info=True)
        return jsonify({'success': False, 'message': f'An unexpected error occurred during EDA operation: {str(e)}. Check server logs for full traceback.'}), 500


@app.route('/api/eda/download_processed_data/<df_id>/<file_format>')
def download_processed_data(df_id, file_format):
    """
    Allows users to download the currently processed EDA DataFrame.
    Sends data directly from memory.
    """
    try:
        df = get_dataframe(df_id)

        buffer = io.BytesIO()
        filename_prefix = f"processed_data_{df_id}"
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
                    df_temp[col] = df_temp[col].dt.isoformat().replace({np.nan: None})
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
            flash("Unsupported download format. Please choose CSV, JSON, or XLSX.", 'danger')
            return redirect(url_for('eda'))

        buffer.seek(0)
        
        return send_file(
            buffer,
            mimetype=mimetype,
            as_attachment=True,
            download_name=filename,
            last_modified=datetime.now() # Add last modified to help browser
        )

    except ValueError as ve:
        app.logger.error(f"Download error: {ve}", exc_info=True)
        flash(f"Download error: {str(ve)}", 'danger')
        return redirect(url_for('eda'))
    except Exception as e:
        app.logger.error(f"An unexpected error occurred during download: {e}", exc_info=True)
        flash(f"An unexpected error occurred during download: {str(e)}", 'danger')
        return redirect(url_for('eda'))


@app.route('/submit_contact', methods=['POST'])
def submit_contact():
    """
    Handles the contact form submission. (Migrated from Node.js)
    """
    try:
        name = request.form.get('name')
        email = request.form.get('email')
        subject = request.form.get('subject')
        message_body = request.form.get('message')

        if not all([name, email, subject, message_body]):
            flash('All fields are required for the contact form.', 'danger')
            return redirect(url_for('contact'))

        # Get recipient from app.config directly
        recipient_email = app.config.get('MAIL_USERNAME') 
        if not recipient_email:
            raise ValueError("Recipient email for contact form is not configured (MAIL_USERNAME in .env).")

        msg = Message(
            subject=f"New Contact Form Submission: {subject}",
            sender=app.config.get('MAIL_DEFAULT_SENDER'), # Use configured sender
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
        flash(f'Failed to send message: {str(e)}. Please check server logs and email configuration.', 'danger')
        return redirect(url_for('contact'))


if __name__ == '__main__':
    app.run(debug=True)
