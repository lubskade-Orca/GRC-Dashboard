/**
 * AEGIS GRC - Core Application Javascript
 * Handles CSV parsing, State Management (localStorage), and Page Layout Injections.
 */

// Target Reference Date: 2026-05-24
const REFERENCE_DATE = new Date("2026-05-24");

// Backup CSV strings to ensure CORS-free execution when opened via file:///
const BACKUP_DEPARTMENTS_CSV = `DepartmentID,Name,RiskOwner
DEP01,Information Security,Jane Doe
DEP02,Engineering & DevOps,John Smith
DEP03,Finance & Treasury,Sarah Jenkins
DEP04,Human Resources,Robert Chen
DEP05,Legal & Compliance,Maria Santos
DEP06,Operations & Logistics,David Miller`;

const BACKUP_RISKS_CSV = `RiskID,Title,Department,Likelihood,Impact,RiskScore,Status,Description
RSK01,Unauthorized Production Database Access,DEP02,4,5,20,Open,Developer credentials stored in plaintext in local config files could lead to database exposure and customer PII theft.
RSK02,Phishing Campaign Targeting Finance,DEP03,5,4,20,Open,Spear-phishing emails targeting treasury team to bypass approval controls and authorize fraudulent wire transfers.
RSK03,Outdated SSL/TLS Certificates on API Gateway,DEP01,3,4,12,Open,Expired or weak cryptographic protocols on legacy customer-facing API endpoints vulnerable to man-in-the-middle attacks.
RSK04,Lack of Multi-Factor Authentication on VPN,DEP02,4,4,16,Open,Remote access VPN lacks MFA for contractors and third-party vendors, risking active session hijacking.
RSK05,Unsecured S3 Bucket containing Employee PII,DEP04,2,5,10,Mitigated,Publicly accessible cloud storage bucket containing employee benefits and tax documents.
RSK06,Ransomware Attack on Corporate Network,DEP01,4,5,20,Open,Malicious attachments bypassing spam filters leading to lateral movement and enterprise-wide file locking.
RSK07,Inadequate Business Continuity Plan,DEP06,3,5,15,Open,Disaster recovery procedures for primary data center are outdated and have not been tested under stress scenarios.
RSK08,Third-Party Vendor Data Breach,DEP05,4,4,16,Open,SaaS billing vendor has weak cybersecurity controls risking leakage of client payment histories.
RSK09,Insider Threat - Source Code Leakage,DEP02,3,4,12,Mitigated,Lack of code loss prevention controls on developer endpoints allowing code exfiltration to public repositories.
RSK10,Regulatory Compliance Violations (GDPR),DEP05,3,5,15,Open,Incomplete data inventory mapping leading to non-compliance with EU GDPR data deletion requests.`;

const BACKUP_CONTROLS_CSV = `ControlID,ControlName,Framework,Effectiveness,OwnerDepartment
CNT01,IAM Least Privilege Role Mapping,NIST CSF,Effective,DEP01
CNT02,Security Awareness Training (Phishing),ISO 27001,Partially Effective,DEP04
CNT03,Automated Certificate Renewal,CIS Controls,Effective,DEP02
CNT04,MFA Enforced via SSO,SOC 2,Effective,DEP01
CNT05,Daily Encrypted Cloud Backups,NIST CSF,Effective,DEP02
CNT06,Endpoint Detection and Response (EDR),SOC 2,Effective,DEP01
CNT07,Third-Party Risk Assessment Program,ISO 27001,Ineffective,DEP05
CNT08,Annual Disaster Recovery Simulation,ISO 27001,Partially Effective,DEP06
CNT09,Data Loss Prevention (DLP) Policies,NIST CSF,Effective,DEP01
CNT10,Data Classification Framework,SOC 2,Partially Effective,DEP05`;

const BACKUP_FINDINGS_CSV = `FindingID,RiskID,Severity,Status,Description,DueDate
FND01,RSK01,Critical,Open,Database credentials found in git repositories during static analysis scans.,2026-06-15
FND02,RSK02,High,Open,Treasury staff failed 40 percent of the simulated phishing training tests.,2026-05-10
FND03,RSK03,Medium,Open,Legacy API Gateway running TLS 1.0 and 1.1 requires immediate deprecation.,2026-07-01
FND04,RSK04,Critical,Open,External contractors logging into staging database servers without MFA active.,2026-05-01
FND05,RSK07,High,Open,DR Plan does not specify recovery time objectives (RTO) for core financial ledger.,2026-08-30
FND06,RSK08,High,Open,Vendor security compliance certification expired 6 months ago; assessment pending.,2026-04-15
FND07,RSK10,Medium,Closed,Data inventory mapping completed for marketing department database entities.,2026-03-01
FND08,RSK06,Critical,Open,Server patching cycle is delayed by an average of 45 days in operational zones.,2026-05-20`;

/**
 * Parses raw CSV text into an array of JavaScript objects.
 * Handles escaped quotes and embedded commas correctly.
 */
function parseCSV(text) {
  const lines = text.split(/\r\n|\n/);
  const headers = [];
  const result = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const row = [];
    let inQuotes = false;
    let start = 0;
    
    for (let j = 0; j < line.length; j++) {
      if (line[j] === '"') {
        inQuotes = !inQuotes;
      } else if (line[j] === ',' && !inQuotes) {
        let val = line.substring(start, j).trim();
        val = val.replace(/^"|"$/g, '').replace(/""/g, '"');
        row.push(val);
        start = j + 1;
      }
    }
    let val = line.substring(start).trim();
    val = val.replace(/^"|"$/g, '').replace(/""/g, '"');
    row.push(val);
    
    if (i === 0) {
      // Clean up Byte Order Mark (BOM) if present in headers
      headers.push(...row.map(h => h.replace(/^\uFEFF/, '')));
    } else {
      const obj = {};
      for (let k = 0; k < headers.length; k++) {
        obj[headers[k]] = row[k] || '';
      }
      result.push(obj);
    }
  }
  return result;
}

/**
 * Loads CSV data. Checks localStorage, then fetches files, then falls back to strings.
 */
async function initDatabase() {
  const storeKeys = ['grc_risks', 'grc_findings', 'grc_controls', 'grc_departments'];
  const hasLocal = storeKeys.every(key => localStorage.getItem(key) !== null);

  if (hasLocal) {
    return loadFromLocalStorage();
  }

  // Attempt to fetch from files first
  try {
    const [risksRes, findingsRes, controlsRes, deptsRes] = await Promise.all([
      fetch('data/risks.csv').then(r => r.ok ? r.text() : Promise.reject()),
      fetch('data/findings.csv').then(r => r.ok ? r.text() : Promise.reject()),
      fetch('data/controls.csv').then(r => r.ok ? r.text() : Promise.reject()),
      fetch('data/departments.csv').then(r => r.ok ? r.text() : Promise.reject())
    ]);

    localStorage.setItem('grc_risks', JSON.stringify(parseCSV(risksRes)));
    localStorage.setItem('grc_findings', JSON.stringify(parseCSV(findingsRes)));
    localStorage.setItem('grc_controls', JSON.stringify(parseCSV(controlsRes)));
    localStorage.setItem('grc_departments', JSON.stringify(parseCSV(deptsRes)));
    console.log("GRC database initialized from fetched CSV files.");
  } catch (err) {
    // CORS or fetch error fallback
    console.warn("CORS or Fetch error loading local CSVs, falling back to embedded GRC mock datasets.");
    localStorage.setItem('grc_risks', JSON.stringify(parseCSV(BACKUP_RISKS_CSV)));
    localStorage.setItem('grc_findings', JSON.stringify(parseCSV(BACKUP_FINDINGS_CSV)));
    localStorage.setItem('grc_controls', JSON.stringify(parseCSV(BACKUP_CONTROLS_CSV)));
    localStorage.setItem('grc_departments', JSON.stringify(parseCSV(BACKUP_DEPARTMENTS_CSV)));
  }
  return loadFromLocalStorage();
}

function loadFromLocalStorage() {
  return {
    risks: JSON.parse(localStorage.getItem('grc_risks')),
    findings: JSON.parse(localStorage.getItem('grc_findings')),
    controls: JSON.parse(localStorage.getItem('grc_controls')),
    departments: JSON.parse(localStorage.getItem('grc_departments'))
  };
}

function saveGRCData(type, data) {
  localStorage.setItem(`grc_${type}`, JSON.stringify(data));
}

function resetDatabase() {
  localStorage.removeItem('grc_risks');
  localStorage.removeItem('grc_findings');
  localStorage.removeItem('grc_controls');
  localStorage.removeItem('grc_departments');
  window.location.reload();
}

/**
 * Dynamic Layout Injector
 * Builds header and sidebar dynamically so all content pages share identical elements.
 */
function injectGlobalLayout(currentPageTitle) {
  const sidebarContainer = document.getElementById('sidebar-container');
  const headerContainer = document.getElementById('header-container');

  if (sidebarContainer) {
    sidebarContainer.innerHTML = `
      <div class="sidebar">
        <div class="sidebar-logo">
          <svg class="logo-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
          </svg>
          <span class="logo-text">AEGIS GRC</span>
        </div>
        <ul class="sidebar-menu">
          <li class="menu-item">
            <a href="dashboard.html" class="menu-link" id="link-dashboard">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4zM14 16a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2v-4z"></path></svg>
              Dashboard
            </a>
          </li>
          <li class="menu-item">
            <a href="risks.html" class="menu-link" id="link-risks">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
              Risk Register
            </a>
          </li>
          <li class="menu-item">
            <a href="controls.html" class="menu-link" id="link-controls">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
              Controls Catalog
            </a>
          </li>
          <li class="menu-item">
            <a href="findings.html" class="menu-link" id="link-findings">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path></svg>
              Audit Findings
            </a>
          </li>
          <li class="menu-item">
            <a href="heatmap.html" class="menu-link" id="link-heatmap">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z"></path></svg>
              Risk Heatmap
            </a>
          </li>
          <li class="menu-item">
            <a href="reports.html" class="menu-link" id="link-reports">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
              Reports & Governance
            </a>
          </li>
          <li class="menu-item">
            <a href="admin.html" class="menu-link" id="link-admin">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
              Administration
            </a>
          </li>
        </ul>
        <div class="sidebar-footer">
          <p>© 2026 AEGIS GRC v1.0</p>
          <p>Local Mode Dashboard</p>
        </div>
      </div>
    `;
  }

  if (headerContainer) {
    headerContainer.innerHTML = `
      <div class="header-left">
        <button class="menu-toggle" id="menu-toggle-btn">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
          </svg>
        </button>
        <h1 class="page-title">${currentPageTitle}</h1>
      </div>
      <div class="header-right">
        <span class="env-badge">SECURE GRC LOCAL</span>
        <div class="user-profile" id="user-profile-menu">
          <div class="avatar">SA</div>
          <span class="username">Administrator</span>
        </div>
      </div>
    `;

    // Hook up responsive sidebar toggle
    const toggleBtn = document.getElementById('menu-toggle-btn');
    const sidebar = document.querySelector('.sidebar');
    if (toggleBtn && sidebar) {
      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        sidebar.classList.toggle('active');
      });

      document.addEventListener('click', (e) => {
        if (!sidebar.contains(e.target) && sidebar.classList.contains('active')) {
          sidebar.classList.remove('active');
        }
      });
    }
  }

  // Highlight active link
  const currentFileName = window.location.pathname.split('/').pop() || 'dashboard.html';
  const pageId = currentFileName.replace('.html', '');
  const activeLink = document.getElementById(`link-${pageId}`);
  if (activeLink) {
    activeLink.classList.add('active');
  }
}

/**
 * Calculates core aggregate statistics.
 */
function calculateMetrics(data) {
  const risks = data.risks || [];
  const findings = data.findings || [];
  const controls = data.controls || [];

  // Total Risks
  const totalRisks = risks.length;

  // High & Critical Risks (Score >= 12)
  const highRisksCount = risks.filter(r => parseInt(r.RiskScore) >= 12 && r.Status === 'Open').length;

  // Open Findings
  const openFindings = findings.filter(f => f.Status === 'Open').length;

  // Overdue Findings: Open and DueDate < REFERENCE_DATE (2026-05-24)
  const overdueFindings = findings.filter(f => {
    if (f.Status !== 'Open') return false;
    const dueDate = new Date(f.DueDate);
    return dueDate < REFERENCE_DATE;
  }).length;

  // Compliance Rating: Percentage of controls that are 'Effective'
  const effectiveControls = controls.filter(c => c.Effectiveness === 'Effective').length;
  const complianceScore = controls.length > 0 ? Math.round((effectiveControls / controls.length) * 100) : 0;

  return {
    totalRisks,
    highRisksCount,
    openFindings,
    overdueFindings,
    complianceScore
  };
}

/**
 * Page loading overlays
 */
window.addEventListener('load', () => {
  const loader = document.getElementById('loading-overlay');
  if (loader) {
    setTimeout(() => {
      loader.classList.add('fade-out');
    }, 300);
  }
});
