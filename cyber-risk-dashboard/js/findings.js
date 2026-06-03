/**
 * AEGIS GRC - Audit Findings Controller
 */

let grcData = {};
let filteredFindings = [];
let currentPage = 1;
const rowsPerPage = 5;
let sortField = 'FindingID';
let sortAsc = true;

document.addEventListener('DOMContentLoaded', async () => {
  // Inject global layout
  injectGlobalLayout('Audit Findings Register');

  // Load database state
  grcData = await initDatabase();

  // Populate finding metrics panels
  updateFindingKPIs();

  // Filters event listeners
  document.getElementById('finding-search').addEventListener('input', handleFilterChange);
  document.getElementById('filter-severity').addEventListener('change', handleFilterChange);
  document.getElementById('filter-status').addEventListener('change', handleFilterChange);

  // Pagination buttons
  document.getElementById('prev-page-btn').addEventListener('click', () => changePage(-1));
  document.getElementById('next-page-btn').addEventListener('click', () => changePage(1));

  // Run initial render
  applyFiltersAndRender();
});

/**
 * Filter change callback
 */
function handleFilterChange() {
  currentPage = 1;
  applyFiltersAndRender();
}

/**
 * Paginates values
 */
function changePage(direction) {
  currentPage += direction;
  renderTable();
}

/**
 * Column sorting action
 */
window.toggleSort = function(field) {
  if (sortField === field) {
    sortAsc = !sortAsc;
  } else {
    sortField = field;
    sortAsc = true;
  }

  // Update indicators
  const sortColumns = ['FindingID', 'RiskID', 'Severity', 'Description', 'DueDate', 'Status'];
  sortColumns.forEach(col => {
    const indicator = document.getElementById(`sort-${col}`);
    if (indicator) {
      if (col === sortField) {
        indicator.innerText = sortAsc ? '▲' : '▼';
      } else {
        indicator.innerText = '↕';
      }
    }
  });

  applyFiltersAndRender();
};

/**
 * Updates GRC KPI cards for findings
 */
function updateFindingKPIs() {
  const findings = grcData.findings || [];

  const total = findings.length;
  const open = findings.filter(f => f.Status === 'Open').length;
  const closed = findings.filter(f => f.Status === 'Closed').length;

  // Overdue findings
  const overdue = findings.filter(f => {
    if (f.Status !== 'Open') return false;
    const dueDate = new Date(f.DueDate);
    return dueDate < REFERENCE_DATE;
  }).length;

  document.getElementById('stats-total-findings').innerText = total;
  document.getElementById('stats-open-findings').innerText = open;
  document.getElementById('stats-closed-findings').innerText = closed;
  
  const overdueValue = document.getElementById('stats-overdue-findings');
  overdueValue.innerText = overdue;

  // Pulse wrapper if overdue > 0
  const overdueWrapper = document.getElementById('kpi-overdue-wrapper');
  if (overdue > 0) {
    overdueWrapper.classList.add('overdue-alert');
  } else {
    overdueWrapper.classList.remove('overdue-alert');
  }
}

/**
 * Filters, sorts, and triggers table rendering
 */
function applyFiltersAndRender() {
  const searchVal = document.getElementById('finding-search').value.toLowerCase().trim();
  const severityVal = document.getElementById('filter-severity').value;
  const statusVal = document.getElementById('filter-status').value;

  const findings = grcData.findings || [];

  // Filter
  filteredFindings = findings.filter(f => {
    const matchesSearch = f.FindingID.toLowerCase().includes(searchVal) || 
                          f.RiskID.toLowerCase().includes(searchVal) || 
                          f.Description.toLowerCase().includes(searchVal);

    const matchesSeverity = severityVal === 'All' || f.Severity === severityVal;
    
    const matchesStatus = statusVal === 'All' || f.Status === statusVal;

    return matchesSearch && matchesSeverity && matchesStatus;
  });

  // Sort
  filteredFindings.sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];

    if (sortField === 'DueDate') {
      valA = new Date(valA);
      valB = new Date(valB);
    } else {
      valA = valA.toLowerCase();
      valB = valB.toLowerCase();
    }

    if (valA < valB) return sortAsc ? -1 : 1;
    if (valA > valB) return sortAsc ? 1 : -1;
    return 0;
  });

  renderTable();
}

/**
 * Render findings table rows
 */
function renderTable() {
  const tbody = document.getElementById('findings-table-body');
  
  if (filteredFindings.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No audit findings matching search filters.</td></tr>';
    updatePagination(0);
    return;
  }

  const total = filteredFindings.length;
  const totalPages = Math.ceil(total / rowsPerPage);
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const startIdx = (currentPage - 1) * rowsPerPage;
  const endIdx = Math.min(startIdx + rowsPerPage, total);
  const pageFindings = filteredFindings.slice(startIdx, endIdx);

  let html = '';
  pageFindings.forEach(f => {
    let sevClass = 'badge-low';
    if (f.Severity === 'Critical') sevClass = 'badge-critical';
    else if (f.Severity === 'High') sevClass = 'badge-high';
    else if (f.Severity === 'Medium') sevClass = 'badge-medium';

    const isOverdue = f.Status === 'Open' && (new Date(f.DueDate) < REFERENCE_DATE);

    // Remediation action button
    let actionBtnHtml = '';
    if (f.Status === 'Open') {
      actionBtnHtml = `
        <button class="btn-primary" onclick="resolveFinding('${f.FindingID}')" style="font-size: 0.75rem; padding: 6px 12px; font-weight: 500;">
          Close Defect
        </button>
      `;
    } else {
      actionBtnHtml = `
        <span style="font-size: 0.75rem; font-weight:600; color: var(--color-low); display: flex; align-items: center; gap: 4px;">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="width:14px;height:14px;" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          Remediated
        </span>
      `;
    }

    html += `
      <tr class="${isOverdue ? 'overdue-alert' : ''}">
        <td style="font-weight:600; color:var(--color-accent);">${f.FindingID}</td>
        <td><a href="risks.html?search=${f.RiskID}" style="font-weight:600; color:var(--color-primary); text-decoration:underline;">${f.RiskID}</a></td>
        <td><span class="badge ${sevClass}">${f.Severity}</span></td>
        <td>${f.Description}</td>
        <td>
          ${f.DueDate}
          ${isOverdue ? '<span class="badge-overdue">Overdue</span>' : ''}
        </td>
        <td><span class="pill pill-${f.Status.toLowerCase()}">${f.Status}</span></td>
        <td>${actionBtnHtml}</td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
  updatePagination(total, startIdx, endIdx);
}

/**
 * Updates table pagination panel
 */
function updatePagination(total, start = 0, end = 0) {
  const prevBtn = document.getElementById('prev-page-btn');
  const nextBtn = document.getElementById('next-page-btn');
  const infoText = document.getElementById('pagination-info');

  if (total === 0) {
    prevBtn.disabled = true;
    nextBtn.disabled = true;
    infoText.innerText = 'Showing 0-0 of 0 entries';
    return;
  }

  infoText.innerText = `Showing ${start + 1}-${end} of ${total} entries`;
  prevBtn.disabled = currentPage === 1;
  nextBtn.disabled = end >= total;
}

/**
 * Resolves a finding interactively
 */
window.resolveFinding = function(findingId) {
  const index = grcData.findings.findIndex(f => f.FindingID === findingId);
  if (index !== -1) {
    grcData.findings[index].Status = 'Closed';

    // Persist finding update to localStorage
    saveGRCData('findings', grcData.findings);

    // Refresh KPIs counters
    updateFindingKPIs();

    // Rerender table
    applyFiltersAndRender();
  }
};
