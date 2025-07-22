document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const schemaSelect = document.getElementById('schemaSelect');
    const localitySelect = document.getElementById('localitySelect');
    const numRecordsInput = document.getElementById('numRecords');
    const missingRatioSlider = document.getElementById('missingRatio');
    const missingRatioValue = document.getElementById('missingRatioValue');
    const varianceRatioSlider = document.getElementById('varianceRatio');
    const varianceRatioValue = document.getElementById('varianceRatioValue');
    const columnSelectContainer = document.getElementById('columnSelect');
    const generateBtn = document.getElementById('generateBtn');
    const loadingDiv = document.getElementById('loading');
    const resultsDiv = document.getElementById('results');
    const tableHeader = document.getElementById('tableHeader');
    const tableBody = document.getElementById('tableBody');
    const downloadCsvBtn = document.getElementById('downloadCsvBtn');
    const downloadJsonBtn = document.getElementById('downloadJsonBtn');
    const downloadExcelBtn = document.getElementById('downloadExcelBtn');
    const selectAllCheckbox = document.getElementById('selectAll');
    const totalRecordsElement = document.getElementById('totalRecords');
    const missingValuesElement = document.getElementById('missingValues');
    const dataVarianceElement = document.getElementById('dataVariance');
    const columnStatsElement = document.getElementById('columnStats');
    const fileSizeElement = document.getElementById('fileSize');

    const customColumnsContainer = document.getElementById('custom_columns_container');

    let generatedDataPreview = []; // Stores the first few rows sent from backend for preview table
    let downloadUrls = {}; // Stores download links provided by backend

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

    // Function to populate column selectors based on selected schema
    async function populateColumnSelectors(schema) {
        columnSelectContainer.innerHTML = ''; // Clear existing columns
        selectAllCheckbox.checked = false; // Uncheck select all by default when schema changes

        if (!schema) return; // Do nothing if no schema is selected

        try {
            const response = await fetch(`/api/get_schema_columns/${schema}`);
            const result = await response.json();

            if (result.success) {
                const fields = result.default_columns; // Get default columns from backend

                fields.forEach(field => {
                    const checkboxContainer = document.createElement('label');
                    checkboxContainer.className = 'column-checkbox';
                    
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.value = field;
                    checkbox.checked = true; // Default to all selected for new schema
                    
                    checkboxContainer.appendChild(checkbox);
                    checkboxContainer.appendChild(document.createTextNode(field));
                    columnSelectContainer.appendChild(checkboxContainer);
                });
                selectAllCheckbox.checked = true; // Mark select all after populating
            } else {
                console.error('Error fetching schema columns:', result.message);
                showFlashMessage(`Error loading schema columns: ${result.message}`, 'error');
            }
        } catch (error) {
            console.error('Network or server error fetching schema columns:', error);
            showFlashMessage('Network error fetching schema columns. Please try again.', 'error');
        }
    }
    
    // Event listener for schema selection
    schemaSelect.addEventListener('change', function() {
        const schema = this.value;
        populateColumnSelectors(schema);
    });
    
    // Event listener for select all checkbox
    selectAllCheckbox.addEventListener('change', function() {
        const checkboxes = document.querySelectorAll('#columnSelect input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = this.checked;
        });
    });
    
    // Initial population for default selected schema on page load
    if (schemaSelect.value) {
        populateColumnSelectors(schemaSelect.value);
    } else {
        columnSelectContainer.innerHTML = '';
        selectAllCheckbox.checked = false;
    }

    // Function to collect custom column data from UI
    function collectCustomColumns() {
        const customColumns = [];
        const customColumnRows = customColumnsContainer.querySelectorAll('.custom-column-row-group');
        
        for (const row of customColumnRows) {
            const nameInput = row.querySelector('input[name="custom_col_name[]"]');
            const typeSelect = row.querySelector('select[name="custom_col_type[]"]');
            const catValuesInput = row.querySelector('input[name="custom_col_categorical_values[]"]');
            const rangeMinInput = row.querySelector('input[name="custom_col_range_min[]"]');
            const rangeMaxInput = row.querySelector('input[name="custom_col_range_max[]"]');

            const colName = nameInput ? nameInput.value.trim() : '';
            const colType = typeSelect ? typeSelect.value : '';

            if (!colName || !colType) {
                showFlashMessage(`Custom column: Both name and type are required for each custom column.`, 'error');
                return null;
            }

            let colDef = {
                name: colName,
                type: colType
            };

            if (colType === 'Categorical') {
                const values = catValuesInput ? catValuesInput.value.split(',').map(v => v.trim()).filter(v => v !== '') : [];
                if (values.length === 0) {
                    showFlashMessage(`Custom column '${colName}': Categorical type requires comma-separated values.`, 'error');
                    return null;
                }
                colDef.values = values;
            } else if (colType === 'Integer' || colType === 'Float') {
                const minValRaw = rangeMinInput ? rangeMinInput.value.trim() : '';
                const maxValRaw = rangeMaxInput ? rangeMaxInput.value.trim() : '';

                if (minValRaw === '' || maxValRaw === '') {
                    showFlashMessage(`Custom column '${colName}': Numeric type requires valid min/max values.`, 'error');
                    return null;
                }
                
                const minVal = parseFloat(minValRaw);
                const maxVal = parseFloat(maxValRaw);

                if (isNaN(minVal) || isNaN(maxVal)) {
                     showFlashMessage(`Custom column '${colName}': Min/Max values must be valid numbers.`, 'error');
                     return null;
                }
                
                if (minVal > maxVal) {
                    showFlashMessage(`Custom column '${colName}': Min value cannot be greater than max value.`, 'error');
                    return null;
                }
                colDef.range = [minVal, maxVal];
                if (colType === 'Float') {
                    colDef.decimal_places = 2; // Default, can be a UI input later
                }
            } else if (colType === 'Date') {
                // If custom date, currently no UI for days_ago/years_from_now.
                // Backend default will be used, or we could add UI fields.
                colDef.days_ago = 365; // Example default if no range is specified
            }
            customColumns.push(colDef);
        }
        return customColumns;
    }


    // Event listener for generate button (AJAX call to Flask backend)
    generateBtn.addEventListener('click', async function() {
        const schema = schemaSelect.value;
        const locality = localitySelect.value;
        const numRecords = parseInt(numRecordsInput.value);
        const missingRatio = parseInt(missingRatioSlider.value);
        const varianceRatio = parseInt(varianceRatioSlider.value);
        
        // Client-side validation
        if (!schema) {
            showFlashMessage('Please select a schema.', 'error');
            return;
        }
        if (!locality) {
            showFlashMessage('Please select a locality.', 'error');
            return;
        }
        if (isNaN(numRecords) || numRecords < 1 || numRecords > 100000) {
            showFlashMessage('Number of records must be between 1 and 100,000.', 'error');
            return;
        }
        
        // Get selected columns from pre-defined schema UI
        const checkboxes = document.querySelectorAll('#columnSelect input[type="checkbox"]:checked');
        const selectedSchemaColumns = Array.from(checkboxes).map(cb => cb.value);

        // Collect custom columns data
        const customColumnsData = collectCustomColumns();
        if (customColumnsData === null) { // Error occurred during custom column collection
            return; // Stop generation
        }
        
        // Determine all columns that should *actually* be in the final DataFrame for display purposes.
        // This includes selected pre-defined columns AND all custom columns.
        let finalDisplayColumns = [...selectedSchemaColumns];
        customColumnsData.forEach(cc => {
            if (!finalDisplayColumns.includes(cc.name)) {
                finalDisplayColumns.push(cc.name);
            }
        });

        if (finalDisplayColumns.length === 0) {
            showFlashMessage('Please select or define at least one column for generation.', 'error');
            return;
        }
        
        // Show loading animation and hide results
        loadingDiv.style.display = 'block';
        resultsDiv.style.display = 'none';
        
        showFlashMessage('Generating data...', 'info');

        try {
            const response = await fetch('/api/generate_data', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    numRecords,
                    missingRatio,
                    varianceRatio,
                    schemaSelect: schema,
                    localitySelect: locality,
                    selectedColumns: finalDisplayColumns, // Send to backend to filter final DF
                    customColumns: customColumnsData // Send custom column definitions separately
                })
            });

            const result = await response.json();

            if (response.ok && result.success) { // Check both HTTP OK and custom success flag
                generatedDataPreview = result.preview_data;
                downloadUrls = result.download_paths;
                // Pass finalDisplayColumns to displayData as it dictates the table order/presence
                displayData(finalDisplayColumns, result.summary_stats); 
                showFlashMessage(result.message, 'success');
            } else {
                // Handle non-OK HTTP status or backend success: false
                const errorMessage = result.message || `Server responded with status ${response.status}`;
                showFlashMessage(`Error: ${errorMessage}`, 'error');
                console.error("Backend error response:", result);
            }
        } catch (error) {
            console.error('Generation fetch error:', error);
            showFlashMessage('An error occurred during data generation. Please check console for network errors.', 'error');
        } finally {
            loadingDiv.style.display = 'none';
        }
    });
    
    // Event Listeners for sliders to update displayed value
    missingRatioSlider.addEventListener('input', function() {
        missingRatioValue.textContent = this.value + '%';
    });
    
    varianceRatioSlider.addEventListener('input', function() {
        varianceRatioValue.textContent = this.value + '%';
    });
    
    // Function to display generated data (preview and stats)
    function displayData(columns, summaryStats) {
        // Clear table
        tableHeader.innerHTML = '';
        tableBody.innerHTML = '';
        
        // Add table headers based on `columns` (which should include custom ones now)
        columns.forEach(column => {
            const th = document.createElement('th');
            th.textContent = column;
            tableHeader.appendChild(th);
        });
        
        // Add table rows (using preview data from backend)
        generatedDataPreview.forEach(record => {
            const tr = document.createElement('tr');
            columns.forEach(column => { // Iterate through passed 'columns' to ensure order and presence
                const td = document.createElement('td');
                const value = record[column]; // Get value for the specific column from the preview record
                if (value === null || value === undefined) {
                    td.textContent = 'NULL';
                    td.classList.add('missing-value');
                } else {
                    td.textContent = value;
                }
                tr.appendChild(td);
            });
            tableBody.appendChild(tr);
        });
        
        // Display data statistics
        displayDataStatistics(summaryStats, columns); // Pass `columns` to filter summary display
        
        // Show results
        resultsDiv.style.display = 'block';
    }
    
    // Function to display data statistics (using data from backend summary)
    function displayDataStatistics(summaryStats, columns) {
        totalRecordsElement.textContent = summaryStats.total_rows; 
        missingValuesElement.textContent = summaryStats.missing_values;
        dataVarianceElement.textContent = summaryStats.data_variance;
        fileSizeElement.textContent = summaryStats.fileSize;

        columnStatsElement.innerHTML = ''; // Clear previous column stats

        // Iterate through column_details from backend summary for column-specific stats
        summaryStats.column_details.forEach(col_data => {
            // Only display stats for columns that were actually requested and generated
            if (columns.includes(col_data.name)) { // Ensure the column is part of the final generated set
                const columnStatItem = document.createElement('div');
                columnStatItem.classList.add('column-stat-item');
                
                const columnName = document.createElement('div');
                columnName.classList.add('column-name');
                columnName.textContent = col_data.name; 
                
                const columnMetrics = document.createElement('div');
                columnMetrics.classList.add('column-metrics');
                
                // Missing percentage for this column
                const missingMetric = document.createElement('div');
                missingMetric.classList.add('metric');
                missingMetric.innerHTML = `
                    <span class="metric-value">${col_data.missing_percentage}</span>
                    <span class="metric-label">Missing</span>
                `;
                columnMetrics.appendChild(missingMetric);
                
                // Add other relevant stats if backend sends them (e.g., mean, std for numerical)
                if (col_data.mean !== null && col_data.mean !== 'N/A') { 
                    const meanMetric = document.createElement('div');
                    meanMetric.classList.add('metric');
                    meanMetric.innerHTML = `
                        <span class="metric-value">${col_data.mean}</span>
                        <span class="metric-label">Mean</span>
                    `;
                    columnMetrics.appendChild(meanMetric);
                }
                if (col_data.std !== null && col_data.std !== 'N/A') {
                    const stdMetric = document.createElement('div');
                    stdMetric.classList.add('metric');
                    stdMetric.innerHTML = `
                        <span class="metric-value">${col_data.std}</span>
                        <span class="metric-label">Std Dev</span>
                    `;
                    columnMetrics.appendChild(stdMetric);
                }
                if (col_data.unique_values !== null && col_data.unique_values !== 'N/A') {
                    const uniqueMetric = document.createElement('div');
                    uniqueMetric.classList.add('metric');
                    uniqueMetric.innerHTML = `
                        <span class="metric-value">${col_data.unique_values}</span>
                        <span class="metric-label">Unique</span>
                    `;
                    columnMetrics.appendChild(uniqueMetric);
                }

                columnStatItem.appendChild(columnName);
                columnStatItem.appendChild(columnMetrics);
                columnStatsElement.appendChild(columnStatItem);
            }
        });
    }

    // Functions to download files (now handled by backend URLs)
    downloadCsvBtn.addEventListener('click', () => {
        if (downloadUrls.csv) {
            window.location.href = downloadUrls.csv;
        } else {
            showFlashMessage('No CSV data available for download. Generate data first.', 'error');
        }
    });

    downloadJsonBtn.addEventListener('click', () => {
        if (downloadUrls.json) {
            window.location.href = downloadUrls.json;
        } else {
            showFlashMessage('No JSON data available for download. Generate data first.', 'error');
        }
    });

    downloadExcelBtn.addEventListener('click', () => {
        if (downloadUrls.excel) {
            window.location.href = downloadUrls.excel;
        } else {
            showFlashMessage('No Excel data available for download. Generate data first.', 'error');
        }
    });
});