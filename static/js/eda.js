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

    // REMOVED: Plotting elements (no longer needed as backend plotting removed)
    // const edaPlotsContainer = document.getElementById('eda-plots-container'); 
    // const plotColumnSelect = document.getElementById('plot_column_select');
    // const scatterXSelect = document.getElementById('scatter_x_select');
    // const scatterYSelect = document.getElementById('scatter_y_select');

    let currentDfId = null;

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

    // REMOVED: Function to display plots (no longer needed)
    // function displayEdaPlots(plotsHtmlData) {
    //     edaPlotsContainer.innerHTML = ''; 
    //     if (plotsHtmlData && Object.keys(plotsHtmlData).length > 0) { /* ... */ }
    // }


    // Handle File Upload
    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const file = fileUploadInput.files[0];
        if (!file) {
            showFlashMessage('Please select a file to upload.', 'error');
            return;
        }

        edaLoading.style.display = 'block';
        edaResults.style.display = 'none';
        // REMOVED: edaPlotsContainer.innerHTML = ''; // Clear any previous plots
        
        showFlashMessage('Uploading and processing file...', 'info');

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/api/upload_eda_file', {
                method: 'POST',
                body: formData
            });
            const result = await response.json();

            if (result.success) {
                currentDfId = result.df_id;
                displayEdaSummary(result.summary);
                // REMOVED: displayEdaPlots(result.plots_html); // Display initial plots
                edaResults.style.display = 'block';
                showFlashMessage(result.message, 'success');
            } else {
                showFlashMessage(result.message, 'error');
                edaResults.style.display = 'none'; 
            }
        } catch (error) {
            console.error('Upload error:', error);
            showFlashMessage('An error occurred during file upload. Please try again.', 'error');
            edaResults.style.display = 'none';
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
                <td>${col.min !== null && col.min !== 'N/A' ? col.min : 'N/A'}</td>
                <td>${col.max !== null && col.max !== 'N/A' ? col.max : 'N/A'}</td>
                <td>${col.mean !== null && col.mean !== 'N/A' ? col.mean : 'N/A'}</td>
                <td>${col.median !== null && col.median !== 'N/A' ? col.median : 'N/A'}</td>
                <td>${col.mode !== null && col.mode !== 'N/A' ? (typeof col.mode === 'object' ? JSON.stringify(col.mode) : col.mode) : 'N/A'}</td>
                <td>${col.std !== null && col.std !== 'N/A' ? col.std : 'N/A'}</td>
            `;
            columnDetailsTableBody.appendChild(tr);
        });

        updateColumnSelects(summary.column_details);
        // REMOVED: populatePlotColumnSelects(summary.column_details);
    }

    // Function to populate all column multi-selects for pre-processing
    function updateColumnSelects(columnDetails) {
        imputeNumericalColsSelect.innerHTML = '';
        imputeCategoricalColsSelect.innerHTML = '';
        removeColumnsSelect.innerHTML = '';
        convertColSelect.innerHTML = '<option value="">-- Select Column --</option>';
        scalingColsSelect.innerHTML = '';
        textCleanColsSelect.innerHTML = '';

        columnDetails.forEach(col => {
            const option = document.createElement('option');
            option.value = col.name;
            option.textContent = col.name;

            const isNumeric = ['int64', 'float64', 'Int64', 'int32', 'float32'].includes(col.dtype);
            if (isNumeric) { 
                imputeNumericalColsSelect.appendChild(option.cloneNode(true));
                scalingColsSelect.appendChild(option.cloneNode(true));
            }
            
            const isCategorical = ['object', 'string', 'bool', 'category'].includes(col.dtype);
            const isDateTime = col.dtype.startsWith('datetime');
            if (!isNumeric && !isDateTime) { 
                imputeCategoricalColsSelect.appendChild(option.cloneNode(true));
            }
            
            removeColumnsSelect.appendChild(option.cloneNode(true));
            convertColSelect.appendChild(option.cloneNode(true));

            if (['object', 'string'].includes(col.dtype)) { 
                textCleanColsSelect.appendChild(option.cloneNode(true));
            }
        });
    }

    // REMOVED: Function to populate column selects for plotting (no longer needed)
    // function populatePlotColumnSelects(columnDetails) { /* ... */ }

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

            // REMOVED: edaPlotsContainer.innerHTML = ''; // Clear plots before new operation
            
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
                    payload.strategy = action.replace('impute_', '').replace('_num', '');
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
                case 'standardize':
                    endpoint = '/api/eda/scale_columns';
                    payload.columns = Array.from(scalingColsSelect.selectedOptions).map(opt => opt.value);
                    payload.method = action.replace('_scale', '');
                    if (payload.columns.length === 0) {
                        showFlashMessage('Please select at least one numerical column for scaling.', 'error');
                        return;
                    }
                    break;
                case 'uppercase':
                case 'lowercase':
                case 'titlecase':
                    endpoint = '/api/eda/clean_text_capitalization';
                    payload.columns = Array.from(textCleanColsSelect.selectedOptions).map(opt => opt.value);
                    payload.case_type = action; 
                    if (payload.columns.length === 0) {
                        showFlashMessage('Please select at least one text column for capitalization cleaning.', 'error');
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

                if (result.success) {
                    currentDfId = result.df_id;
                    displayEdaSummary(result.summary);
                    // REMOVED: displayEdaPlots(result.plots_html); // Re-display plots after pre-processing
                    showFlashMessage(result.message, 'success');
                } else {
                    showFlashMessage(result.message, 'error');
                }
            } catch (error) {
                console.error('Pre-processing error:', error);
                showFlashMessage('An error occurred during pre-processing. Please try again.', 'error');
            } finally {
                edaLoading.style.display = 'none';
            }
        });
    });

    // REMOVED: Handle Plotting Operations (no longer needed)
    // document.querySelectorAll('.plot-generation-section .generate-btn').forEach(button => { /* ... */ });

    // Download Processed Data
    document.querySelectorAll('.results .download-btn').forEach(button => { 
        button.addEventListener('click', async (e) => {
            if (!currentDfId) {
                showFlashMessage('No processed data to download. Please upload a file and apply operations.', 'error');
                return;
            }
            const format = e.target.dataset.downloadFormat;
            const downloadUrl = `/api/eda/download_processed_data/${currentDfId}/${format}`;
            
            window.location.href = downloadUrl;
        });
    });
});