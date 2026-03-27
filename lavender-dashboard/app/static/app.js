// === State ===
let topologyData = null;
let containerLinks = {};

// === Init ===
document.addEventListener('DOMContentLoaded', async () => {
  const [sysRes, ctrRes, topoRes] = await Promise.all([
    fetch('/api/system').then(r => r.json()),
    fetch('/api/containers').then(r => r.json()),
    fetch('/api/topology').then(r => r.json()),
  ]);

  topologyData = topoRes;
  containerLinks = topoRes.container_links || {};
  updateSystem(sysRes);
  updateContainers(ctrRes);
  renderTopology(topoRes);
  initTopoScroll();
  connectSSE();
});

// === SSE ===
function connectSSE() {
  const statusEl = document.getElementById('sse-status');
  const statusText = statusEl.querySelector('.status-text');

  const es = new EventSource('/api/events');

  es.addEventListener('system', (e) => {
    updateSystem(JSON.parse(e.data));
  });

  es.addEventListener('containers', (e) => {
    updateContainers(JSON.parse(e.data));
  });

  es.addEventListener('open', () => {
    statusEl.className = 'connection-status connected';
    statusText.textContent = 'live';
  });

  es.onopen = () => {
    statusEl.className = 'connection-status connected';
    statusText.textContent = 'live';
  };

  es.onerror = () => {
    statusEl.className = 'connection-status disconnected';
    statusText.textContent = 'reconnecting';
  };
}

// === System Updates ===
function updateSystem(data) {
  // CPU
  setText('cpu-percent', `${data.cpu.percent}%`);
  setText('cpu-model', data.cpu.model);
  setText('cpu-threads', `${data.cpu.threads} threads`);
  setBar('cpu-bar', data.cpu.percent);

  // RAM
  setText('ram-percent', `${data.memory.percent}%`);
  setText('ram-usage', `${data.memory.used_human} / ${data.memory.total_human}`);
  setBar('ram-bar', data.memory.percent);

  // Network
  setText('net-interface', data.network.interface);
  setText('net-ip', data.network.ip || '--');
  setText('net-sent', `${data.network.sent_human || '--'} sent`);
  setText('net-recv', `${data.network.recv_human || '--'} recv`);

  // Storage
  updateStorage(data.disks);
}

function updateStorage(disks) {
  const grid = document.getElementById('storage-grid');
  grid.innerHTML = '';

  for (const disk of disks) {
    const card = document.createElement('div');
    card.className = 'disk-card';
    card.innerHTML = `
      <div class="disk-header">
        <span class="disk-label">${disk.label}</span>
        <span class="disk-percent">${disk.percent}%</span>
      </div>
      <div class="disk-detail">${disk.used_human} / ${disk.total_human} &mdash; ${disk.device} &mdash; ${disk.mount}</div>
      <div class="progress-bar">
        <div class="progress-fill ${barClass(disk.percent)}" style="width: ${disk.percent}%"></div>
      </div>
    `;
    grid.appendChild(card);
  }
}

// === Container Updates ===
function updateContainers(stacks) {
  const wrapper = document.getElementById('container-stacks');
  wrapper.innerHTML = '';

  // Stack ordering
  const stackOrder = ['bigstackd', 'infra', 'databases', 'media', 'mailserver', 'system'];
  const stackColors = {
    bigstackd: 'var(--stack-bigstackd)',
    infra: 'var(--stack-infra)',
    databases: 'var(--stack-databases)',
    media: 'var(--stack-media)',
    mailserver: 'var(--stack-mailserver)',
    system: 'var(--stack-system)',
  };
  const stackLabels = {
    bigstackd: 'Core Services',
    infra: 'Infrastructure',
    databases: 'Databases',
    media: 'Media & Streaming',
    mailserver: 'Email',
    system: 'System',
  };

  let totalCount = 0;

  // Sort stacks in order, then any unknown stacks at the end
  const orderedKeys = [...stackOrder.filter(k => stacks[k]), ...Object.keys(stacks).filter(k => !stackOrder.includes(k))];

  for (const stackKey of orderedKeys) {
    const containers = stacks[stackKey];
    if (!containers || containers.length === 0) continue;
    totalCount += containers.length;

    const group = document.createElement('div');
    group.className = 'stack-group';

    const color = stackColors[stackKey] || 'var(--text-dim)';
    const label = stackLabels[stackKey] || stackKey;

    group.innerHTML = `
      <div class="stack-header">
        <span class="stack-dot" style="background: ${color}"></span>
        <span class="stack-name">${label}</span>
        <span class="container-count">(${containers.length})</span>
      </div>
      <div class="stack-grid">
        ${containers.map(c => containerCard(c, color)).join('')}
      </div>
    `;
    wrapper.appendChild(group);
  }

  setText('container-count', `(${totalCount} total)`);
}

function containerCard(c, stackColor) {
  const healthClass = c.status !== 'running' ? 'stopped' : c.health;
  const statusLabel = c.status !== 'running' ? c.status : (c.health === 'none' ? 'running' : c.health);
  const shortImage = c.image.split('/').pop();
  const link = containerLinks[c.name];
  const clickable = link ? 'clickable' : '';
  const onClick = link ? `onclick="window.open('${link}', '_blank')"` : '';

  return `
    <div class="container-card ${c.status} ${clickable}" style="border-left-color: ${stackColor}" data-container="${c.name}" ${onClick}>
      <div class="container-top">
        <span class="container-name">${c.name}</span>
        <div class="container-status">
          <span class="status-label">${statusLabel}</span>
          <span class="health-dot ${healthClass}"></span>
        </div>
      </div>
      <div class="container-meta">up ${c.uptime}</div>
      <div class="container-image" title="${c.image}">${shortImage}</div>
    </div>
  `;
}

// === Topology ===
function renderTopology(topo) {
  const container = document.getElementById('topology');

  const publicServices = topo.subdomains.filter(s => !s.auth);
  const authServices = topo.subdomains.filter(s => s.auth);
  const allServices = [...authServices, ...publicServices];

  const nodeH = 32;
  const nodeGap = 6;
  const serviceCount = allServices.length;
  const svgH = Math.max(400, 80 + serviceCount * (nodeH + nodeGap));
  const svgW = 1000;

  // Column X positions
  const col = { internet: 40, cloudflare: 200, npm: 400, auth: 600, services: 780 };
  const centerY = svgH / 2;

  let svg = `<svg class="topo-svg" viewBox="0 0 ${svgW} ${svgH}" xmlns="http://www.w3.org/2000/svg">`;

  // Column labels
  svg += columnLabel(col.internet + 30, 25, 'Internet');
  svg += columnLabel(col.cloudflare + 20, 25, 'Cloudflare');
  svg += columnLabel(col.npm + 25, 25, 'Proxy');
  svg += columnLabel(col.auth + 10, 25, 'Auth');
  svg += columnLabel(col.services + 10, 25, 'Services');

  // Central nodes
  const internetY = centerY - 16;
  const cfY = centerY - 16;
  const npmY = centerY - 16;
  const authY = centerY - 16;

  svg += topoNode(col.internet, internetY, 100, 32, 'Internet', '', '#448aff', null);
  svg += topoNode(col.cloudflare, cfY, 140, 32, 'Cloudflare Tunnel', '', '#f48c42', null);
  svg += topoNode(col.npm, npmY, 120, 32, 'NPM', '', '#3498db', null);
  svg += topoNode(col.auth, authY, 120, 32, 'Authentik', 'auth.' + topo.domain, '#ffc107', 'https://auth.' + topo.domain);

  // Lines: Internet -> Cloudflare -> NPM
  svg += topoLine(col.internet + 100, internetY + 16, col.cloudflare, cfY + 16, true);
  svg += topoLine(col.cloudflare + 140, cfY + 16, col.npm, npmY + 16, true);

  // Service nodes
  const startY = 45;
  allServices.forEach((s, i) => {
    const y = startY + i * (nodeH + nodeGap);
    const stackColor = topo.stacks[s.stack]?.color || '#95a5a6';
    const label = s.service;
    const sub = s.subdomain + '.' + topo.domain;

    const noLink = topo.no_link || [];
    const serviceLink = noLink.includes(s.container) ? null : 'https://' + sub;
    svg += topoNode(col.services, y, 180, nodeH, label, sub, stackColor, serviceLink);

    // Line from NPM to service
    svg += topoLine(col.npm + 120, npmY + 16, col.services, y + nodeH / 2, false);

    // If auth-protected, line through Authentik
    if (s.auth) {
      svg += topoLine(col.npm + 120, npmY + 16, col.auth, authY + 16, false);
      svg += topoLine(col.auth + 120, authY + 16, col.services, y + nodeH / 2, false);
      // Auth badge
      svg += `<text x="${col.services - 14}" y="${y + nodeH / 2 + 4}" class="topo-auth-badge" text-anchor="end">&#x1f6e1;</text>`;
    }
  });

  svg += '</svg>';
  container.innerHTML = svg;
}

function topoNode(x, y, w, h, label, subtitle, color, link) {
  const cursor = link ? 'pointer' : 'default';
  const onClick = link ? `onclick="window.open('${link}', '_blank')"` : '';
  return `
    <g class="topo-node" transform="translate(${x}, ${y})" style="cursor: ${cursor}" ${onClick}>
      <rect width="${w}" height="${h}" style="stroke: ${color}; fill: ${color}11"></rect>
      <text x="${w / 2}" y="${subtitle ? h / 2 - 2 : h / 2 + 4}" text-anchor="middle" class="node-label">${label}</text>
      ${subtitle ? `<text x="${w / 2}" y="${h / 2 + 10}" text-anchor="middle" class="node-subdomain">${subtitle}</text>` : ''}
    </g>
  `;
}

function topoLine(x1, y1, x2, y2, active) {
  const midX = (x1 + x2) / 2;
  return `<path d="M${x1},${y1} C${midX},${y1} ${midX},${y2} ${x2},${y2}" class="topo-line ${active ? 'active' : ''}" />`;
}

function columnLabel(x, y, text) {
  return `<text x="${x}" y="${y}" class="topo-column-label">${text}</text>`;
}

// === Topology Scroll Hint ===
function initTopoScroll() {
  const el = document.querySelector('.topology-container');
  if (!el) return;
  el.addEventListener('scroll', () => {
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 10;
    el.classList.toggle('scrolled-end', atEnd);
  });
}

// === Helpers ===
function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setBar(id, percent) {
  const el = document.getElementById(id);
  if (el) {
    el.style.width = `${percent}%`;
    el.className = `progress-fill ${barClass(percent)}`;
  }
}

function barClass(percent) {
  if (percent >= 90) return 'critical';
  if (percent >= 75) return 'warn';
  return '';
}
