function drawChart(data) {
  const grouped = {};
  const metric = document.getElementById('metricSelect').value;

  data.forEach(d => {
    const dateKey = d.date.slice(0, 7); // YYYY-MM
    if (!grouped[dateKey]) grouped[dateKey] = 0;
    grouped[dateKey] += metric === 'revenue' ? d.revenue : d.units;
  });

  const labels = Object.keys(grouped).sort();
  const values = labels.map(l => grouped[l]);

  if (chart) chart.destroy();
  const ctx = document.getElementById('salesChart').getContext('2d');
  chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: metric === 'revenue' ? 'Revenue' : 'Units',
        data: values,
        borderColor: 'rgba(59, 130, 246, 1)',
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } }, // quitar leyenda
      scales: { x: { display: true }, y: { display: true } }
    }
  });

  // actualizar título dinámico
  const months = labels;
  if (months.length > 0) {
    const start = months[0];
    const end = months[months.length - 1];
    document.getElementById('chartTitle').innerText =
      `Evolución temporal de ${metric === 'revenue' ? 'Revenue' : 'Units'} entre ${start} y ${end}`;
  }
}

document.getElementById('metricSelect').addEventListener('change', updateDashboard);
