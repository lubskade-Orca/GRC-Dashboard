/**
 * AEGIS GRC - Risk Register Controller
 */

let grcData = {};
let filteredRisks = [];
let currentPage = 1;
const rowsPerPage = 5;
let activeView = 'table'; // 'table' or 'cards'
let sortField = 'RiskID';
let sortAsc = true;
let selectedRisk = null;

document.addEventListener('DOMContentLoaded', async () => {
  // Inject global layout
  injectGlobalLayout('Risk Register');

  // Load database state
  grcData = await initDatabase();

  // Populate department filter select
  populateDepartmentFilter();

  // Setup filters event listeners
  document.getElementById('risk-search').addEventListener('input', handleFilterChange);
  document.getElementById('filter-dept').addEventListener('change', handleFilterChange);
  document.getElementById('filter-severity').addEventListener('change', handleFilterChange);
  document.getElementById('filter-status').addEventListener('change', handleFilterChange);

  // Setup view toggle event listeners
  document.getElementById('view-table-btn').addEventListener('click', () => setView('table'));
  document.getElementById('view-cards-btn').addEventListener('click', () => setView('cards'));

  // Setup pagination buttons
  document.getElementById('prev-page-btn').addEventListener('click', () => changePage(-1));
  document.getElementById('next-page-btn').addEventListener('click', () => changePage(1));

  // Run initial render
  applyFiltersAndRender();
});

/**
 * Populates Department dropdown dynamically.
 */
function populateDepartmentFilter() {
  const select = document.getElementById('filter-dept');
  const depts = grcData.departments || [];
  depts.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d.DepartmentID;
    opt.innerText = d.Name;
    select.appendChild(opt);
  });
}

/**
 * Filter change callback.
 */
function handleFilterChange() {
  currentPage = 1; // Reset to page 1 on filter
  applyFiltersAndRender();
}

/**
 * Toggles view layouts.
 */
function setView(view) {
  activeView = view;
  document.getElementById('view-table-btn').classList.toggle('active', view === 'table');
  document.getElementById('view-cards-btn').classList.toggle('active', view === 'cards');

  document.getElementById('table-view-container').style.display = view === 'table' ? 'block' : 'none';
  document.getElementById('card-view-container').style.display = view === 'cards' ? 'block' : 'none';

  applyFiltersAndRender();
}

/**
 * Column sorting action.
 */
function toggleSort(field) {
  if (sortField === field) {
    sortAsc = !sortAsc;
  } else {
    sortField = field;
    sortAsc = true;
  }

  // Update indicators
  const sortColumns = ['RiskID', 'Title', 'Department', 'Likelihood', 'Impact', 'RiskScore', 'Status'];
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
}

/**
 * Paginates values.
 */
function changePage(direction) {
  currentPage += direction;
  renderActiveView();
}

/**
 * Main logical coordinator.
 */
function applyFiltersAndRender() {
  const searchVal = document.getElementById('risk-search').value.toLowerCase().trim();
  const deptVal = document.getElementById('filter-dept').value;
  const severityVal = document.getElementById('filter-severity').value;
  const statusVal = document.getElementById('filter-status').value;

  const risks = grcData.risks || [];

  // Filter
  filteredRisks = risks.filter(r => {
    // Search filter
    const matchesSearch = r.RiskID.toLowerCase().includes(searchVal) || 
                          r.Title.toLowerCase().includes(searchVal) || 
                          r.Description.toLowerCase().includes(searchVal);
    
    // Department filter
    const matchesDept = deptVal === 'All' || r.Department === deptVal;

    // Severity Filter
    const score = parseInt(r.RiskScore);
    let severity = 'Low';
    if (score >= 16) severity = 'Critical';
    else if (score >= 10) severity = 'High';
    else if (score >= 5) severity = 'Medium';

    const matchesSeverity = severityVal === 'All' || severity === severityVal;

    // Status Filter
    const matchesStatus = statusVal === 'All' || r.Status === statusVal;

    return matchesSearch && matchesDept && matchesSeverity && matchesStatus;
  });

  // Sort
  filteredRisks.sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];

    // Handle numeric fields
    if (['Likelihood', 'Impact', 'RiskScore'].includes(sortField)) {
      valA = parseInt(valA);
      valB = parseInt(valB);
    }

    if (valA < valB) return sortAsc ? -1 : 1;
    if (valA > valB) return sortAsc ? 1 : -1;
    return 0;
  });

  renderActiveView();
}

/**
 * Renders views.
 */
function renderActiveView() {
  if (activeView === 'table') {
    renderTable();
  } else {
    renderCards();
  }
}

/**
 * Render grid layout.
 */
function renderTable() {
  const tbody = document.getElementById('risks-table-body');
  
  if (filteredRisks.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No matching cyber risks found.</td></tr>';
    updatePagination(0);
    return;
  }

  // Slice for page
  const total = filteredRisks.length;
  const totalPages = Math.ceil(total / rowsPerPage);
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const startIdx = (currentPage - 1) * rowsPerPage;
  const endIdx = Math.min(startIdx + rowsPerPage, total);
  const pageRisks = filteredRisks.slice(startIdx, endIdx);

  let html = '';
  pageRisks.forEach(r => {
    const dept = grcData.departments.find(d => d.DepartmentID === r.Department);
    const deptName = dept ? dept.Name : r.Department;

    let scoreClass = 'badge-low';
    const score = parseInt(r.RiskScore);
    if (score >= 16) scoreClass = 'badge-critical';
    else if (score >= 10) scoreClass = 'badge-high';
    else if (score >= 5) scoreClass = 'badge-medium';

    html += `
      <tr onclick="openRiskModal('${r.RiskID}')" style="cursor:pointer;">
        <td style="font-weight:600; color:var(--color-accent);">${r.RiskID}</td>
        <td style="font-weight:500;">${r.Title}</td>
        <td>${deptName}</td>
        <td style="text-align:center;">${r.Likelihood}</td>
        <td style="text-align:center;">${r.Impact}</td>
        <td style="text-align:center;"><span class="badge ${scoreClass}">${score}</span></td>
        <td><span class="pill pill-${r.Status.toLowerCase()}">${r.Status}</span></td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
  updatePagination(total, startIdx, endIdx);
}

/**
 * Render modern cards view.
 */
function renderCards() {
  const grid = document.getElementById('risks-card-grid');
  
  if (filteredRisks.length === 0) {
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding:40px; color:var(--text-secondary);">No matching cyber risks found.</div>';
    return;
  }

  let html = '';
  filteredRisks.forEach(r => {
    const dept = grcData.departments.find(d => d.DepartmentID === r.Department);
    const deptName = dept ? dept.Name : r.Department;

    let scoreClass = 'badge-low';
    const score = parseInt(r.RiskScore);
    if (score >= 16) scoreClass = 'badge-critical';
    else if (score >= 10) scoreClass = 'badge-high';
    else if (score >= 5) scoreClass = 'badge-medium';

    html += `
      <div class="risk-card-item" onclick="openRiskModal('${r.RiskID}')">
        <div class="risk-card-header">
          <span class="risk-card-id">${r.RiskID}</span>
          <span class="badge ${scoreClass}">Score: ${score}</span>
        </div>
        <h3 class="risk-card-title">${r.Title}</h3>
        <p class="risk-card-desc">${r.Description}</p>
        <div class="risk-card-meta">
          <span>${deptName}</span>
          <span class="pill pill-${r.Status.toLowerCase()}">${r.Status}</span>
        </div>
      </div>
    `;
  });
  grid.innerHTML = html;
}

/**
 * Updates pagination metrics indicators.
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
 * Open Risk Modal Dialog drawer.
 */
window.openRiskModal = function(riskId) {
  const risk = grcData.risks.find(r => r.RiskID === riskId);
  if (!risk) return;

  selectedRisk = risk;

  // Resolve dept name and owner
  const dept = grcData.departments.find(d => d.DepartmentID === risk.Department);
  const deptName = dept ? dept.Name : risk.Department;
  const owner = dept ? dept.RiskOwner : 'Unassigned';

  // Calculate score classes
  let scoreClass = 'badge-low';
  const score = parseInt(risk.RiskScore);
  if (score >= 16) scoreClass = 'badge-critical';
  else if (score >= 10) scoreClass = 'badge-high';
  else if (score >= 5) scoreClass = 'badge-medium';

  // Set titles
  document.getElementById('modal-risk-id').innerText = `Risk Incident File - ${risk.RiskID}`;
  document.getElementById('modal-risk-title').innerText = risk.Title;
  document.getElementById('modal-risk-dept').innerText = deptName;
  document.getElementById('modal-risk-owner').innerText = owner;
  document.getElementById('modal-risk-like').innerText = `${risk.Likelihood}/5`;
  document.getElementById('modal-risk-impact').innerText = `${risk.Impact}/5`;
  
  const scoreBadge = document.getElementById('modal-risk-score');
  scoreBadge.innerText = `${score} (${score >= 16 ? 'Critical' : score >= 10 ? 'High' : score >= 5 ? 'Medium' : 'Low'})`;
  scoreBadge.className = `badge ${scoreClass}`;

  document.getElementById('modal-risk-desc').innerText = risk.Description;

  // Filter linked controls: any controls belonging to this department
  const linkedControls = grcData.controls.filter(c => c.OwnerDepartment === risk.Department);
  const controlsTbody = document.getElementById('modal-risk-controls');
  if (linkedControls.length === 0) {
    controlsTbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-secondary);">No controls currently mapped to this unit department.</td></tr>';
  } else {
    controlsTbody.innerHTML = linkedControls.map(c => `
      <tr>
        <td style="font-weight:600; color:var(--color-accent);">${c.ControlID}</td>
        <td>${c.ControlName}</td>
        <td><span class="framework-badge">${c.Framework}</span></td>
        <td><span style="font-weight:600; color:${c.Effectiveness === 'Effective' ? 'var(--color-low)' : c.Effectiveness === 'Ineffective' ? 'var(--color-critical)' : 'var(--color-medium)'};">${c.Effectiveness}</span></td>
      </tr>
    `).join('');
  }

  // Filter linked findings: audit findings belonging to this RiskID
  const linkedFindings = grcData.findings.filter(f => f.RiskID === risk.RiskID);
  const findingsTbody = document.getElementById('modal-risk-findings');
  if (linkedFindings.length === 0) {
    findingsTbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-secondary);">No audit findings linked to this threat register.</td></tr>';
  } else {
    findingsTbody.innerHTML = linkedFindings.map(f => {
      let fClass = 'badge-low';
      if (f.Severity === 'Critical') fClass = 'badge-critical';
      else if (f.Severity === 'High') fClass = 'badge-high';
      else if (f.Severity === 'Medium') fClass = 'badge-medium';

      return `
        <tr>
          <td style="font-weight:600; color:var(--color-accent);">${f.FindingID}</td>
          <td>${f.Description}</td>
          <td><span class="badge ${fClass}">${f.Severity}</span></td>
          <td><span class="pill pill-${f.Status.toLowerCase()}">${f.Status}</span></td>
        </tr>
      `;
    }).join('');
  }

  // Set status interactive fields
  const statusIndicator = document.getElementById('modal-status-indicator');
  statusIndicator.className = `pill pill-${risk.Status.toLowerCase()}`;
  statusIndicator.innerText = risk.Status;

  document.getElementById('change-status-select').value = risk.Status;

  // Show Modal
  const modalOverlay = document.getElementById('risk-modal-overlay');
  const modal = document.getElementById('risk-detail-modal');
  modalOverlay.style.display = 'flex';
  setTimeout(() => {
    modal.classList.add('show');
  }, 10);
};

window.closeRiskModal = function() {
  const modalOverlay = document.getElementById('risk-modal-overlay');
  const modal = document.getElementById('risk-detail-modal');
  modal.classList.remove('show');
  setTimeout(() => {
    modalOverlay.style.display = 'none';
  }, 300);
};

// Close modal when clicking background overlay
document.getElementById('risk-modal-overlay').addEventListener('click', (e) => {
  if (e.target === document.getElementById('risk-modal-overlay')) {
    closeRiskModal();
  }
});

/**
 * Updates selected GRC risk status interactively.
 */
window.updateRiskStatus = function() {
  if (!selectedRisk) return;

  const select = document.getElementById('change-status-select');
  const newStatus = select.value;

  // Modify local memory risk reference
  const index = grcData.risks.findIndex(r => r.RiskID === selectedRisk.RiskID);
  if (index !== -1) {
    grcData.risks[index].Status = newStatus;
    selectedRisk.Status = newStatus;

    // Save GRC status state to local storage
    saveGRCData('risks', grcData.risks);

    // Update status indicators
    const statusIndicator = document.getElementById('modal-status-indicator');
    statusIndicator.className = `pill pill-${newStatus.toLowerCase()}`;
    statusIndicator.innerText = newStatus;

    // Redraw lists
    applyFiltersAndRender();
  }
};
