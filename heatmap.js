// my_heatmap_no_deps.js

// This JavaScript file defines a custom Heatmap visualization for Looker.
// It is designed to have NO EXTERNAL JAVASCRIPT DEPENDENCIES,
// relying solely on native browser APIs (pure JavaScript and SVG manipulation).

// The main visualization object that Looker interacts with.
looker.plugins.visualizations.add({
  // Define the configurable options for the visualization. These options will appear
  // in the Looker visualization panel, allowing users to customize the chart.
  options: {
    // Color Scale Settings
    min_color: {
      type: "array",
      label: "Min Value Color",
      default: ["#FFFFFF"], // White
      display: "color",
      section: "Colors",
      order: 1
    },
    mid_color: {
      type: "array",
      label: "Mid Value Color (Optional)",
      default: ["#FFFF00"], // Yellow
      display: "color",
      section: "Colors",
      order: 2
    },
    max_color: {
      type: "array",
      label: "Max Value Color",
      default: ["#FF0000"], // Red
      display: "color",
      section: "Colors",
      order: 3
    },
    use_mid_color: {
      type: "boolean",
      label: "Use Mid Color in Scale",
      default: false,
      display: "radio",
      section: "Colors",
      order: 4
    },
    // Axis Labels
    show_x_axis_labels: {
      type: "boolean",
      label: "Show X-Axis Labels",
      default: true,
      display: "radio",
      section: "Labels",
      order: 1
    },
    show_y_axis_labels: {
      type: "boolean",
      label: "Show Y-Axis Labels",
      default: true,
      display: "radio",
      section: "Labels",
      order: 2
    },
    x_axis_label_size: {
      type: "number",
      label: "X-Axis Label Size",
      default: 12,
      min: 8,
      max: 24,
      step: 1,
      section: "Labels",
      order: 3
    },
    y_axis_label_size: {
      type: "number",
      label: "Y-Axis Label Size",
      default: 12,
      min: 8,
      max: 24,
      step: 1,
      section: "Labels",
      order: 4
    },
    // Cell Value Labels
    show_cell_values: {
      type: "boolean",
      label: "Show Cell Values",
      default: true,
      display: "radio",
      section: "Labels",
      order: 5
    },
    cell_value_size: {
      type: "number",
      label: "Cell Value Font Size",
      default: 10,
      min: 8,
      max: 20,
      step: 1,
      section: "Labels",
      order: 6
    },
    cell_value_color: {
      type: "array",
      label: "Cell Value Color",
      default: ["#000000"], // Black
      display: "color",
      section: "Colors",
      order: 5
    },
    value_decimal_places: {
      type: "number",
      label: "Value Decimal Places",
      default: 1,
      min: 0,
      max: 10,
      step: 1,
      display: "number",
      section: "Labels",
      order: 7
    }
  },

  // The 'create' function is called once when the visualization is first mounted.
  create: function(element, config) {
    // Clear any existing content to ensure a clean slate for the visualization.
    element.innerHTML = '';

    // Create SVG element
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.style.fontFamily = "Inter, sans-serif";
    element.appendChild(svg);

    // Create group element for the heatmap cells
    const heatmapGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    heatmapGroup.setAttribute("class", "heatmap-group");
    svg.appendChild(heatmapGroup);

    // Create group for Y-axis labels
    const yAxisGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    yAxisGroup.setAttribute("class", "y-axis-labels");
    svg.appendChild(yAxisGroup);

    // Create group for X-axis labels
    const xAxisGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    xAxisGroup.setAttribute("class", "x-axis-labels");
    svg.appendChild(xAxisGroup);

    // Create error message container
    const errorContainer = document.createElement("div");
    errorContainer.setAttribute("class", "error-message");
    errorContainer.style.color = "red";
    errorContainer.style.textAlign = "center";
    errorContainer.style.padding = "10px";
    errorContainer.style.display = "none";
    element.appendChild(errorContainer);
  },

  // The 'updateAsync' function is called whenever the data, configuration, or size changes.
  updateAsync: function(data, element, config, queryResponse, details) {
    const svg = element.querySelector("svg");
    const heatmapGroup = svg.querySelector(".heatmap-group");
    const yAxisGroup = svg.querySelector(".y-axis-labels");
    const xAxisGroup = svg.querySelector(".x-axis-labels");
    const errorContainer = element.querySelector(".error-message");

    // Clear previous renderings
    while (heatmapGroup.firstChild) heatmapGroup.removeChild(heatmapGroup.firstChild);
    while (yAxisGroup.firstChild) yAxisGroup.removeChild(yAxisGroup.firstChild);
    while (xAxisGroup.firstChild) xAxisGroup.removeChild(xAxisGroup.firstChild);
    errorContainer.style.display = "none";
    errorContainer.textContent = "";

    // Data Validation
    const dimensions = queryResponse.fields.dimension_like;
    const measures = queryResponse.fields.measure_like;

    if (dimensions.length < 2) {
      errorContainer.style.display = "block";
      errorContainer.textContent = "This visualization requires at least two dimensions (one for X-axis, one for Y-axis).";
      return;
    }
    if (measures.length !== 1) {
      errorContainer.style.display = "block";
      errorContainer.textContent = "This visualization requires exactly one measure (for cell values).";
      return;
    }
    if (data.length === 0) {
      errorContainer.style.display = "block";
      errorContainer.textContent = "No data returned for this query.";
      return;
    }

    // Extract axis dimensions and measure
    const xAxisDimension = dimensions[0].name;
    const yAxisDimension = dimensions[1].name;
    const cellMeasure = measures[0].name;

    // Get unique X and Y axis values
    const xValues = Array.from(new Set(data.map(d => d[xAxisDimension].value)));
    const yValues = Array.from(new Set(data.map(d => d[yAxisDimension].value)));

    // Map data for easy lookup: { 'x_value|y_value': measure_value }
    const cellDataMap = new Map();
    let minValue = Infinity;
    let maxValue = -Infinity;

    data.forEach(d => {
      const x = d[xAxisDimension].value;
      const y = d[yAxisDimension].value;
      const val = parseFloat(d[cellMeasure].value);
      if (!isNaN(val)) {
        cellDataMap.set(`${x}|${y}`, val);
        if (val < minValue) minValue = val;
        if (val > maxValue) maxValue = val;
      }
    });

    // Handle case where all measure values might be the same or no valid numbers
    if (minValue === Infinity || maxValue === -Infinity || minValue === maxValue) {
        minValue = 0;
        maxValue = 1; // Default to a small range if data is uniform or invalid
    }

    // Chart Dimensions and Margins
    const svgWidth = element.offsetWidth;
    const svgHeight = element.offsetHeight;

    const margin = { top: 50, right: 20, bottom: 80, left: 100 }; // Increased margins for labels
    const availableChartWidth = svgWidth - margin.left - margin.right;
    const availableChartHeight = svgHeight - margin.top - margin.bottom;

    // Calculate cell dimensions to make them square or long rectangles
    // Prioritize making cells square based on the number of X-axis items
    const cellWidth = availableChartWidth / xValues.length;
    const cellHeight = cellWidth; // Force square cells

    // Adjust chart dimensions based on the forced square cell size
    const chartWidth = cellWidth * xValues.length;
    const chartHeight = cellHeight * yValues.length;

    // Adjust heatmap group transform to center the heatmap within the available space
    const translateX = margin.left + (availableChartWidth - chartWidth) / 2;
    const translateY = margin.top + (availableChartHeight - chartHeight) / 2;


    // --- Color Scale Function (RGB interpolation) ---
    // Converts hex color to RGB array [r, g, b]
    const hexToRgb = (hex) => {
      const bigint = parseInt(hex.slice(1), 16);
      return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
    };

    // Interpolates between two RGB colors
    const interpolateRgb = (rgb1, rgb2, t) => {
      return `rgb(${Math.round(rgb1[0] + (rgb2[0] - rgb1[0]) * t)},
                    ${Math.round(rgb1[1] + (rgb2[1] - rgb1[1]) * t)},
                    ${Math.round(rgb1[2] + (rgb2[2] - rgb1[2]) * t)})`;
    };

    const getColorForValue = (val) => {
      if (isNaN(val)) return "#CCCCCC"; // Gray for null/invalid values

      const minRgb = hexToRgb(config.min_color[0]);
      const maxRgb = hexToRgb(config.max_color[0]);

      if (config.use_mid_color) {
        const midRgb = hexToRgb(config.mid_color[0]);
        const midPoint = (minValue + maxValue) / 2;

        if (val <= midPoint) {
          const t = (val - minValue) / (midPoint - minValue);
          return interpolateRgb(minRgb, midRgb, t);
        } else {
          const t = (val - midPoint) / (maxValue - midPoint);
          return interpolateRgb(midRgb, maxRgb, t);
        }
      } else {
        const t = (val - minValue) / (maxValue - minValue);
        return interpolateRgb(minRgb, maxRgb, t);
      }
    };

    // --- Render Heatmap Cells ---
    heatmapGroup.setAttribute("transform", `translate(${translateX},${translateY})`);

    yValues.forEach((yVal, yIndex) => {
      xValues.forEach((xVal, xIndex) => {
        const cellValue = cellDataMap.get(`${xVal}|${yVal}`);
        const cellColor = getColorForValue(cellValue);

        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        rect.setAttribute("x", xIndex * cellWidth);
        rect.setAttribute("y", yIndex * cellHeight);
        rect.setAttribute("width", cellWidth);
        rect.setAttribute("height", cellHeight);
        rect.setAttribute("fill", cellColor);
        rect.setAttribute("stroke", "#FFFFFF"); // White border for cells
        rect.setAttribute("stroke-width", 1);
        heatmapGroup.appendChild(rect);

        // Cell Value Label
        if (config.show_cell_values && cellValue !== undefined) {
          const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
          text.setAttribute("x", xIndex * cellWidth + cellWidth / 2);
          text.setAttribute("y", yIndex * cellHeight + cellHeight / 2 + config.cell_value_size / 3); // Adjust y for vertical centering
          text.setAttribute("text-anchor", "middle");
          text.style.fontSize = `${config.cell_value_size}px`;
          text.setAttribute("fill", config.cell_value_color[0]);
          text.textContent = isNaN(cellValue) ? "" : cellValue.toFixed(config.value_decimal_places);
          heatmapGroup.appendChild(text);
        }
      });
    });

    // --- Render Y-Axis Labels ---
    if (config.show_y_axis_labels) {
      yAxisGroup.setAttribute("transform", `translate(${margin.left - 10},${translateY})`); // Shift left, align with heatmapGroup's Y
      yValues.forEach((yVal, yIndex) => {
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", 0);
        text.setAttribute("y", yIndex * cellHeight + cellHeight / 2 + config.y_axis_label_size / 3);
        text.setAttribute("text-anchor", "end");
        text.style.fontSize = `${config.y_axis_label_size}px`;
        text.setAttribute("fill", "#333333");
        text.textContent = yVal;
        yAxisGroup.appendChild(text);
      });
    }

    // --- Render X-Axis Labels ---
    if (config.show_x_axis_labels) {
      xAxisGroup.setAttribute("transform", `translate(${translateX},${translateY + chartHeight + 10})`); // Shift down, align with heatmapGroup's X
      xValues.forEach((xVal, xIndex) => {
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", xIndex * cellWidth + cellWidth / 2);
        text.setAttribute("y", 0);
        text.setAttribute("text-anchor", "middle");
        text.style.fontSize = `${config.x_axis_label_size}px`;
        text.setAttribute("fill", "#333333");
        // Rotate labels if they might overlap
        if (xValues.length > 5 && cellWidth < 80) { // Heuristic for when to rotate
          text.setAttribute("transform", `rotate(45, ${xIndex * cellWidth + cellWidth / 2}, 0)`);
          text.setAttribute("text-anchor", "start");
        }
        text.textContent = xVal;
        xAxisGroup.appendChild(text);
      });
    }
  }
});


