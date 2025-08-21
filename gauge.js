// my_radar_gauge_no_deps.js

// This JavaScript file defines a custom Radar Gauge visualization for Looker.
// It is designed to have NO EXTERNAL JAVASCRIPT DEPENDENCIES,
// relying solely on native browser APIs (pure JavaScript and SVG manipulation).

// The main visualization object that Looker interacts with.
looker.plugins.visualizations.add({
  // Define the configurable options for the visualization. These options will appear
  // in the Looker visualization panel, allowing users to customize the chart.
  options: {
    // Chart Title
    chart_title: {
      type: "string",
      label: "Chart Title",
      default: "Performance Overview",
      display: "text",
      section: "Labels & Text",
      order: 1
    },
    title_display: {
      type: "boolean",
      label: "Display Title",
      default: true,
      display: "radio",
      section: "Labels & Text",
      order: 2
    },
    // Gauge Grid & Scale
    levels: {
      type: "number",
      label: "Number of Grid Levels",
      default: 5,
      min: 2,
      max: 10,
      step: 1,
      section: "Gauge Settings",
      order: 1
    },
    max_value: {
      type: "number",
      label: "Max Value (Optional)",
      default: null, // Auto-calculate if null
      display: "number",
      section: "Gauge Settings",
      order: 2,
      description: "Set a fixed maximum value for all axes. Leave blank for auto-scaling."
    },
    // Colors
    radar_fill_color: {
      type: "array",
      label: "Radar Area Color",
      default: ["#4285F4"], // Google Blue
      display: "color",
      section: "Colors",
      order: 1
    },
    radar_stroke_color: {
      type: "array",
      label: "Radar Border Color",
      default: ["#1A73E8"], // Darker Google Blue
      display: "color",
      section: "Colors",
      order: 2
    },
    grid_color: {
      type: "array",
      label: "Grid & Axis Line Color",
      default: ["#CDCDCD"], // Light gray
      display: "color",
      section: "Colors",
      order: 3
    },
    axis_label_color: {
      type: "array",
      label: "Axis Label Color",
      default: ["#333333"],
      display: "color",
      section: "Colors",
      order: 4
    },
    value_label_color: {
      type: "array",
      label: "Value Label Color",
      default: ["#000000"],
      display: "color",
      section: "Colors",
      order: 5
    },
    // Labels & Text Sizes
    axis_label_font_size: {
      type: "number",
      label: "Axis Label Font Size",
      default: 12,
      min: 8,
      max: 24,
      step: 1,
      section: "Labels & Text",
      order: 3
    },
    show_value_labels: {
      type: "boolean",
      label: "Show Value Labels on Axes",
      default: true,
      display: "radio",
      section: "Labels & Text",
      order: 4
    },
    value_label_font_size: {
      type: "number",
      label: "Value Label Font Size",
      default: 10,
      min: 8,
      max: 20,
      step: 1,
      section: "Labels & Text",
      order: 5
    },
    value_decimal_places: {
      type: "number",
      label: "Value Decimal Places",
      default: 1,
      min: 0,
      max: 5,
      step: 1,
      display: "number",
      section: "Labels & Text",
      order: 6
    },
    // Opacity & Stroke
    fill_opacity: {
      type: "number",
      label: "Radar Fill Opacity",
      default: 0.7,
      min: 0.1,
      max: 1.0,
      step: 0.1,
      section: "Colors",
      order: 6
    },
    stroke_width: {
      type: "number",
      label: "Radar Border Width",
      default: 2,
      min: 1,
      max: 5,
      step: 1,
      section: "Colors",
      order: 7
    },
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

    // Create group element for the radar chart elements
    const radarGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    radarGroup.setAttribute("class", "radar-group");
    svg.appendChild(radarGroup);

    // Create title element
    const titleText = document.createElementNS("http://www.w3.org/2000/svg", "text");
    titleText.setAttribute("class", "chart-title");
    titleText.setAttribute("text-anchor", "middle");
    titleText.style.fontWeight = "bold";
    svg.appendChild(titleText);

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
    const radarGroup = svg.querySelector(".radar-group");
    const titleText = svg.querySelector(".chart-title");
    const errorContainer = element.querySelector(".error-message");

    // Clear previous renderings
    while (radarGroup.firstChild) radarGroup.removeChild(radarGroup.firstChild);
    errorContainer.style.display = "none";
    errorContainer.textContent = "";

    // Data Validation
    const dimensions = queryResponse.fields.dimension_like;
    const measures = queryResponse.fields.measure_like;

    if (dimensions.length === 0) {
      errorContainer.style.display = "block";
      errorContainer.textContent = "This visualization requires at least one dimension (for the item name).";
      return;
    }
    if (measures.length < 1) { // Radar chart needs at least one measure to draw an axis, but is useful with multiple
      errorContainer.style.display = "block";
      errorContainer.textContent = "This visualization requires at least one measure (for performance metrics).";
      return;
    }
    if (data.length === 0) {
      errorContainer.style.display = "block";
      errorContainer.textContent = "No data returned for this query.";
      return;
    }
    if (data.length > 1) {
      errorContainer.style.display = "block";
      errorContainer.textContent = "This Radar Gauge visualization is designed for a single item. Please ensure your query returns only one row of data (e.g., by filtering to a single dimension value).";
      return;
    }

    const rowData = data[0];
    const itemDimensionName = dimensions[0].name;
    const itemName = rowData[itemDimensionName].value;

    // Prepare data for radar chart
    const radarData = measures.map(measure => {
      const value = parseFloat(rowData[measure.name] ? rowData[measure.name].value : 0);
      return {
        axis: measure.label_short || measure.label || measure.name,
        value: value
      };
    });

    // Chart Dimensions
    const width = element.offsetWidth;
    const height = element.offsetHeight;
    const radius = Math.min(width, height) / 2 * 0.7; // Radius of the radar chart
    const centerX = width / 2;
    
    // Define the Y position for the title
    const titleYPosition = 30; // Y position for the title's baseline

    // Calculate centerY for the radar chart to be below the title
    // The top of the radar chart is centerY - radius.
    // We want (centerY - radius) to be below titleYPosition + some padding (e.g., 20px).
    const centerY = titleYPosition + 50 + radius; // Adjusted centerY for space below title

    // Update title
    if (config.title_display) {
      titleText.setAttribute("x", centerX);
      titleText.setAttribute("y", titleYPosition); // Position title at the top
      titleText.textContent = `${config.chart_title}: ${itemName}`; // Include item name in title
    } else {
      titleText.textContent = "";
    }

    // Calculate maximum value for the radar axes
    let maxValue = config.max_value;
    if (maxValue === null || isNaN(maxValue)) {
      maxValue = 0;
      radarData.forEach(d => {
        if (d.value > maxValue) maxValue = d.value;
      });
      // Add some padding to the max value for better visual spacing.
      maxValue = maxValue * 1.1;
      if (maxValue === 0) maxValue = 1; // Avoid division by zero if all values are 0
    }

    const totalAxes = radarData.length;
    const angleSlice = Math.PI * 2 / totalAxes; // Angle for each axis

    // Function to scale value to radius
    const scaleRadius = (val) => (val / maxValue) * radius;

    // Translate radar group to center
    radarGroup.setAttribute("transform", `translate(${centerX},${centerY})`);

    // --- Draw Grid Circles (Levels) ---
    const levels = config.levels;
    for (let i = 1; i <= levels; i++) {
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("r", (radius / levels) * i);
      circle.setAttribute("fill", "none");
      circle.setAttribute("stroke", config.grid_color[0]);
      circle.setAttribute("stroke-width", 0.5);
      radarGroup.appendChild(circle);
    }

    // --- Draw Axes and Labels ---
    radarData.forEach((d, i) => {
      const angle = angleSlice * i - Math.PI / 2; // Start from top (-90 degrees)
      const lineX = radius * Math.cos(angle);
      const lineY = radius * Math.sin(angle);

      // Axis line
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", 0);
      line.setAttribute("y1", 0);
      line.setAttribute("x2", lineX);
      line.setAttribute("y2", lineY);
      line.setAttribute("stroke", config.grid_color[0]);
      line.setAttribute("stroke-width", 1);
      radarGroup.appendChild(line);

      // Axis label (measure name)
      const labelX = (radius + 20) * Math.cos(angle); // Slightly outside the grid
      const labelY = (radius + 20) * Math.sin(angle);

      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("x", labelX);
      text.setAttribute("y", labelY);
      text.setAttribute("text-anchor", Math.abs(Math.cos(angle)) < 0.001 ? "middle" : (Math.cos(angle) > 0 ? "start" : "end"));
      text.setAttribute("dominant-baseline", Math.abs(Math.sin(angle)) < 0.001 ? "middle" : (Math.sin(angle) > 0 ? "hanging" : "auto"));
      text.style.fontSize = `${config.axis_label_font_size}px`;
      text.setAttribute("fill", config.axis_label_color[0]);
      text.textContent = d.axis;
      radarGroup.appendChild(text);

      // Value labels on axes (optional)
      if (config.show_value_labels) {
        for (let j = 1; j <= levels; j++) {
          const valueLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
          const valueText = (maxValue / levels * j).toFixed(config.value_decimal_places);
          const valueLabelRadius = scaleRadius(maxValue / levels * j);
          
          valueLabel.setAttribute("x", valueLabelRadius * Math.cos(angle));
          valueLabel.setAttribute("y", valueLabelRadius * Math.sin(angle));
          valueLabel.setAttribute("text-anchor", Math.abs(Math.cos(angle)) < 0.001 ? "middle" : (Math.cos(angle) > 0 ? "start" : "end"));
          valueLabel.setAttribute("dominant-baseline", Math.abs(Math.sin(angle)) < 0.001 ? "middle" : (Math.sin(angle) > 0 ? "hanging" : "auto"));
          valueLabel.style.fontSize = `${config.value_label_font_size}px`;
          valueLabel.setAttribute("fill", config.value_label_color[0]);
          valueLabel.textContent = valueText;
          radarGroup.appendChild(valueLabel);
        }
      }
    });

    // --- Draw Radar Area (Polygon) ---
    let polygonPoints = "";
    radarData.forEach((d, i) => {
      const angle = angleSlice * i - Math.PI / 2;
      const pointX = scaleRadius(d.value) * Math.cos(angle);
      const pointY = scaleRadius(d.value) * Math.sin(angle);
      polygonPoints += `${pointX},${pointY} `;
    });

    const radarArea = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    radarArea.setAttribute("points", polygonPoints.trim());
    radarArea.setAttribute("fill", config.radar_fill_color[0]);
    radarArea.setAttribute("fill-opacity", config.fill_opacity);
    radarArea.setAttribute("stroke", config.radar_stroke_color[0]);
    radarArea.setAttribute("stroke-width", config.stroke_width);
    radarGroup.appendChild(radarArea);

    // --- Draw Data Points (Circles) on Radar Area ---
    radarData.forEach((d, i) => {
      const angle = angleSlice * i - Math.PI / 2;
      const pointX = scaleRadius(d.value) * Math.cos(angle);
      const pointY = scaleRadius(d.value) * Math.sin(angle);

      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", pointX);
      circle.setAttribute("cy", pointY);
      circle.setAttribute("r", 4); // Radius of the dot
      circle.setAttribute("fill", config.radar_stroke_color[0]);
      circle.setAttribute("stroke", "#FFFFFF"); // White border for dot
      circle.setAttribute("stroke-width", 1.5);
      radarGroup.appendChild(circle);
    });
  }
});
