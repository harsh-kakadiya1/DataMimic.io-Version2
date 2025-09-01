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
    const addAiCustomColumnBtn = document.getElementById('add_ai_custom_column_btn'); // This button will also handle updates
    const aiCustomColumnsListContainer = document.getElementById('ai_custom_columns_list');
    
    let aiCustomColumnsDefinitions = []; // Array to hold AI custom column definitions
    let editingColumnIndex = -1; // -1 means not editing, otherwise holds the index of the column being edited

    let generatedDataPreview = [];
    let downloadUrls = {};

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

        // Add header row
        const headerDiv = document.createElement('div');
        headerDiv.classList.add('ai-column-header-row', 'd-flex', 'text-primary', 'font-weight-bold', 'py-2');
        headerDiv.innerHTML = `
            <div class="ai-col-name-header">Name</div>
            <div class="ai-col-type-header">Type</div>
            <div class="ai-col-desc-header me-auto">Description</div>
            <div class="ai-col-action-header text-end">Actions</div>
        `;
        aiCustomColumnsListContainer.appendChild(headerDiv);


        if (aiCustomColumnsDefinitions.length === 0) {
            const emptyStateDiv = document.createElement('div');
            emptyStateDiv.classList.add('alert', 'alert-info', 'text-center', 'py-3', 'my-2');
            emptyStateDiv.textContent = 'No AI custom columns added yet. Add one above!';
            aiCustomColumnsListContainer.appendChild(emptyStateDiv);
            return;
        }


        aiCustomColumnsDefinitions.forEach((col, index) => {
            const itemDiv = document.createElement('div');
            itemDiv.classList.add('ai-column-item-row', 'd-flex', 'align-items-center', 'py-2', 'my-1');
            itemDiv.innerHTML = `
                <div class="ai-col-name"><strong>${col.name}</strong></div>
                <div class="ai-col-type text-primary">${col.type}</div>
                <div class="ai-col-desc text-muted small me-auto">${col.prompt_description}</div>
                <div class="ai-col-action">
                    <button type="button" class="btn btn-sm btn-outline-info me-1 edit-ai-custom-col-btn" data-index="${index}">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button type="button" class="btn btn-sm btn-outline-danger remove-ai-custom-col-btn" data-index="${index}">
                        <i class="fas fa-trash"></i> Remove
                    </button>
                </div>
            `;
            aiCustomColumnsListContainer.appendChild(itemDiv);
        });

        // Attach event listeners to new remove buttons
        document.querySelectorAll('.remove-ai-custom-col-btn').forEach(button => {
            button.addEventListener('click', function() {
                const indexToRemove = parseInt(this.dataset.index);
                aiCustomColumnsDefinitions.splice(indexToRemove, 1);
                renderAiCustomColumnsList(); // Re-render the list
                resetAiCustomColumnForm(); // Reset form if an item is removed while editing
            });
        });

        // Attach event listeners to new edit buttons
        document.querySelectorAll('.edit-ai-custom-col-btn').forEach(button => {
            button.addEventListener('click', function() {
                const indexToEdit = parseInt(this.dataset.index);
                editAiCustomColumn(indexToEdit);
            });
        });
    }

    // Function to populate form for editing
    function editAiCustomColumn(index) {
        editingColumnIndex = index;
        const col = aiCustomColumnsDefinitions[index];

        aiCustomColumnNameInput.value = col.name;
        aiCustomColumnTypeSelect.value = col.type;
        aiCustomColumnPromptTextarea.value = col.prompt_description;

        // Disable name input during edit to prevent changing primary identifier
        aiCustomColumnNameInput.disabled = true;
        
        addAiCustomColumnBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Update AI Custom Column';
        addAiCustomColumnBtn.classList.remove('btn-primary');
        addAiCustomColumnBtn.classList.add('btn-warning');
        showFlashMessage(`Editing custom column '${col.name}'. Name is disabled.`, 'info');
    }

    // Function to reset the AI Custom Column form
    function resetAiCustomColumnForm() {
        editingColumnIndex = -1;
        aiCustomColumnNameInput.value = '';
        aiCustomColumnTypeSelect.value = '';
        aiCustomColumnPromptTextarea.value = '';
        aiCustomColumnNameInput.disabled = false; // Re-enable name input

        addAiCustomColumnBtn.innerHTML = '<i class="fas fa-plus"></i> Add AI Custom Column';
        addAiCustomColumnBtn.classList.remove('btn-warning');
        addAiCustomColumnBtn.classList.add('btn-primary');
    }

    // Event listener for adding/updating an AI Custom Column
    addAiCustomColumnBtn.addEventListener('click', function() {
        const name = aiCustomColumnNameInput.value.trim();
        const type = aiCustomColumnTypeSelect.value;
        const prompt = aiCustomColumnPromptTextarea.value.trim();

        if (!name || !type || !prompt) {
            showFlashMessage('Please fill in all fields (Name, Type, Prompt) for the AI Custom Column.', 'error');
            return;
        }

        if (editingColumnIndex === -1) { // Adding a new column
            // Check for duplicate names (case-insensitive) against existing AI columns
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
            showFlashMessage(`AI Custom Column '${name}' added.`, 'success');
        } else { // Updating an existing column
            const originalName = aiCustomColumnsDefinitions[editingColumnIndex].name;
            aiCustomColumnsDefinitions[editingColumnIndex].type = type;
            aiCustomColumnsDefinitions[editingColumnIndex].prompt_description = prompt;
            // Clear generated values on edit, as prompt might change
            aiCustomColumnsDefinitions[editingColumnIndex].generated_values = []; 
            showFlashMessage(`AI Custom Column '${originalName}' updated.`, 'success');
            resetAiCustomColumnForm(); // Reset form after update
        }

        resetAiCustomColumnForm(); // Reset form for new addition
        renderAiCustomColumnsList();
    });

    renderAiCustomColumnsList(); // Initial render of the AI custom columns list


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
        let selectedSchemaColumns = Array.from(checkboxes).map(cb => cb.value);

        // --- NEW: AI Custom Column Data Generation and Integration ---
        // Ensure to clear any old generated_values if a column was edited but not re-added
        aiCustomColumnsDefinitions.forEach(col => col.generated_values = []);

        if (aiCustomColumnsDefinitions.length > 0) {
            showFlashMessage('Initiating AI-powered column value generation...', 'info');
            loadingDiv.style.display = 'block'; // Show global loading for AI generation
            resultsDiv.style.display = 'none';

            // Iterate through each AI custom column definition
            for (let i = 0; i < aiCustomColumnsDefinitions.length; i++) {
                const colDef = aiCustomColumnsDefinitions[i];
                showFlashMessage(`AI generating values for column: '${colDef.name}' (Type: ${colDef.type})...`, 'info');

                try {
                    const aiResponse = await fetch('/api/generate_ai_column_values', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            col_type: colDef.type,
                            prompt_description: colDef.prompt_description,
                            num_records: numRecords // Send total numRecords; backend caps AI response size
                        })
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
                        // If AI generation fails for a column, ensure its generated_values array is empty
                        aiCustomColumnsDefinitions[i].generated_values = []; 
                        showFlashMessage(`AI failed to generate values for '${colDef.name}': ${aiResult.message}`, 'error');
                        // Do NOT add to selectedSchemaColumns if it failed, unless explicitly desired for placeholder (e.g., all None)
                        selectedSchemaColumns = selectedSchemaColumns.filter(col => col !== colDef.name);
                    }
                } catch (error) {
                    console.error(`AI generation network error for column '${colDef.name}':`, error);
                    aiCustomColumnsDefinitions[i].generated_values = []; // Ensure empty on network error
                    showFlashMessage(`Network error during AI generation for '${colDef.name}'. Please check console for details.`, 'error');
                    selectedSchemaColumns = selectedSchemaColumns.filter(col => col !== colDef.name);
                }
            }
            loadingDiv.style.display = 'none'; // Hide loading after AI generation
            showFlashMessage('AI value generation phase complete. Proceeding with synthetic data generation.', 'info');
        }
        // --- END NEW AI CUSTOM COLUMN LOGIC ---

        // Filter out any AI columns that failed to generate values from the final selectedSchemaColumns
        selectedSchemaColumns = selectedSchemaColumns.filter(colName => {
            const aiCol = aiCustomColumnsDefinitions.find(c => c.name === colName);
            return !aiCol || aiCol.generated_values.length > 0;
        });


        if (selectedSchemaColumns.length === 0) {
            showFlashMessage('No columns selected or successfully generated by AI for the final dataset. Please ensure you have selected pre-defined columns or successfully added AI custom columns.', 'error');
            loadingDiv.style.display = 'none'; // Ensure loading is hidden
            return;
        }
        
        // Show loading animation and hide results
        loadingDiv.style.display = 'block';
        resultsDiv.style.display = 'none';
        
        showFlashMessage('Generating final synthetic data...', 'info');

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
                    selectedColumns: selectedSchemaColumns, // Use the updated list
                    aiCustomColumns: aiCustomColumnsDefinitions // Send AI custom column definitions with values
                })
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
            console.error('Generation fetch error:', error);
            showFlashMessage('An error occurred during data generation. Please check console for details.', 'error');
        } finally {
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