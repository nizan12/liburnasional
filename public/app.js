document.addEventListener('DOMContentLoaded', () => {
  // Constants and State
  const CURRENT_YEAR = new Date().getFullYear();
  let currentHolidays = [];
  let activeFilter = 'all'; // 'all', 'national', 'joint'
  let searchQuery = '';

  const MONTH_NAMES_ID = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const DAY_NAMES_ID = {
    'Sunday': 'Minggu',
    'Monday': 'Senin',
    'Tuesday': 'Selasa',
    'Wednesday': 'Rabu',
    'Thursday': 'Kamis',
    'Friday': 'Jumat',
    'Saturday': 'Sabtu'
  };

  // DOM Elements
  const tabDashboard = document.getElementById('tab-dashboard');
  const tabApiDocs = document.getElementById('tab-api-docs');
  const dashboardSection = document.getElementById('dashboard-section');
  const apiDocsSection = document.getElementById('api-docs-section');
  
  const yearSelect = document.getElementById('year-select');
  const scrapeBtn = document.getElementById('scrape-btn');
  const exportBtn = document.getElementById('export-btn');
  const exportMenu = document.getElementById('export-menu');
  
  const metricTotal = document.getElementById('metric-total');
  const metricNational = document.getElementById('metric-national');
  const metricJoint = document.getElementById('metric-joint');
  const metricBusyMonth = document.getElementById('metric-busy-month');
  
  const searchInput = document.getElementById('search-input');
  const filterPills = document.querySelectorAll('.pill-btn');
  const holidaysContainer = document.getElementById('holidays-container');
  
  const loadingSpinner = document.getElementById('loading-spinner');
  const errorMessage = document.getElementById('error-message');
  const errorText = document.getElementById('error-text');
  const retryBtn = document.getElementById('retry-btn');
  const emptyMessage = document.getElementById('empty-message');

  const viewListBtn = document.getElementById('view-list-btn');
  const viewCalendarBtn = document.getElementById('view-calendar-btn');

  let activeView = 'calendar'; // 'list' or 'calendar'

  // API Sandbox Elements
  const sandboxEndpoint = document.getElementById('sandbox-endpoint');
  const paramYear = document.getElementById('param-year');
  const paramMonth = document.getElementById('param-month');
  const paramForce = document.getElementById('param-force');
  const sendRequestBtn = document.getElementById('send-request-btn');
  const consoleStatus = document.getElementById('console-status');
  const jsonRenderer = document.getElementById('json-renderer');
  const copyJsonBtn = document.getElementById('copy-json-btn');
  
  // Endpoint Paths in documentation to click and test
  const docEndpoints = document.querySelectorAll('.api-endpoint-card .endpoint-path');

  // 1. Initial Setup: Populate Year Selector (2015 to CURRENT_YEAR + 3)
  const setupYearSelector = () => {
    yearSelect.innerHTML = '';
    const startYear = 2015;
    const endYear = CURRENT_YEAR + 3;

    for (let y = endYear; y >= startYear; y--) {
      const opt = document.createElement('option');
      opt.value = y;
      opt.textContent = `Tahun ${y}`;
      if (y === CURRENT_YEAR) {
        opt.selected = true;
      }
      yearSelect.appendChild(opt);
    }
  };

  // 2. Tab Navigation
  const switchTab = (targetId, activeBtn, inactiveBtn) => {
    activeBtn.classList.add('active');
    inactiveBtn.classList.remove('active');
    
    if (targetId === 'dashboard-section') {
      dashboardSection.classList.add('active');
      apiDocsSection.classList.remove('active');
    } else {
      dashboardSection.classList.remove('active');
      apiDocsSection.classList.add('active');
    }
  };

  tabDashboard.addEventListener('click', () => switchTab('dashboard-section', tabDashboard, tabApiDocs));
  tabApiDocs.addEventListener('click', () => switchTab('api-docs-section', tabApiDocs, tabDashboard));

  // 3. Helper: Format Indonesian Date & Day
  const getIndonesianDateDetails = (dateStr) => {
    const date = new Date(dateStr);
    const dayNameEng = date.toLocaleDateString('en-US', { weekday: 'long' });
    const dayNameId = DAY_NAMES_ID[dayNameEng] || dayNameEng;
    
    const day = date.getDate();
    const monthIndex = date.getMonth();
    const year = date.getFullYear();
    
    return {
      dayName: dayNameId,
      formattedDate: `${day} ${MONTH_NAMES_ID[monthIndex]} ${year}`,
      monthName: MONTH_NAMES_ID[monthIndex]
    };
  };

  // 4. Calculate Summary Metrics
  const calculateMetrics = (holidays) => {
    const total = holidays.length;
    const national = holidays.filter(h => h.is_national_holiday).length;
    const joint = total - national;

    // Group by month to find the peak month
    const monthCounts = {};
    holidays.forEach(h => {
      const monthNum = h.date.split('-')[1];
      const monthName = MONTH_NAMES_ID[parseInt(monthNum, 10) - 1];
      monthCounts[monthName] = (monthCounts[monthName] || 0) + 1;
    });

    let peakMonth = '-';
    let maxCount = 0;
    for (const [month, count] of Object.entries(monthCounts)) {
      if (count > maxCount) {
        maxCount = count;
        peakMonth = `${month} (${count})`;
      }
    }

    metricTotal.textContent = total;
    metricNational.textContent = national;
    metricJoint.textContent = joint;
    metricBusyMonth.textContent = peakMonth;
  };

  // 5. Render Calendar View
  const renderCalendarView = (holidays) => {
    const calendarWrapper = document.createElement('div');
    calendarWrapper.className = 'calendar-months-grid';

    const year = parseInt(yearSelect.value, 10);

    for (let m = 0; m < 12; m++) {
      const monthCard = document.createElement('div');
      monthCard.className = 'month-card';
      
      const monthName = MONTH_NAMES_ID[m];
      monthCard.innerHTML = `<h3 class="month-title">${monthName}</h3>`;
      
      const daysGrid = document.createElement('div');
      daysGrid.className = 'calendar-days-grid';
      
      const dayHeaders = ['Mg', 'Sn', 'Sl', 'Rb', 'Km', 'Jm', 'Sb'];
      dayHeaders.forEach(dh => {
        const headerCell = document.createElement('div');
        headerCell.className = 'calendar-day-header';
        headerCell.textContent = dh;
        daysGrid.appendChild(headerCell);
      });
      
      const firstDay = new Date(year, m, 1).getDay();
      const totalDays = new Date(year, m + 1, 0).getDate();
      
      // Pad empty cells before the 1st day of the month
      for (let p = 0; p < firstDay; p++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'calendar-day-cell empty';
        daysGrid.appendChild(emptyCell);
      }
      
      // Populate day cells
      for (let d = 1; d <= totalDays; d++) {
        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-day-cell';
        dayCell.textContent = d;
        
        const dateStr = `${year}-${(m + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
        const dayHolidays = holidays.filter(h => h.date === dateStr);
        
        if (dayHolidays.length > 0) {
          const isNational = dayHolidays.some(h => h.is_national_holiday);
          dayCell.classList.add('has-holiday');
          dayCell.classList.add(isNational ? 'national-holiday' : 'joint-leave');
          
          const tooltipText = dayHolidays.map(h => h.name).join(', ');
          dayCell.setAttribute('data-tooltip', tooltipText);
          dayCell.classList.add('tooltip');
        }
        
        daysGrid.appendChild(dayCell);
      }
      
      monthCard.appendChild(daysGrid);
      calendarWrapper.appendChild(monthCard);
    }
    
    holidaysContainer.appendChild(calendarWrapper);
  };

  // 5b. Render Holidays Cards or Calendar View
  const renderHolidays = () => {
    holidaysContainer.innerHTML = '';
    
    // Apply filters and searches
    const filtered = currentHolidays.filter(holiday => {
      // Category filter
      if (activeFilter === 'national' && !holiday.is_national_holiday) return false;
      if (activeFilter === 'joint' && holiday.is_national_holiday) return false;
      
      // Search text filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const nameMatch = holiday.name.toLowerCase().includes(query);
        const dateMatch = holiday.date.includes(query);
        const details = getIndonesianDateDetails(holiday.date);
        const dayMatch = details.dayName.toLowerCase().includes(query) || details.formattedDate.toLowerCase().includes(query);
        
        return nameMatch || dateMatch || dayMatch;
      }
      
      return true;
    });

    if (filtered.length === 0) {
      emptyMessage.classList.remove('hidden');
      return;
    }

    emptyMessage.classList.add('hidden');

    if (activeView === 'calendar') {
      holidaysContainer.className = ''; // Remove grid columns constraint
      renderCalendarView(filtered);
      return;
    }

    holidaysContainer.className = 'holidays-grid'; // Restore grid columns
    filtered.forEach(holiday => {
      const details = getIndonesianDateDetails(holiday.date);
      const card = document.createElement('div');
      card.className = `holiday-card ${holiday.is_national_holiday ? 'national-holiday' : 'joint-leave'}`;
      
      card.innerHTML = `
        <div class="holiday-date-wrapper">
          <div class="holiday-date-info">
            <span class="holiday-day-name">${details.dayName}</span>
            <span class="holiday-date-display">${details.formattedDate}</span>
          </div>
          <span class="holiday-badge">${holiday.is_national_holiday ? 'Libur Nasional' : 'Cuti Bersama'}</span>
        </div>
        <h4 class="holiday-title">${holiday.name}</h4>
        <div class="holiday-meta">
          <span>Format: YYYY-MM-DD</span>
          <code>${holiday.date}</code>
        </div>
      `;
      
      holidaysContainer.appendChild(card);
    });
  };

  // 6. Fetch Holidays from Server
  const fetchHolidays = async (year, force = false) => {
    loadingSpinner.classList.remove('hidden');
    errorMessage.classList.add('hidden');
    emptyMessage.classList.add('hidden');
    holidaysContainer.innerHTML = '';
    
    if (force) {
      scrapeBtn.classList.add('loading');
      scrapeBtn.querySelector('.btn-text').textContent = 'Scraping...';
    }

    try {
      const res = await fetch(`/api/holidays?year=${year}&force=${force}`);
      const result = await res.json();
      
      if (result.success) {
        currentHolidays = result.data;
        calculateMetrics(currentHolidays);
        renderHolidays();
      } else {
        throw new Error(result.message || 'Gagal memuat data libur.');
      }
    } catch (err) {
      console.error(err);
      errorText.textContent = err.message;
      errorMessage.classList.remove('hidden');
      metricTotal.textContent = '-';
      metricNational.textContent = '-';
      metricJoint.textContent = '-';
      metricBusyMonth.textContent = '-';
    } finally {
      loadingSpinner.classList.add('hidden');
      if (force) {
        scrapeBtn.classList.remove('loading');
        scrapeBtn.querySelector('.btn-text').textContent = 'Scrap & Sync Data';
      }
    }
  };

  // 7. Event Listeners for Dashboard controls
  yearSelect.addEventListener('change', () => {
    fetchHolidays(yearSelect.value);
    // Sync sandbox input year too
    paramYear.value = yearSelect.value;
  });

  scrapeBtn.addEventListener('click', () => {
    fetchHolidays(yearSelect.value, true);
  });

  retryBtn.addEventListener('click', () => {
    fetchHolidays(yearSelect.value);
  });

  // Search Input listener
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderHolidays();
  });

  // Filter Pills listener
  filterPills.forEach(pill => {
    pill.addEventListener('click', (e) => {
      filterPills.forEach(p => {
        p.classList.remove('active');
        p.setAttribute('aria-checked', 'false');
      });
      
      const target = e.target;
      target.classList.add('active');
      target.setAttribute('aria-checked', 'true');
      
      activeFilter = target.getAttribute('data-filter');
      renderHolidays();
    });
  });

  // Export dropdown toggler
  exportBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    exportMenu.classList.toggle('show');
  });

  document.addEventListener('click', () => {
    exportMenu.classList.remove('show');
  });

  // View Switcher listeners
  viewListBtn.addEventListener('click', () => {
    viewListBtn.classList.add('active');
    viewListBtn.setAttribute('aria-selected', 'true');
    viewCalendarBtn.classList.remove('active');
    viewCalendarBtn.setAttribute('aria-selected', 'false');
    activeView = 'list';
    renderHolidays();
  });

  viewCalendarBtn.addEventListener('click', () => {
    viewCalendarBtn.classList.add('active');
    viewCalendarBtn.setAttribute('aria-selected', 'true');
    viewListBtn.classList.remove('active');
    viewListBtn.setAttribute('aria-selected', 'false');
    activeView = 'calendar';
    renderHolidays();
  });

  // Export functions
  const downloadFile = (content, fileName, contentType) => {
    const a = document.createElement('a');
    const file = new Blob([content], { type: contentType });
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const generateICS = (holidays) => {
    let icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Kapan Libur//Scraper API Calendar//ID',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Hari Libur Indonesia ' + yearSelect.value,
      'X-WR-TIMEZONE:Asia/Jakarta'
    ];

    holidays.forEach((h, index) => {
      // Parse current date
      const parts = h.date.split('-');
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      
      // Start Date: YYYYMMDD
      const startStr = h.date.replace(/-/g, '');
      
      // End Date: YYYYMMDD (EXCLUSIVE for all-day events in ICS, so add 1 day)
      const startDate = new Date(year, month, day);
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 1);
      
      const endYear = endDate.getFullYear();
      const endMonth = (endDate.getMonth() + 1).toString().padStart(2, '0');
      const endDay = endDate.getDate().toString().padStart(2, '0');
      const endStr = `${endYear}${endMonth}${endDay}`;

      // Build unique UID
      const uid = `${startStr}-${index}@kapanlibur.api`;

      icsContent.push('BEGIN:VEVENT');
      icsContent.push(`UID:${uid}`);
      icsContent.push(`DTSTAMP:${startStr}T000000Z`);
      icsContent.push(`DTSTART;VALUE=DATE:${startStr}`);
      icsContent.push(`DTEND;VALUE=DATE:${endStr}`);
      icsContent.push(`SUMMARY:${h.name}`);
      icsContent.push(`DESCRIPTION:${h.is_national_holiday ? 'Hari Libur Nasional' : 'Cuti Bersama'}`);
      icsContent.push('STATUS:CONFIRMED');
      icsContent.push('TRANSP:TRANSPARENT');
      icsContent.push('END:VEVENT');
    });

    icsContent.push('END:VCALENDAR');
    return icsContent.join('\r\n');
  };

  const generateCSV = (holidays) => {
    const headers = ['Tanggal', 'Hari', 'Nama Libur', 'Tipe'];
    const rows = holidays.map(h => {
      const details = getIndonesianDateDetails(h.date);
      return [
        h.date,
        details.dayName,
        `"${h.name.replace(/"/g, '""')}"`,
        h.is_national_holiday ? 'Libur Nasional' : 'Cuti Bersama'
      ];
    });

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  };

  // Export menu items handler
  document.querySelectorAll('.export-item').forEach(item => {
    item.addEventListener('click', (e) => {
      const format = e.target.getAttribute('data-format');
      const year = yearSelect.value;
      
      if (format === 'json') {
        const jsonContent = JSON.stringify(currentHolidays, null, 2);
        downloadFile(jsonContent, `hari_libur_${year}.json`, 'application/json');
      } else if (format === 'csv') {
        const csvContent = generateCSV(currentHolidays);
        downloadFile(csvContent, `hari_libur_${year}.csv`, 'text/csv;charset=utf-8;');
      } else if (format === 'ics') {
        const icsContent = generateICS(currentHolidays);
        downloadFile(icsContent, `hari_libur_${year}.ics`, 'text/calendar;charset=utf-8;');
      }
    });
  });

  // 8. API Sandbox Interactive Controller
  
  // Set host dynamically
  const host = window.location.origin;
  document.getElementById('base-url-label').textContent = host;

  // Update integration code labels dynamically
  document.querySelectorAll('.js-url').forEach(el => el.textContent = host);
  document.querySelectorAll('.php-url').forEach(el => el.textContent = host);

  // Clicking an endpoint link in the documentation updates the sandbox focus
  docEndpoints.forEach(endpoint => {
    endpoint.addEventListener('click', (e) => {
      e.preventDefault();
      const path = e.currentTarget.textContent.trim();
      sandboxEndpoint.value = path;
      
      // Focus parameter editor based on path
      if (path === '/api/holidays') {
        paramYear.disabled = false;
        paramMonth.disabled = false;
      } else {
        paramYear.disabled = true;
        paramMonth.disabled = true;
      }

      // Switch to API docs/sandbox tab and scroll to sandbox
      switchTab('api-docs-section', tabApiDocs, tabDashboard);
      document.querySelector('.api-sandbox-panel').scrollIntoView({ behavior: 'smooth' });
    });
  });

  // Sandbox parameter input changes
  sandboxEndpoint.addEventListener('input', () => {
    const path = sandboxEndpoint.value;
    if (path.startsWith('/api/holidays')) {
      paramYear.disabled = false;
      paramMonth.disabled = false;
    } else {
      paramYear.disabled = true;
      paramMonth.disabled = true;
    }
  });

  // Syntax highlighting for JSON output
  const syntaxHighlightJSON = (json) => {
    if (typeof json !== 'string') {
      json = JSON.stringify(json, undefined, 2);
    }
    
    // Escape HTML special characters
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g, function (match) {
      let cls = 'json-number';
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = 'json-key';
        } else {
          cls = 'json-string';
        }
      } else if (/true|false/.test(match)) {
        cls = 'json-boolean';
      } else if (/null/.test(match)) {
        cls = 'json-null';
      }
      return '<span class="' + cls + '">' + match + '</span>';
    });
  };

  // Sandbox request submission
  sendRequestBtn.addEventListener('click', async () => {
    sendRequestBtn.disabled = true;
    sendRequestBtn.querySelector('span').textContent = 'Sending...';
    
    const endpoint = sandboxEndpoint.value;
    const year = paramYear.value;
    const month = paramMonth.value;
    const force = paramForce.checked;

    // Build URL query string
    let url = `${host}${endpoint}`;
    const queryParams = [];

    if (!paramYear.disabled && year) queryParams.push(`year=${year}`);
    if (!paramMonth.disabled && month) queryParams.push(`month=${month}`);
    if (force) queryParams.push(`force=true`);

    if (queryParams.length > 0) {
      url += `?${queryParams.join('&')}`;
    }

    consoleStatus.textContent = 'Fetching...';
    jsonRenderer.innerHTML = '// Fetching data from API server...';

    const startTime = performance.now();

    try {
      const response = await fetch(url);
      const endTime = performance.now();
      const latency = Math.round(endTime - startTime);

      consoleStatus.textContent = `Response: ${response.status} ${response.statusText} (${latency}ms)`;
      
      const data = await response.json();
      jsonRenderer.innerHTML = syntaxHighlightJSON(data);
    } catch (err) {
      consoleStatus.textContent = 'Error connecting to server';
      jsonRenderer.innerHTML = syntaxHighlightJSON({
        success: false,
        message: err.message || 'Gagal menghubungi endpoint API.'
      });
    } finally {
      sendRequestBtn.disabled = false;
      sendRequestBtn.querySelector('span').textContent = 'Send Request';
    }
  });

  // Copy JSON output button handler
  copyJsonBtn.addEventListener('click', () => {
    const textToCopy = jsonRenderer.textContent;
    
    navigator.clipboard.writeText(textToCopy).then(() => {
      const originalText = copyJsonBtn.innerHTML;
      copyJsonBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
        Copied!
      `;
      setTimeout(() => {
        copyJsonBtn.innerHTML = originalText;
      }, 2000);
    }).catch(err => {
      console.error('Failed to copy text: ', err);
    });
  });

  // Initialize
  setupYearSelector();
  paramYear.value = CURRENT_YEAR;
  fetchHolidays(CURRENT_YEAR);
});
