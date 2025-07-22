document.addEventListener('DOMContentLoaded', () => {
    const uploadForm = document.getElementById('uploadForm');
    const fileUploadInput = document.getElementById('fileUpload');
    const edaLoading = document.getElementById('eda-loading');
    const edaResults = document.getElementById('eda-results');
    const edaTotalRows = document.getElementById('eda-total-rows');
    const edaTotalCols = document.getElementById('eda-total-cols');
    const edaFileSize = document.getElementById('eda-file-size');
    const columnDetailsTableBody = document.querySelector('#columnDetailsTable tbody');

    // Selects for pre-processing operations
    const imputeNumericalColsSelect = document.getElementById('impute_numerical_cols');
    const imputeCategoricalColsSelect = document.getElementById('impute_categorical_cols');
    const removeColumnsSelect = document.getElementById('remove_columns_select');
    const convertColSelect = document.getElementById('convert_col_select');
    const convertToTypeSelect = document.getElementById('convert_to_type');
    const scalingColsSelect = document.getElementById('scaling_cols_select');
    const textCleanColsSelect = document.getElementById('text_clean_cols');
    const missingColThresholdInput = document.getElementById('missing_col_threshold');

    let currentDfId = null; // Stores the ID of the DataFrame in the backend session

    // Helper function to show Flask-style flash messages
    function showFlashMessage(message, category) {
        const container = document.querySelector('.flash-messages-container');
        if (!container) return; 

        container.innerHTML = ''; // Clear existing messages

        const div = document.createElement('div');
        div.classList.add('flash-message', `flash-${category}`);
        div.innerHTML = `${message} <button type="button" class="close-btn" onclick="this.parentElement.style.display='none';" aria-label="Close">×</button>`;
        container.appendChild(div);

        setTimeout(() => {
            if (div.parentElement) div.style.display = 'none';
        }, 5000);
    }

    // Handle File Upload
    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const file = fileUploadInput.files[0];
        if (!file) {
            showFlashMessage('Please select a file to upload.', 'error');
            return;
        }

        edaLoading.style.display = 'block';
        edaResults.style.display = 'none'; // Hide results until new data is processed
        showFlashMessage('Uploading and processing file...', 'info');

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/api/upload_eda_file', {
                method: 'POST',
                body: formData
            });
            const result = await response.json();

            if (response.ok && result.success) { 
                currentDfId = result.df_id;
                displayEdaSummary(result.summary);
                edaResults.style.display = 'block';
                showFlashMessage(result.message, 'success');
            } else {
                const errorMessage = result.message || `Server responded with status ${response.status}`;
                showFlashMessage(`Upload Error: ${errorMessage}`, 'error');
                console.error("Backend upload error response:", result);
            }
        } catch (error) {
            console.error('Upload fetch error:', error);
            showFlashMessage('An error occurred during file upload. Please check console for network errors.', 'error');
        } finally {
            edaLoading.style.display = 'none';
        }
    });

    // Function to display EDA Summary
    function displayEdaSummary(summary) {
        edaTotalRows.textContent = summary.total_rows;
        edaTotalCols.textContent = summary.total_columns;
        edaFileSize.textContent = summary.fileSize || 'N/A'; 

        columnDetailsTableBody.innerHTML = '';
        summary.column_details.forEach(col => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${col.name}</td>
                <td>${col.dtype}</td>
                <td>${col.non_null_count}</td>
                <td>${col.missing_percentage}</td>
                <td>${col.unique_values}</td>
                <td>${col.min}</td>
                <td>${col.max}</td>
                <td>${col.mean}</td>
                <td>${col.median}</td>
                <td>${col.mode}</td>
                <td>${col.std}</td>
            `;
            columnDetailsTableBody.appendChild(tr);
        });

        updateColumnSelects(summary.column_details);
    }

    // Function to populate column multi-selects for pre-processing
    function updateColumnSelects(columnDetails) {
        // Clear all selects first
        imputeNumericalColsSelect.innerHTML = '';
        imputeCategoricalColsSelect.innerHTML = '';
        removeColumnsSelect.innerHTML = '';
        convertColSelect.innerHTML = '<option value="">-- Select Column --</option>'; // Single select needs default
        scalingColsSelect.innerHTML = '';
        textCleanColsSelect.innerHTML = '';

        columnDetails.forEach(col => {
            const option = document.createElement('option');
            option.value = col.name;
            option.textContent = col.name;

            // Numerical Imputation/Scaling: Target numeric dtypes.
            const isNumeric = ['int64', 'float64', 'Int64', 'int32', 'float32'].includes(col.dtype);
            if (isNumeric) { 
                imputeNumericalColsSelect.appendChild(option.cloneNode(true));
                scalingColsSelect.appendChild(option.cloneNode(true));
            }
            
            // Categorical Imputation: Target non-numeric, non-datetime columns.
            const isDateTime = col.dtype.startsWith('datetime');
            // If it's not strictly numeric or datetime, treat as potentially categorical for imputation
            if (!isNumeric && !isDateTime) {
                imputeCategoricalColsSelect.appendChild(option.cloneNode(true));
            }
            
            // Remove Columns: All columns
            removeColumnsSelect.appendChild(option.cloneNode(true));

            // Type Conversion: All columns
            convertColSelect.appendChild(option.cloneNode(true));

            // Text Cleaning: For object/string columns. Check for non-zero unique values.
            if (['object', 'string'].includes(col.dtype) && col.unique_values > 0) { 
                textCleanColsSelect.appendChild(option.cloneNode(true));
            }
        });
    }

    // Handle Pre-processing Operations
    document.querySelectorAll('.preprocessing-section button.generate-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            const action = e.target.dataset.action;
            let payload = { df_id: currentDfId };
            let endpoint = '';

            if (!currentDfId) {
                showFlashMessage('No file loaded. Please upload a file first.', 'error');
                return;
            }

            switch (action) {
                case 'remove_rows_missing':
                    endpoint = '/api/eda/remove_rows_missing';
                    break;
                case 'remove_cols_high_missing':
                    endpoint = '/api/eda/remove_cols_high_missing';
                    const threshold = parseFloat(missingColThresholdInput.value);
                    if (isNaN(threshold) || threshold < 0 || threshold > 100) {
                        showFlashMessage('Please enter a valid percentage (0-100) for missing column threshold.', 'error');
                        return;
                    }
                    payload.threshold = threshold;
                    break;
                case 'impute_mean':
                case 'impute_median':
                case 'impute_mode_num':
                    endpoint = '/api/eda/impute_numerical';
                    payload.columns = Array.from(imputeNumericalColsSelect.selectedOptions).map(opt => opt.value);
                    payload.strategy = action.replace('impute_', '').replace('_num', ''); // 'mean', 'median', 'mode'
                    if (payload.columns.length === 0) {
                        showFlashMessage('Please select at least one numerical column for imputation.', 'error');
                        return;
                    }
                    break;
                case 'impute_mode_cat':
                    endpoint = '/api/eda/impute_categorical';
                    payload.columns = Array.from(imputeCategoricalColsSelect.selectedOptions).map(opt => opt.value);
                    if (payload.columns.length === 0) {
                        showFlashMessage('Please select at least one categorical column for imputation.', 'error');
                        return;
                    }
                    break;
                case 'remove_duplicate_rows':
                    endpoint = '/api/eda/remove_duplicate_rows';
                    break;
                case 'remove_selected_columns':
                    endpoint = '/api/eda/remove_columns';
                    payload.columns = Array.from(removeColumnsSelect.selectedOptions).map(opt => opt.value);
                    if (payload.columns.length === 0) {
                        showFlashMessage('Please select at least one column to remove.', 'error');
                        return;
                    }
                    break;
                case 'change_data_type':
                    endpoint = '/api/eda/change_data_type';
                    payload.column = convertColSelect.value;
                    payload.target_type = convertToTypeSelect.value;
                    if (!payload.column || !payload.target_type) {
                        showFlashMessage('Please select both a column and a target type for conversion.', 'error');
                        return;
                    }
                    break;
                case 'min_max_scale':
                    endpoint = '/api/eda/scale_columns';
                    payload.columns = Array.from(scalingColsSelect.selectedOptions).map(opt => opt.value);
                    payload.method = 'min_max'; // Hardcoded, matches backend
                    if (payload.columns.length === 0) {
                        showFlashMessage('Please select at least one numerical column for Min-Max Scaling.', 'error');
                        return;
                    }
                    break;
                case 'standardize': // This is the button action for Z-score
                    endpoint = '/api/eda/scale_columns';
                    payload.columns = Array.from(scalingColsSelect.selectedOptions).map(opt => opt.value);
                    payload.method = 'standard'; // Corrected to 'standard' for backend
                    if (payload.columns.length === 0) {
                        showFlashMessage('Please select at least one numerical column for Standardization.', 'error');
                        return;
                    }
                    break;
                case 'uppercase':
                    endpoint = '/api/eda/clean_text_capitalization';
                    payload.columns = Array.from(textCleanColsSelect.selectedOptions).map(opt => opt.value);
                    payload.case_type = 'upper'; // Corrected to 'upper' for backend
                    if (payload.columns.length === 0) {
                        showFlashMessage('Please select at least one text column for UPPERCASE conversion.', 'error');
                        return;
                    }
                    break;
                case 'lowercase':
                    endpoint = '/api/eda/clean_text_capitalization';
                    payload.columns = Array.from(textCleanColsSelect.selectedOptions).map(opt => opt.value);
                    payload.case_type = 'lower'; // Corrected to 'lower' for backend
                    if (payload.columns.length === 0) {
                        showFlashMessage('Please select at least one text column for lowercase conversion.', 'error');
                        return;
                    }
                    break;
                case 'titlecase':
                    endpoint = '/api/eda/clean_text_capitalization';
                    payload.columns = Array.from(textCleanColsSelect.selectedOptions).map(opt => opt.value);
                    payload.case_type = 'title'; // Corrected to 'title' for backend
                    if (payload.columns.length === 0) {
                        showFlashMessage('Please select at least one text column for Title Case conversion.', 'error');
                        return;
                    }
                    break;
                default:
                    showFlashMessage('Unknown pre-processing action.', 'error');
                    return;
            }

            edaLoading.style.display = 'block';
            try {
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });
                const result = await response.json();

                if (response.ok && result.success) {
                    currentDfId = result.df_id; // Update df_id in case it needs to be updated (though usually same)
                    displayEdaSummary(result.summary); // Re-render summary with new data
                    showFlashMessage(result.message, 'success');
                } else {
                    const errorMessage = result.message || `Server responded with status ${response.status}.`;
                    showFlashMessage(`Operation Error: ${errorMessage}`, 'error');
                    console.error('Backend operation error response:', result);
                }
            } catch (error) {
                console.error('Pre-processing fetch error:', error);
                showFlashMessage('An error occurred during pre-processing. Please try again.', 'error');
            } finally {
                edaLoading.style.display = 'none';
            }
        });
    });

    // Download Processed Data - FIXED implementation
    document.querySelectorAll('.preprocessing-section .download-btn').forEach(button => {
        button.addEventListener('click', (e) => { // No 'async' needed here
            console.log('EDA Download button clicked.'); // Debug log
            if (!currentDfId) {
                showFlashMessage('No processed data to download. Please upload a file and apply operations.', 'error');
                return;
            }
            const format = e.target.dataset.downloadFormat;
            const downloadUrl = `/api/eda/download_processed_data/${currentDfId}/${format}`;
            
            // Create a temporary anchor element to trigger download
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `processed_data.${format}`; // Suggest a filename
            document.body.appendChild(a); // Append to body to make it clickable in all browsers
            a.click(); // Programmatically click the anchor
            document.body.removeChild(a); // Remove the anchor after click
            console.log(`Attempting download from: ${downloadUrl}`); // Debug log
        });
    });
});