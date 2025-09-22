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

    // NEW: AI Custom Column elements
    const aiCustomColumnNameInput = document.getElementById('ai_custom_col_name');
    const aiCustomColumnTypeSelect = document.getElementById('ai_custom_col_type');
    const aiCustomColumnPromptTextarea = document.getElementById('ai_custom_col_prompt');
    const addAiCustomColumnBtn = document.getElementById('add_ai_custom_column_btn');
    const aiCustomColumnsListContainer = document.getElementById('ai_custom_columns_list');
    
    let aiCustomColumnsDefinitions = []; // Array to hold AI custom column definitions

    let generatedDataPreview = [];
    let downloadUrls = {};
    let currentRequest = null; // Store current request for cancellation

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

    // Function to populate schema columns (no changes needed)
    async function populateColumnSelectors(schema) {
        columnSelectContainer.innerHTML = ''; 
        selectAllCheckbox.checked = false; 

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
    
    // Event listener for schema selection (no changes needed)
    schemaSelect.addEventListener('change', function() {
        const schema = this.value;
        populateColumnSelectors(schema);
    });
    
    // Event listener for select all checkbox (no changes needed)
    selectAllCheckbox.addEventListener('change', function() {
        const checkboxes = document.querySelectorAll('#columnSelect input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = this.checked;
        });
    });
    
    // Initial population for default selected schema on page load (no changes needed)
    if (schemaSelect.value) {
        populateColumnSelectors(schemaSelect.value);
    } else {
        columnSelectContainer.innerHTML = '';
        selectAllCheckbox.checked = false;
    }

    // --- NEW: AI Custom Column Logic ---

    // Function to render the list of AI custom columns on the UI
    function renderAiCustomColumnsList() {
        aiCustomColumnsListContainer.innerHTML = '';
        if (aiCustomColumnsDefinitions.length === 0) {
            aiCustomColumnsListContainer.innerHTML = '<p class="text-muted">No AI custom columns added yet.</p>';
            return;
        }

        aiCustomColumnsDefinitions.forEach((col, index) => {
            const li = document.createElement('li');
            li.classList.add('list-group-item', 'd-flex', 'justify-content-between', 'align-items-center');
            li.innerHTML = `
                <span><strong>${col.name}</strong> (${col.type}): ${col.prompt_description}</span>
                <button type="button" class="btn btn-sm btn-outline-danger remove-ai-custom-col-btn" data-index="${index}">
                    <i class="fas fa-trash"></i> Remove
                </button>
            `;
            aiCustomColumnsListContainer.appendChild(li);
        });

        // Attach event listeners to new remove buttons
        document.querySelectorAll('.remove-ai-custom-col-btn').forEach(button => {
            button.addEventListener('click', function() {
                const indexToRemove = parseInt(this.dataset.index);
                aiCustomColumnsDefinitions.splice(indexToRemove, 1);
                renderAiCustomColumnsList(); // Re-render the list
            });
        });
    }

    // Event listener for adding an AI Custom Column
    addAiCustomColumnBtn.addEventListener('click', function() {
        const name = aiCustomColumnNameInput.value.trim();
        const type = aiCustomColumnTypeSelect.value;
        const prompt = aiCustomColumnPromptTextarea.value.trim();

        if (!name || !type || !prompt) {
            showFlashMessage('Please fill in all fields (Name, Type, Prompt) for the AI Custom Column.', 'error');
            return;
        }

        // Check for duplicate names (case-insensitive)
        if (aiCustomColumnsDefinitions.some(col => col.name.toLowerCase() === name.toLowerCase())) {
            showFlashMessage(`An AI custom column with the name '${name}' already exists.`, 'error');
            return;
        }
        // Also check against selected pre-defined columns (for robustness)
        const selectedSchemaColumns = Array.from(document.querySelectorAll('#columnSelect input[type="checkbox"]:checked')).map(cb => cb.value);
        if (selectedSchemaColumns.some(colName => colName.toLowerCase() === name.toLowerCase())) {
            showFlashMessage(`The custom column name '${name}' conflicts with a pre-defined schema column. Please choose a different name.`, 'error');
            return;
        }


        aiCustomColumnsDefinitions.push({
            name: name,
            type: type,
            prompt_description: prompt,
            generated_values: [] // Placeholder for AI-generated values
        });

        aiCustomColumnNameInput.value = '';
        aiCustomColumnTypeSelect.value = ''; // Reset select
        aiCustomColumnPromptTextarea.value = '';

        renderAiCustomColumnsList();
        showFlashMessage(`AI Custom Column '${name}' added.`, 'success');
    });

    renderAiCustomColumnsList(); // Initial render of the AI custom columns list


    // Event listener for generate button (AJAX call to Flask backend)
    generateBtn.addEventListener('click', async function() {
        // Cancel any previous request if it exists
        if (currentRequest) {
            console.log('Cancelling previous request...');
            currentRequest.abort();
            currentRequest = null;
        }
        
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
        let selectedSchemaColumns = Array.from(checkboxes).map(cb => cb.value);

        // --- NEW: AI Custom Column Data Generation and Integration ---
        if (aiCustomColumnsDefinitions.length > 0) {
            showFlashMessage('Generating AI-powered column values...', 'info');
            loadingDiv.style.display = 'block'; // Show global loading for AI generation
            resultsDiv.style.display = 'none';

            // Iterate through each AI custom column definition
            for (let i = 0; i < aiCustomColumnsDefinitions.length; i++) {
                const colDef = aiCustomColumnsDefinitions[i];
                showFlashMessage(`AI generating values for column: ${colDef.name}...`, 'info');

                try {
                    // Create AbortController for AI request cancellation
                    const aiAbortController = new AbortController();
                    currentRequest = aiAbortController; // Store for potential cancellation
                    
                    const aiResponse = await fetch('/api/generate_ai_column_values', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            col_type: colDef.type,
                            prompt_description: colDef.prompt_description,
                            num_records: numRecords // Request AI to generate up to numRecords values
                        }),
                        signal: aiAbortController.signal // Add abort signal
                    });
                    const aiResult = await aiResponse.json();

                    if (aiResult.success) {
                        aiCustomColumnsDefinitions[i].generated_values = aiResult.generated_values;
                        showFlashMessage(`AI successfully generated ${aiResult.num_records_generated_by_ai} values for '${colDef.name}'.`, 'success');
                        // Add AI column to the list of selected columns so it appears in the final DataFrame
                        if (!selectedSchemaColumns.includes(colDef.name)) {
                            selectedSchemaColumns.push(colDef.name);
                        }
                    } else {
                        showFlashMessage(`AI failed to generate values for '${colDef.name}': ${aiResult.message}`, 'error');
                        // Optionally, you could mark this column for exclusion or fill with placeholder
                        // For now, it will be skipped if it has no generated values
                    }
                } catch (error) {
                    if (error.name === 'AbortError') {
                        console.log(`AI generation for column ${colDef.name} was cancelled`);
                        showFlashMessage('AI generation cancelled. Starting new generation...', 'info');
                        return; // Exit the entire function if AI generation is cancelled
                    }
                    console.error(`AI generation error for column ${colDef.name}:`, error);
                    showFlashMessage(`Network error during AI generation for '${colDef.name}'.`, 'error');
                }
            }
            loadingDiv.style.display = 'none'; // Hide loading after AI generation
        }
        // --- END NEW AI CUSTOM COLUMN LOGIC ---

        // At this point, aiCustomColumnsDefinitions now contains generated_values for each AI column
        // And selectedSchemaColumns contains both schema defaults and selected AI columns

        if (selectedSchemaColumns.length === 0) {
            showFlashMessage('Please select at least one column or add an AI Custom Column for generation.', 'error');
            return;
        }
        
        // Show loading animation and hide results
        loadingDiv.style.display = 'block';
        resultsDiv.style.display = 'none';
        
        showFlashMessage('Generating data...', 'info');

        try {
            // Create AbortController for request cancellation
            const abortController = new AbortController();
            currentRequest = abortController;
            
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
                    selectedColumns: selectedSchemaColumns, // Use the updated list
                    aiCustomColumns: aiCustomColumnsDefinitions // Send AI custom column definitions with values
                }),
                signal: abortController.signal // Add abort signal
            });

            const result = await response.json();

            if (result.success) {
                generatedDataPreview = result.preview_data;
                downloadUrls = result.download_paths;
                displayData(selectedSchemaColumns, result.summary_stats); // Pass updated columns list
                showFlashMessage(result.message, 'success');
            } else {
                showFlashMessage(`Error: ${result.message}`, 'error');
                console.error("Backend error:", result.message);
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('Request was cancelled');
                showFlashMessage('Previous request cancelled. Starting new generation...', 'info');
                return; // Don't show error for cancelled requests
            }
            console.error('Generation fetch error:', error);
            showFlashMessage('An error occurred during data generation. Please check console for details.', 'error');
        } finally {
            // Clear the current request reference
            currentRequest = null;
            loadingDiv.style.display = 'none';
        }
    });
    
    // Event Listeners for sliders to update displayed value (no changes needed)
    missingRatioSlider.addEventListener('input', function() {
        missingRatioValue.textContent = this.value + '%';
    });
    
    varianceRatioSlider.addEventListener('input', function() {
        varianceRatioValue.textContent = this.value + '%';
    });
    

    // Update chart selectors after data is generated (no changes needed)
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
    
    // Function to display data statistics (using data from backend summary) (no changes needed)
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

    // Functions to download files (now handled by backend URLs) (no changes needed)
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