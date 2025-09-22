document.addEventListener('DOMContentLoaded', () => {
    const uploadForm = document.getElementById('uploadForm');
    const fileUploadInput = document.getElementById('fileUpload');
    const fileDropZone = document.getElementById('fileDropZone');
    const browseBtn = document.getElementById('browseBtn');
    const filePreview = document.getElementById('filePreview');
    const fileName = document.getElementById('fileName');
    const fileSize = document.getElementById('fileSize');
    const removeFileBtn = document.getElementById('removeFileBtn');
    const uploadSubmitBtn = document.getElementById('uploadSubmitBtn');
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

    // Data preview elements
    const previewRowsSelect = document.getElementById('previewRows');
    const refreshPreviewBtn = document.getElementById('refreshPreview');
    const dataPreviewTable = document.getElementById('dataPreviewTable');

    // Chart elements
    const chartTypeSelect = document.getElementById('chartType');
    const xColumnSelect = document.getElementById('xColumn');
    const yColumnSelect = document.getElementById('yColumn');
    const drawChartBtn = document.getElementById('drawChartBtn');
    const edaChartCanvas = document.getElementById('edaChart');

    let chartInstance = null;
    let currentDfId = null;

    // File Upload Functionality
    function validateFile(file) {
        const maxSize = 100 * 1024 * 1024; // 100MB in bytes
        const allowedTypes = ['.csv', '.xlsx'];
        const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
        
        if (!allowedTypes.includes(fileExtension)) {
            showFlashMessage('Invalid file type. Only CSV and XLSX files are allowed.', 'error');
            return false;
        }
        
        if (file.size > maxSize) {
            showFlashMessage('File size exceeds 100MB limit. Please choose a smaller file.', 'error');
            return false;
        }
        
        return true;
    }

    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    function showFilePreview(file) {
        fileName.textContent = file.name;
        fileSize.textContent = formatFileSize(file.size);
        
        // Update file icon based on file type
        const fileIcon = document.querySelector('.file-icon');
        if (file.name.toLowerCase().endsWith('.csv')) {
            fileIcon.className = 'fas fa-file-csv file-icon';
        } else {
            fileIcon.className = 'fas fa-file-excel file-icon';
        }
        
        fileDropZone.querySelector('.file-drop-content').style.display = 'none';
        filePreview.style.display = 'flex';
        uploadSubmitBtn.style.display = 'block';
    }

    function hideFilePreview() {
        fileDropZone.querySelector('.file-drop-content').style.display = 'flex';
        filePreview.style.display = 'none';
        uploadSubmitBtn.style.display = 'none';
        fileUploadInput.value = '';
    }

    // Browse button click handler
    browseBtn.addEventListener('click', () => {
        fileUploadInput.click();
    });

    // File input change handler
    fileUploadInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file && validateFile(file)) {
            showFilePreview(file);
        } else {
            hideFilePreview();
        }
    });

    // Remove file button handler
    removeFileBtn.addEventListener('click', () => {
        hideFilePreview();
    });

    // Drag and drop handlers
    fileDropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        fileDropZone.classList.add('drag-over');
    });

    fileDropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        if (!fileDropZone.contains(e.relatedTarget)) {
            fileDropZone.classList.remove('drag-over');
        }
    });

    fileDropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        fileDropZone.classList.remove('drag-over');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            const file = files[0];
            if (validateFile(file)) {
                fileUploadInput.files = files;
                showFilePreview(file);
            }
        }
    });

    // Chart functionality
    function updateChartColumnSelectors() {
        if (!xColumnSelect || !yColumnSelect) return;
        
        xColumnSelect.innerHTML = '';
        yColumnSelect.innerHTML = '';
        
        // Get columns from the current data preview
        const tableHeaders = dataPreviewTable.querySelectorAll('thead th');
        const columns = Array.from(tableHeaders).map(th => th.textContent);
        
        // Get column details to determine data types
        const columnDetails = [];
        const columnDetailsTable = document.querySelector('#columnDetailsTable tbody');
        if (columnDetailsTable) {
            const detailRows = columnDetailsTable.querySelectorAll('tr');
            detailRows.forEach(row => {
                const cells = row.querySelectorAll('td');
                if (cells.length >= 2) {
                    const columnName = cells[0].textContent;
                    const dataType = cells[1].textContent;
                    columnDetails.push({ name: columnName, dtype: dataType });
                }
            });
        }
        
        columns.forEach(col => {
            const xOption = document.createElement('option');
            xOption.value = col;
            xOption.textContent = col;
            xColumnSelect.appendChild(xOption);
            
            const yOption = document.createElement('option');
            yOption.value = col;
            yOption.textContent = col;
            yColumnSelect.appendChild(yOption);
        });
        
        if (columns.length > 0) xColumnSelect.value = columns[0];
        if (columns.length > 1) yColumnSelect.value = columns[1];
        
        // Apply Y-axis filtering based on chart type
        filterYAxisColumns();
    }

    function filterYAxisColumns() {
        if (!yColumnSelect || !chartTypeSelect) return;
        
        const chartType = chartTypeSelect.value;
        const currentYValue = yColumnSelect.value;
        
        // Get column details to determine data types
        const columnDetails = [];
        const columnDetailsTable = document.querySelector('#columnDetailsTable tbody');
        if (columnDetailsTable) {
            const detailRows = columnDetailsTable.querySelectorAll('tr');
            detailRows.forEach(row => {
                const cells = row.querySelectorAll('td');
                if (cells.length >= 2) {
                    const columnName = cells[0].textContent;
                    const dataType = cells[1].textContent;
                    columnDetails.push({ name: columnName, dtype: dataType });
                }
            });
        }
        
        // Clear current Y-axis options
        yColumnSelect.innerHTML = '';
        
        // For line, bar, and scatter charts, only show numerical columns
        if (['line', 'bar', 'scatter','histogram'].includes(chartType)) {
            columnDetails.forEach(col => {
                const isNumeric = ['int64', 'float64', 'Int64', 'int32', 'float32'].includes(col.dtype);
                if (isNumeric) {
                    const option = document.createElement('option');
                    option.value = col.name;
                    option.textContent = col.name;
                    yColumnSelect.appendChild(option);
                }
            });
            
            // If no numerical columns found, show a message
            if (yColumnSelect.options.length === 0) {
                const noNumericOption = document.createElement('option');
                noNumericOption.value = '';
                noNumericOption.textContent = 'No numerical columns available';
                noNumericOption.disabled = true;
                yColumnSelect.appendChild(noNumericOption);
            }
        } else {
            // For pie and histogram charts, show all columns
            columnDetails.forEach(col => {
                const option = document.createElement('option');
                option.value = col.name;
                option.textContent = col.name;
                yColumnSelect.appendChild(option);
            });
        }
        
        // Try to restore the previous selection if it's still valid
        if (currentYValue && Array.from(yColumnSelect.options).some(opt => opt.value === currentYValue)) {
            yColumnSelect.value = currentYValue;
        } else if (yColumnSelect.options.length > 0) {
            yColumnSelect.value = yColumnSelect.options[0].value;
        }
    }

    function drawEdaChart() {
        if (!currentDfId || !edaChartCanvas) return;
        
        const chartType = chartTypeSelect.value;
        const xCol = xColumnSelect.value;
        const yCol = yColumnSelect.value;
        
        if (!xCol || !yCol) {
            showFlashMessage('Please select both X and Y columns for the chart.', 'error');
            return;
        }
        
        // Get data from the preview table
        const tableRows = dataPreviewTable.querySelectorAll('tbody tr');
        const data = [];
        
        tableRows.forEach(row => {
            const cells = row.querySelectorAll('td');
            const rowData = {};
            const headers = Array.from(dataPreviewTable.querySelectorAll('thead th')).map(th => th.textContent);
            
            headers.forEach((header, index) => {
                const cellValue = cells[index] ? cells[index].textContent : '';
                rowData[header] = cellValue === 'N/A' ? null : cellValue;
            });
            
            data.push(rowData);
        });
        
        if (data.length === 0) {
            showFlashMessage('No data available for charting.', 'error');
            return;
        }
        
        const ctx = edaChartCanvas.getContext('2d');
        
        // Destroy previous chart if exists
        if (chartInstance) chartInstance.destroy();
        
        // Prepare data - fix x-axis labels
        let labels, chartData, isCategorical = false;
        
        if (chartType === 'scatter') {
            // For scatter plots, use actual x values but ensure they're numeric
            const xValues = data.map(row => {
                const val = row[xCol];
                const num = parseFloat(val);
                return isNaN(num) ? val : num;
            });
            const yValues = data.map(row => {
                const val = row[yCol];
                const num = parseFloat(val);
                return isNaN(num) ? val : num;
            });
            
            chartData = xValues.map((x, i) => ({ x: x, y: yValues[i] }));
            labels = []; // Scatter plots don't use labels array
        } else {
            // For other chart types, determine if x-axis should be categorical or sequential
            const xValues = data.map(row => row[xCol]);
            const uniqueXValues = [...new Set(xValues)];
            isCategorical = uniqueXValues.length <= 20 && uniqueXValues.some(val => isNaN(parseFloat(val)));
            
            if (chartType === 'bar' && isCategorical) {
                // For bar charts with categorical x-axis, use the actual categories
                labels = uniqueXValues.map(val => String(val));
                // Count occurrences for each category
                const counts = {};
                data.forEach(row => {
                    const xVal = String(row[xCol]);
                    const yVal = parseFloat(row[yCol]);
                    if (!isNaN(yVal)) {
                        counts[xVal] = (counts[xVal] || 0) + yVal;
                    }
                });
                chartData = labels.map(label => counts[label] || 0);
            } else if (chartType === 'bar' || chartType === 'line') {
                // Use sequential indices for x-axis when data is not categorical
                labels = data.map((_, index) => `Point ${index + 1}`);
                chartData = data.map(row => {
                    const val = row[yCol];
                    const num = parseFloat(val);
                    return isNaN(num) ? val : num;
                });
            } else {
                // For other types, use the x column values but ensure they're meaningful
                labels = data.map(row => {
                    const val = row[xCol];
                    // If it's a number, format it nicely
                    const num = parseFloat(val);
                    if (!isNaN(num)) {
                        return num.toLocaleString();
                    }
                    return String(val);
                });
                
                chartData = data.map(row => {
                    const val = row[yCol];
                    const num = parseFloat(val);
                    return isNaN(num) ? val : num;
                });
            }
        }
        
        // Pie chart: group by value counts
        if (chartType === 'pie') {
            const counts = {};
            chartData.forEach(val => {
                if (val !== null && val !== undefined) {
                    counts[val] = (counts[val] || 0) + 1;
                }
            });
            
            chartInstance = new Chart(ctx, {
                type: 'pie',
                data: {
                    labels: Object.keys(counts),
                    datasets: [{
                        data: Object.values(counts),
                        backgroundColor: [
                            'rgba(54, 162, 235, 0.5)',
                            'rgba(255, 99, 132, 0.5)',
                            'rgba(255, 206, 86, 0.5)',
                            'rgba(75, 192, 192, 0.5)',
                            'rgba(153, 102, 255, 0.5)',
                            'rgba(255, 159, 64, 0.5)'
                        ]
                    }]
                },
                options: { responsive: true }
            });
            return;
        }
        
        // Histogram: treat Y as numeric, X ignored
        if (chartType === 'histogram') {
            const numericData = chartData.filter(v => !isNaN(v) && v !== null);
            if (numericData.length === 0) {
                showFlashMessage('No numeric data available for histogram.', 'error');
                return;
            }
            
            const binCount = 10;
            const min = Math.min(...numericData);
            const max = Math.max(...numericData);
            const binSize = (max - min) / binCount;
            const bins = Array(binCount).fill(0);
            
            numericData.forEach(v => {
                let idx = Math.floor((v - min) / binSize);
                if (idx === binCount) idx = binCount - 1;
                bins[idx]++;
            });
            
            const binLabels = bins.map((_, i) => `${(min + i * binSize).toFixed(2)} - ${(min + (i + 1) * binSize).toFixed(2)}`);
            
            chartInstance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: binLabels,
                    datasets: [{
                        label: yCol,
                        data: bins,
                        backgroundColor: 'rgba(54, 162, 235, 0.5)'
                    }]
                },
                options: { responsive: true }
            });
            return;
        }
        
        // Scatter, bar, line
        let chartConfig = {
            labels: labels,
            datasets: [{
                label: `${yCol} vs ${xCol}`,
                data: chartData,
                backgroundColor: 'rgba(54, 162, 235, 0.5)',
                borderColor: 'rgba(54, 162, 235, 1)',
                fill: false,
                tension: chartType === 'line' ? 0.4 : 0
            }]
        };
        
        let type = chartType;
        if (chartType === 'scatter') {
            chartConfig = {
                datasets: [{
                    label: `${yCol} vs ${xCol}`,
                    data: chartData,
                    backgroundColor: 'rgba(54, 162, 235, 0.5)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    pointRadius: 6,
                    pointHoverRadius: 8
                }]
            };
        }
        
        // Enhanced chart options
        const chartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            aspectRatio: 2,
            plugins: { 
                legend: { 
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        title: function(context) {
                            if (chartType === 'scatter') {
                                return `X: ${context[0].parsed.x}, Y: ${context[0].parsed.y}`;
                            }
                            return `Point ${context[0].dataIndex + 1}`;
                        }
                    }
                }
            },
            scales: {}
        };
        
        if (chartType === 'scatter') {
            chartOptions.scales = {
                x: { 
                    type: 'linear', 
                    position: 'bottom', 
                    title: { 
                        display: true, 
                        text: xCol,
                        font: { size: 14, weight: 'bold' }
                    },
                    grid: {
                        color: 'rgba(0,0,0,0.1)'
                    }
                },
                y: { 
                    title: { 
                        display: true, 
                        text: yCol,
                        font: { size: 14, weight: 'bold' }
                    },
                    grid: {
                        color: 'rgba(0,0,0,0.1)'
                    }
                }
            };
        } else {
            chartOptions.scales = {
                x: {
                    title: {
                        display: true,
                        text: chartType === 'bar' && isCategorical ? xCol : 'Data Points',
                        font: { size: 14, weight: 'bold' }
                    },
                    grid: {
                        color: 'rgba(0,0,0,0.1)'
                    },
                    ticks: {
                        maxTicksLimit: 15,
                        callback: function(value, index) {
                            if (chartType === 'bar' && isCategorical) {
                                // For categorical data, show all labels but rotate them
                                return labels[index] || '';
                            } else {
                                // For sequential data, show every nth label to avoid overcrowding
                                const step = Math.ceil(labels.length / 15);
                                return index % step === 0 ? labels[index] : '';
                            }
                        },
                        maxRotation: chartType === 'bar' && isCategorical ? 45 : 0,
                        minRotation: chartType === 'bar' && isCategorical ? 45 : 0
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: yCol,
                        font: { size: 14, weight: 'bold' }
                    },
                    grid: {
                        color: 'rgba(0,0,0,0.1)'
                    },
                    ticks: {
                        callback: function(value) {
                            return typeof value === 'number' ? value.toLocaleString() : value;
                        }
                    }
                }
            };
        }
        
        chartInstance = new Chart(ctx, {
            type: type,
            data: chartConfig,
            options: chartOptions
        });
        
        // Ensure chart resizes properly
        setTimeout(() => {
            if (chartInstance) {
                chartInstance.resize();
            }
        }, 100);
    }

    // Helper function to show Flask-style flash messages
    function showFlashMessage(message, category) {
        const container = document.querySelector('.flash-messages-container');
        if (!container) return; 

        container.innerHTML = '';

        const div = document.createElement('div');
        div.classList.add('flash-message', `flash-${category}`);
        div.innerHTML = `${message} <button type="button" class="close-btn" onclick="this.parentElement.style.display='none';" aria-label="Close">&times;</button>`;
        container.appendChild(div);

        setTimeout(() => {
            if (div.parentElement) div.style.display = 'none';
        }, 5000);
    }

    // Removed renderChart function

    // Function to load and display data preview
    async function loadDataPreview() {
        if (!currentDfId) return;
        
        try {
            const numRows = previewRowsSelect.value;
            const response = await fetch(`/api/eda/preview/${currentDfId}?rows=${numRows}`);
            const result = await response.json();
            
            if (result.success) {
                displayDataPreview(result.columns, result.data);
            } else {
                showFlashMessage(result.message, 'error');
            }
        } catch (error) {
            console.error('Error loading data preview:', error);
            showFlashMessage('Error loading data preview.', 'error');
        }
    }

    // Function to display data preview in table
    function displayDataPreview(columns, data) {
        // Clear existing table
        dataPreviewTable.innerHTML = '';
        
        // Create header row
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        columns.forEach(col => {
            const th = document.createElement('th');
            th.textContent = col;
            th.style.minWidth = '120px';
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        dataPreviewTable.appendChild(thead);
        
        // Create body
        const tbody = document.createElement('tbody');
        data.forEach(row => {
            const tr = document.createElement('tr');
            columns.forEach(col => {
                const td = document.createElement('td');
                const value = row[col];
                if (value === null || value === undefined) {
                    td.textContent = 'N/A';
                    td.style.color = '#999';
                    td.style.fontStyle = 'italic';
                } else {
                    td.textContent = String(value);
                }
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
        dataPreviewTable.appendChild(tbody);
        
        // Update chart column selectors after data preview is loaded
        updateChartColumnSelectors();
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
        edaResults.style.display = 'none';
        // Removed plotContainer related clearing
        
        // Removed clearing all previous charts and their canvases

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
                edaResults.style.display = 'block';
                showFlashMessage(result.message, 'success');
                // Update column selections for initial load
                updateColumnSelects(result.summary.column_details);
                // Load initial data preview
                await loadDataPreview();
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

        // Removed populatePlotColumnSelects call
    }

    // Function to populate all column multi-selects for pre-processing
    function updateColumnSelects(columnDetails) {
        imputeNumericalColsSelect.innerHTML = '';
        imputeCategoricalColsSelect.innerHTML = '';
        removeColumnsSelect.innerHTML = '';
        convertColSelect.innerHTML = '<option value="">-- Select Column --</option>';
        scalingColsSelect.innerHTML = '';
        textCleanColsSelect.innerHTML = '';

        let numericalWithMissing = 0;
        let categoricalWithMissing = 0;

        columnDetails.forEach(col => {
            const option = document.createElement('option');
            option.value = col.name;
            option.textContent = col.name;

            const isNumeric = ['int64', 'float64', 'Int64', 'int32', 'float32'].includes(col.dtype);
            if (isNumeric) { 
                // Only add to numerical imputation if it has missing values
                if (parseFloat(col.missing_percentage) > 0) {
                imputeNumericalColsSelect.appendChild(option.cloneNode(true));
                    numericalWithMissing++;
                }
                scalingColsSelect.appendChild(option.cloneNode(true));
            }
            
            const isDateTime = col.dtype.startsWith('datetime');
            if (!isNumeric && !isDateTime) {
                // Only add to categorical imputation if it has missing values
                if (parseFloat(col.missing_percentage) > 0) {
                imputeCategoricalColsSelect.appendChild(option.cloneNode(true));
                    categoricalWithMissing++;
                }
            }
            
            removeColumnsSelect.appendChild(option.cloneNode(true));
            convertColSelect.appendChild(option.cloneNode(true));

            if (['object', 'string'].includes(col.dtype) && col.unique_values > 0) { 
                textCleanColsSelect.appendChild(option.cloneNode(true));
            }
        });

        // Add helpful messages if no columns have missing values
        if (numericalWithMissing === 0) {
            const noNumericalMsg = document.createElement('option');
            noNumericalMsg.disabled = true;
            noNumericalMsg.textContent = 'No numerical columns with missing values';
            imputeNumericalColsSelect.appendChild(noNumericalMsg);
        }

        if (categoricalWithMissing === 0) {
            const noCategoricalMsg = document.createElement('option');
            noCategoricalMsg.disabled = true;
            noCategoricalMsg.textContent = 'No categorical columns with missing values';
            imputeCategoricalColsSelect.appendChild(noCategoricalMsg);
        }
    }

    // Removed populatePlotColumnSelects function

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

            // Removed plot related clearing
            
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
                    payload.case_type = action; // Send the full action name
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
                    showFlashMessage(result.message, 'success');
                    // Refresh column selections after preprocessing
                    updateColumnSelects(result.summary.column_details);
                    // Refresh data preview after preprocessing
                    await loadDataPreview();
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

    // Removed Plotting Operations handler

    // Download Processed Data
    document.querySelectorAll('.download-btn').forEach(button => {
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

    // Data Preview Controls
    previewRowsSelect.addEventListener('change', loadDataPreview);
    refreshPreviewBtn.addEventListener('click', loadDataPreview);

    // Chart Controls
    if (drawChartBtn) {
        drawChartBtn.addEventListener('click', drawEdaChart);
    }
    
    // Smart Chart button
    const smartChartBtn = document.getElementById('smartChartBtn');
    if (smartChartBtn) {
        smartChartBtn.addEventListener('click', () => {
            suggestChartType();
            setTimeout(() => {
                drawEdaChart();
            }, 500); // Small delay to ensure the chart type is updated
        });
    }
    
    // Add event listener for chart type changes to filter Y-axis columns
    if (chartTypeSelect) {
        chartTypeSelect.addEventListener('change', filterYAxisColumns);
    }
    
    // Add smart chart type suggestion
    function suggestChartType() {
        if (!xColumnSelect || !yColumnSelect || !chartTypeSelect) return;
        
        const xCol = xColumnSelect.value;
        const yCol = yColumnSelect.value;
        if (!xCol || !yCol) return;
        
        // Get column details to determine data types
        const columnDetails = [];
        const columnDetailsTable = document.querySelector('#columnDetailsTable tbody');
        if (columnDetailsTable) {
            const detailRows = columnDetailsTable.querySelectorAll('tr');
            detailRows.forEach(row => {
                const cells = row.querySelectorAll('td');
                if (cells.length >= 2) {
                    const columnName = cells[0].textContent;
                    const dataType = cells[1].textContent;
                    columnDetails.push({ name: columnName, dtype: dataType });
                }
            });
        }
        
        const xColInfo = columnDetails.find(col => col.name === xCol);
        const yColInfo = columnDetails.find(col => col.name === yCol);
        
        if (!xColInfo || !yColInfo) return;
        
        const xIsNumeric = ['int64', 'float64', 'Int64', 'int32', 'float32'].includes(xColInfo.dtype);
        const yIsNumeric = ['int64', 'float64', 'Int64', 'int32', 'float32'].includes(yColInfo.dtype);
        
        let suggestedType = 'bar'; // default
        
        if (xIsNumeric && yIsNumeric) {
            suggestedType = 'scatter';
        } else if (!xIsNumeric && yIsNumeric) {
            suggestedType = 'bar';
        } else if (xIsNumeric && !yIsNumeric) {
            suggestedType = 'pie';
        } else if (!xIsNumeric && !yIsNumeric) {
            suggestedType = 'pie';
        }
        
        // Update the chart type selector
        chartTypeSelect.value = suggestedType;
        filterYAxisColumns();
        
        // Show a helpful message
        showFlashMessage(`Suggested chart type: ${suggestedType} (based on your data types)`, 'info');
    }
    
    // Add event listeners for smart suggestions
    if (xColumnSelect && yColumnSelect) {
        xColumnSelect.addEventListener('change', suggestChartType);
        yColumnSelect.addEventListener('change', suggestChartType);
    }
    
    // Handle window resize to maintain chart size
    window.addEventListener('resize', () => {
        if (chartInstance) {
            setTimeout(() => {
                chartInstance.resize();
            }, 100);
        }
    });
});