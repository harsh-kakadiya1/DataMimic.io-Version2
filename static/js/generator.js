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
    // Removed autoPlotsContainer


    let generatedDataPreview = [];
    let downloadUrls = {};

    // Removed charts object and Chart.register call


    // Helper function to show Flask-style flash messages
    function showFlashMessage(message, category) {
        const container = document.querySelector('.flash-messages-container');
        if (!container) return; 

        container.innerHTML = ''; // Clear existing messages

        const div = document.createElement('div');
        div.classList.add('flash-message', `flash-${category}`);
        div.innerHTML = `${message} <button type="button" class="close-btn" onclick="this.parentElement.style.display='none';" aria-label="Close">&times;</button>`;
        container.appendChild(div);

        setTimeout(() => {
            if (div.parentElement) div.style.display = 'none';
        }, 5000);
    }

    // Function to populate column selectors based on selected schema
    async function populateColumnSelectors(schema) {
        columnSelectContainer.innerHTML = ''; // Clear existing columns
        selectAllCheckbox.checked = false; // Uncheck select all by default when schema changes

        if (!schema) return;

        try {
            const response = await fetch(`/api/get_schema_columns/${schema}`);
            const result = await response.json();

            if (result.success) {
                const fields = result.default_columns;

                fields.forEach(field => {
                    const checkboxContainer = document.createElement('label');
                    checkboxContainer.className = 'column-checkbox';
                    
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.value = field;
                    checkbox.checked = true;
                    
                    checkboxContainer.appendChild(checkbox);
                    checkboxContainer.appendChild(document.createTextNode(field));
                    columnSelectContainer.appendChild(checkboxContainer);
                });
                selectAllCheckbox.checked = true;
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
                    colDef.decimal_places = 2;
                }
            } else if (colType === 'Date') {
                colDef.days_ago = 365;
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
        if (customColumnsData === null) {
            return;
        }
        
        // Determine all columns that should *actually* be in the final DataFrame for display purposes.
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
        
        // Removed plot related preparation for autoPlotsContainer
        
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
                    selectedColumns: finalDisplayColumns,
                    customColumns: customColumnsData
                })
            });

            const result = await response.json();

            if (result.success) {
                generatedDataPreview = result.preview_data;
                downloadUrls = result.download_paths;
                displayData(finalDisplayColumns, result.summary_stats);
                // Removed displayPlots(result.plots_data);
                showFlashMessage(result.message, 'success');
            } else {
                showFlashMessage(`Error: ${result.message}`, 'error');
                console.error("Backend error:", result.message);
                // Removed plot related error message
            }
        } catch (error) {
            console.error('Generation fetch error:', error);
            showFlashMessage('An error occurred during data generation. Please check console for details.', 'error');
            // Removed plot related network error message
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
    


    // Update chart selectors after data is generated
    function displayData(columns, summaryStats) {
        tableHeader.innerHTML = '';
        tableBody.innerHTML = '';
        columns.forEach(column => {
            const th = document.createElement('th');
            th.textContent = column;
            tableHeader.appendChild(th);
        });
        generatedDataPreview.forEach(record => {
            const tr = document.createElement('tr');
            columns.forEach(column => {
                const td = document.createElement('td');
                const value = record[column];
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
        displayDataStatistics(summaryStats, columns);
        resultsDiv.style.display = 'block';
    }
    
    // Function to display data statistics (using data from backend summary)
    function displayDataStatistics(summaryStats, columns) {
        totalRecordsElement.textContent = summaryStats.total_rows; 
        missingValuesElement.textContent = summaryStats.missing_values;
        dataVarianceElement.textContent = summaryStats.data_variance;
        fileSizeElement.textContent = summaryStats.fileSize;

        columnStatsElement.innerHTML = '';

        summaryStats.column_details.forEach(col_data => {
            if (columns.includes(col_data.name)) {
                const columnStatItem = document.createElement('div');
                columnStatItem.classList.add('column-stat-item');
                
                const columnName = document.createElement('div');
                columnName.classList.add('column-name');
                columnName.textContent = col_data.name; 
                
                const columnMetrics = document.createElement('div');
                columnMetrics.classList.add('column-metrics');
                
                const missingMetric = document.createElement('div');
                missingMetric.classList.add('metric');
                missingMetric.innerHTML = `
                    <span class="metric-value">${col_data.missing_percentage}</span>
                    <span class="metric-label">Missing</span>
                `;
                columnMetrics.appendChild(missingMetric);
                
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
                if (col_data.min !== null && col_data.min !== 'N/A') {
                    const minMaxMetric = document.createElement('div');
                    minMaxMetric.classList.add('metric');
                    minMaxMetric.innerHTML = `
                        <span class="metric-value">${col_data.min} / ${col_data.max}</span>
                        <span class="metric-label">Min / Max</span>
                    `;
                    columnMetrics.appendChild(minMaxMetric);
                }


                columnStatItem.appendChild(columnName);
                columnStatItem.appendChild(columnMetrics);
                columnStatsElement.appendChild(columnStatItem);
            }
        });
    }

    // Removed displayPlots function

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