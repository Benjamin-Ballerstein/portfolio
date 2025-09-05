fetch("https://ourworldindata.org/grapher/co-emissions-per-capita.csv?v=1&csvType=filtered&useColumnShortNames=true&tab=table&country=~USA")
  .then(response => response.text())
  .then(csvText => {
    const parsed = Papa.parse(csvText, { header: true });
Chart.register(window['chartjs-plugin-annotation']);
    const data = parsed.data.filter(row =>
      row.Entity === "United States" &&
      row.Year &&
      row.emissions_total_per_capita
    );

    const labels = data.map(row => parseInt(row.Year, 10));
    const values = data.map(row => parseFloat(row.emissions_total_per_capita));
    const maxValue = Math.max(...values);
    const maxIndex = values.indexOf(maxValue);
    const maxYear = labels[maxIndex];

    





    // Plot the chart
    const ctx = document.getElementById('myChart').getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(1, '#7b4eff');
    gradient.addColorStop(0, '#f76031');
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'CO₂ Emissions Per Capita (tonnes)',
          data: values,
          borderColor: gradient,
          borderWidth: 2,
          fill: false,
          pointRadius: 0,
          tension: 0.4
        }]
      },
        options: {
        responsive: true,
        scales: {
            x: { title: { display: true, text: 'Year' },
            type: 'linear',
            max: Math.max(2023),
            ticks: { autoSkip: false,
            stepSize: 50,
            callback: value => value.toString()
            },
            
            },
            y: { title: { display: true, text: 'Tons CO₂ per person' }}
        },
        plugins: {
            legend: { display: false },
            title: {
            display: true,
            text: 'United States',
            font: {
                size: 14
            },
            padding: {
                bottom: 10
            }
            },
            annotation: {
                annotations: {
                    peakLabel: {
                    type: 'label',
                    xValue: maxYear,
                    yValue: maxValue,
                    // yAdjust: -10,
                    xAdjust: -70,
                    xAlign: 'end',
                    backgroundColor: 'rgba(182, 189, 187, 0.2)', // #17B890 with 20% opacity
                    content: `Peak year, ${maxYear}: ${maxValue.toFixed(1)} tons`,
                    font: {
                        size: 10
                    },
                    color: '#161925',
                    // padding: 
                    },
                    peakMarker: {
                    type: 'point',
                    xValue: maxYear,
                    yValue: maxValue,
                    backgroundColor: '#F76031',
                    radius: 4,
                    borderWidth: 0
                    },
                    referenceLine: {
                    type: 'line',
                    scaleID: 'y',
                    value: 2.3,
                    borderColor: '#7b4eff',
                    borderWidth: 1,
                    borderDash: [6, 4],
                    label: {
                        display: true,
                        content: '2030 Target: 2.3 tons',
                        position: 'start',
                        color: '#7b4eff',
                        backgroundColor: 'rgba(255,255,255,0.8)',
                        font: {
                        size: 10,
                        style: 'italic'
                        },
                        padding: 4
                    }
                    }
                }
                }

        }
        },
        animation: {
        duration: 1000,       // in ms
        easing: 'easeInOutCubic'
        }


    });
  });
