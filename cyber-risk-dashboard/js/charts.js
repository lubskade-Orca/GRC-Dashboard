/**
 * AEGIS GRC - Dashboard Charts & Metrics Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Inject navigation sidebar and header layout
  injectGlobalLayout('Executive GRC Overview');

  // Load database state
  const data = await initDatabase();
  
  // Calculate and populate KPI metrics
  updateKPIs(data);

  // Populate data tables
  populateTopRisks(data);
  populateRecentFindings(data);

  // Render Chart.js widgets (with fallback for offline development)
  if (typeof Chart !== 'undefined') {
    renderDepartmentRiskChart(data);
    renderFindingsSeverityChart(data);
    renderRiskTrendChart(data);
  } else {
    showChartFallbacks();
  }
});

/**
 * Calculates metrics and updates GRC dashboard cards.
 */
function updateKPIs(data) {
  const metrics = calculateMetrics(data);

  document.getElementById('kpi-total-risks').innerText = metrics.totalRisks;
  document.getElementById('kpi-high-risks').innerText = metrics.highRisksCount;
  document.getElementById('kpi-open-findings').innerText = metrics.openFindings;
  document.getElementById('kpi-compliance-score').innerText = `${metrics.complianceScore}%`;

  // Update overdue counts in GRC card
  const overdueContainer = document.getElementById('kpi-overdue-container');
  if (metrics.overdueFindings > 0) {
    overdueContainer.innerHTML = `
      <span class="badge badge-critical overdue-alert" style="font-size: 0.65rem;">
        ${metrics.overdueFindings} Overdue Findings
      </span>
    `;
  } else {
    overdueContainer.innerHTML = `
      <span class="badge badge-low" style="font-size: 0.65rem;">
        0 Overdue Audit Items
      </span>
    `;
  }
}

/**
 * Populates Top 5 Risks in GRC layout.
 */
function populateTopRisks(data) {
  const risks = data.risks || [];
  const depts = data.departments || [];
  const tbody = document.getElementById('top-risks-body');

  if (risks.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No risks recorded.</td></tr>';
    return;
  }

  // Sort by RiskScore desc, get top 5 open risks
  const topRisks = risks
    .filter(r => r.Status === 'Open')
    .sort((a, b) => parseInt(b.RiskScore) - parseInt(a.RiskScore))
    .slice(0, 5);

  let html = '';
  topRisks.forEach(r => {
    // Resolve department name
    const dept = depts.find(d => d.DepartmentID === r.Department);
    const deptName = dept ? dept.Name : r.Department;

    let scoreClass = 'badge-low';
    const score = parseInt(r.RiskScore);
    if (score >= 16) scoreClass = 'badge-critical';
    else if (score >= 12) scoreClass = 'badge-high';
    else if (score >= 5) scoreClass = 'badge-medium';

    html += `
      <tr>
        <td style="font-weight:600; color:var(--color-accent);">${r.RiskID}</td>
        <td><a href="risks.html" style="text-decoration:underline;">${r.Title}</a></td>
        <td>${deptName}</td>
        <td><span class="badge ${scoreClass}">${score}</span></td>
        <td><span class="pill pill-open">Open</span></td>
      </tr>
    `;
  });
  tbody.innerHTML = html;
}

/**
 * Populates Top 5 Recent Findings.
 */
function populateRecentFindings(data) {
  const findings = data.findings || [];
  const tbody = document.getElementById('recent-findings-body');

  if (findings.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No findings recorded.</td></tr>';
    return;
  }

  // Sort findings by due date desc (most recent action due or set)
  const recent = findings
    .sort((a, b) => new Date(b.DueDate) - new Date(a.DueDate))
    .slice(0, 5);

  let html = '';
  recent.forEach(f => {
    let sevClass = 'badge-low';
    if (f.Severity === 'Critical') sevClass = 'badge-critical';
    else if (f.Severity === 'High') sevClass = 'badge-high';
    else if (f.Severity === 'Medium') sevClass = 'badge-medium';

    const isOverdue = f.Status === 'Open' && (new Date(f.DueDate) < REFERENCE_DATE);
    const dateStr = f.DueDate;
    
    html += `
      <tr class="${isOverdue ? 'overdue-alert' : ''}">
        <td style="font-weight:600; color:var(--color-accent);">${f.FindingID}</td>
        <td><span class="badge ${sevClass}">${f.Severity}</span></td>
        <td>
          ${dateStr}
          ${isOverdue ? '<span class="badge-overdue">Overdue</span>' : ''}
        </td>
        <td><span class="pill pill-${f.Status.toLowerCase()}">${f.Status}</span></td>
      </tr>
    `;
  });
  tbody.innerHTML = html;
}

/**
 * Chart 1: Bar Chart showing risk score exposures by department
 */
function renderDepartmentRiskChart(data) {
  const risks = data.risks || [];
  const depts = data.departments || [];
  const canvas = document.getElementById('departmentRiskChart');

  // Map totals
  const exposureMap = {};
  depts.forEach(d => {
    exposureMap[d.DepartmentID] = {
      name: d.Name,
      exposure: 0
    };
  });

  risks.forEach(r => {
    if (r.Status === 'Open' && exposureMap[r.Department]) {
      exposureMap[r.Department].exposure += parseInt(r.RiskScore);
    }
  });

  const labels = [];
  const values = [];
  
  Object.keys(exposureMap).forEach(key => {
    labels.push(exposureMap[key].name.split('&')[0].trim()); // Shorten names for axis space
    values.push(exposureMap[key].exposure);
  });

  new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Cumulative Risk Score Exposure',
        data: values,
        backgroundColor: 'rgba(6, 182, 212, 0.45)',
        borderColor: '#06B6D4',
        borderWidth: 2,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#9CA3AF' }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#9CA3AF' }
        }
      }
    }
  });
}

/**
 * Chart 2: Donut Chart showing Open Findings by severity
 */
function renderFindingsSeverityChart(data) {
  const findings = data.findings || [];
  const canvas = document.getElementById('findingsSeverityChart');

  const counts = { Critical: 0, High: 0, Medium: 0, Low: 0 };
  findings.forEach(f => {
    if (f.Status === 'Open' && counts[f.Severity] !== undefined) {
      counts[f.Severity]++;
    }
  });

  new Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: ['Critical', 'High', 'Medium', 'Low'],
      datasets: [{
        data: [counts.Critical, counts.High, counts.Medium, counts.Low],
        backgroundColor: [
          'rgba(239, 68, 68, 0.7)',
          'rgba(249, 115, 22, 0.7)',
          'rgba(251, 191, 36, 0.7)',
          'rgba(16, 185, 129, 0.7)'
        ],
        borderColor: '#111827',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { color: '#F9FAFB', boxWidth: 12 }
        }
      },
      cutout: '65%'
    }
  });
}

/**
 * Chart 3: Line Chart showing trend over the last 6 months
 */
function renderRiskTrendChart(data) {
  const canvas = document.getElementById('riskTrendChart');

  // Hardcoded compliance path representing progress leading to 2026-05-24
  const labels = ['Dec 2025', 'Jan 2026', 'Feb 2026', 'Mar 2026', 'Apr 2026', 'May 2026'];
  const riskIndex = [150, 138, 142, 115, 95, 82];
  const complianceTrend = [65, 70, 72, 80, 85, 90];

  new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Portfolio Risk Index',
          data: riskIndex,
          borderColor: '#EF4444',
          backgroundColor: 'rgba(239, 68, 68, 0.05)',
          borderWidth: 3,
          tension: 0.35,
          fill: true,
          yAxisID: 'y'
        },
        {
          label: 'Compliance Level (%)',
          data: complianceTrend,
          borderColor: '#06B6D4',
          backgroundColor: 'transparent',
          borderWidth: 3,
          borderDash: [5, 5],
          tension: 0.35,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: {
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#9CA3AF' },
          title: { display: true, text: 'Cumulative Risk Index', color: '#9CA3AF' }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          grid: { drawOnChartArea: false },
          ticks: { color: '#9CA3AF' },
          title: { display: true, text: 'Compliance %', color: '#9CA3AF' },
          min: 0,
          max: 100
        },
        x: {
          grid: { display: false },
          ticks: { color: '#9CA3AF' }
        }
      },
      plugins: {
        legend: {
          position: 'top',
          labels: { color: '#F9FAFB' }
        }
      }
    }
  });
}

/**
 * Graceful fallback when Chart.js fails to load offline.
 */
function showChartFallbacks() {
  const fallbacks = [
    { id: 'departmentRiskChart', text: 'InfoSec: 32 | Engineering: 48 | Finance: 20 | HR: 10 | Legal: 31 | Ops: 15' },
    { id: 'findingsSeverityChart', text: 'Critical Findings: 3 | High: 3 | Medium: 2 | Low: 0' },
    { id: 'riskTrendChart', text: 'Compliance Level: Dec (65%) -> May (90%) | Portfolio Risk Index: Dec (150) -> May (82)' }
  ];

  fallbacks.forEach(f => {
    const canvas = document.getElementById(f.id);
    if (canvas) {
      const container = canvas.parentElement;
      container.innerHTML = `
        <div style="height: 100%; display: flex; align-items: center; justify-content: center; text-align: center; color: var(--text-secondary); font-size: 0.85rem; padding: 20px; border: 1px dashed var(--border-color); border-radius: 8px;">
          <div>
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width: 32px; height: 32px; color: var(--color-accent); margin: 0 auto 8px;" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
            </svg>
            <p style="font-weight: 600; margin-bottom: 4px;">Visualization Fallback (Offline Mode)</p>
            <p style="color: var(--text-muted); font-size: 0.75rem;">${f.text}</p>
          </div>
        </div>
      `;
    }
  });
}
