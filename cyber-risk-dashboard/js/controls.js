/**
 * AEGIS GRC - Controls Catalog Controller
 */

let grcData = {};
let filteredControls = [];
let currentPage = 1;
const rowsPerPage = 5;
let sortField = 'ControlID';
let sortAsc = true;

document.addEventListener('DOMContentLoaded', async () => {
  // Inject navigation layout
  injectGlobalLayout('Controls Catalog');

  // Load database state
  grcData = await initDatabase();

  // Populate control metrics counters
  updateControlKPIs();

  // Event Listeners for filters
  document.getElementById('control-search').addEventListener('input', handleFilterChange);
  document.getElementById('filter-framework').addEventListener('change', handleFilterChange);
  document.getElementById('filter-effectiveness').addEventListener('change', handleFilterChange);

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
  const sortColumns = ['ControlID', 'ControlName', 'Framework', 'Effectiveness', 'OwnerDepartment'];
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
 * Updates top-level control KPIs
 */
function updateControlKPIs() {
  const controls = grcData.controls || [];
  
  const total = controls.length;
  const effective = controls.filter(c => c.Effectiveness === 'Effective').length;
  const partial = controls.filter(c => c.Effectiveness === 'Partially Effective').length;
  const ineffective = controls.filter(c => c.Effectiveness === 'Ineffective').length;
  const passPct = total > 0 ? Math.round((effective / total) * 100) : 0;

  document.getElementById('stats-total').innerText = total;
  document.getElementById('stats-effective').innerText = effective;
  document.getElementById('stats-partial').innerText = partial;
  document.getElementById('stats-ineffective').innerText = ineffective;
  document.getElementById('stats-effective-pct').innerHTML = `
    <span>${passPct}% Core Compliance</span>
  `;
}

/**
 * Filters, sorts, and triggers table rendering
 */
function applyFiltersAndRender() {
  const searchVal = document.getElementById('control-search').value.toLowerCase().trim();
  const frameworkVal = document.getElementById('filter-framework').value;
  const effectivenessVal = document.getElementById('filter-effectiveness').value;

  const controls = grcData.controls || [];

  // Filter
  filteredControls = controls.filter(c => {
    const matchesSearch = c.ControlID.toLowerCase().includes(searchVal) || 
                          c.ControlName.toLowerCase().includes(searchVal) || 
                          c.Framework.toLowerCase().includes(searchVal);

    const matchesFramework = frameworkVal === 'All' || c.Framework === frameworkVal;
    
    const matchesEffectiveness = effectivenessVal === 'All' || c.Effectiveness === effectivenessVal;

    return matchesSearch && matchesFramework && matchesEffectiveness;
  });

  // Sort
  filteredControls.sort((a, b) => {
    let valA = a[sortField].toLowerCase();
    let valB = b[sortField].toLowerCase();

    if (valA < valB) return sortAsc ? -1 : 1;
    if (valA > valB) return sortAsc ? 1 : -1;
    return 0;
  });

  renderTable();
}

/**
 * Render catalog table
 */
function renderTable() {
  const tbody = document.getElementById('controls-table-body');
  
  if (filteredControls.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No GRC controls matching search filters.</td></tr>';
    updatePagination(0);
    return;
  }

  const total = filteredControls.length;
  const totalPages = Math.ceil(total / rowsPerPage);
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const startIdx = (currentPage - 1) * rowsPerPage;
  const endIdx = Math.min(startIdx + rowsPerPage, total);
  const pageControls = filteredControls.slice(startIdx, endIdx);

  let html = '';
  pageControls.forEach(c => {
    // Resolve department name
    const dept = grcData.departments.find(d => d.DepartmentID === c.OwnerDepartment);
    const deptName = dept ? dept.Name : c.OwnerDepartment;

    // Resolve effectiveness color and percentages
    let color = 'var(--color-low)';
    let width = '100%';
    if (c.Effectiveness === 'Ineffective') {
      color = 'var(--color-critical)';
      width = '20%';
    } else if (c.Effectiveness === 'Partially Effective') {
      color = 'var(--color-medium)';
      width = '60%';
    }

    html += `
      <tr>
        <td style="font-weight:600; color:var(--color-accent);">${c.ControlID}</td>
        <td style="font-weight:500;">${c.ControlName}</td>
        <td><span class="framework-badge">${c.Framework}</span></td>
        <td>
          <div class="meter-container">
            <div class="meter-bar">
              <div class="meter-fill" style="width: ${width}; background-color: ${color};"></div>
            </div>
            <span class="meter-label" style="color: ${color};">${c.Effectiveness}</span>
          </div>
        </td>
        <td>${deptName}</td>
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
