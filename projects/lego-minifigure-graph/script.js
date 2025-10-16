// CHAPTER 1: INITIALIZE DYNAMIC VARIABLES
let selectedFig = null;
let selectedNode = null;
let activeFilter = null;
let searchBox = null;
let selectedAssociate = null;

// CHAPTER 2: LOAD DATA
fetch("data/lego_starwars_graph_v2.json") //fetch returns a response object 
  .then((res) => {
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return res.json();
  })
  .then((graphData) => {

// --- LOAD STUD MODEL ---
    let studModel = null;
    let graphInitialized = false;

    // Show loading indicator
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'loading-indicator';
    loadingDiv.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 20px 40px;
      border-radius: 8px;
      font-family: 'Open Sans', sans-serif;
      font-size: 16px;
      z-index: 1000;
      text-align: center;
    `;
    loadingDiv.innerHTML = `
      <div style="margin-bottom: 10px;">Loading LEGO Minifigure Network...</div>
      <div style="font-size: 14px; color: #ccc;">Preparing 3D models and data</div>
    `;
    document.body.appendChild(loadingDiv);

    const objLoader = new THREE.OBJLoader();
    objLoader.load(
    "models/stud2.obj",
    (obj) => {
        studModel = obj;
        console.log("Stud model loaded successfully");
        
        // Initialize graph only after stud model is loaded
        if (!graphInitialized) {
            initializeGraph(graphData);
            graphInitialized = true;
            
            // Remove loading indicator
            if (loadingDiv.parentNode) {
                loadingDiv.parentNode.removeChild(loadingDiv);
            }
        }
    },
    undefined,
    (err) => {
        console.error("Error loading stud.obj", err);
        // Still initialize graph even if stud model fails
        if (!graphInitialized) {
            initializeGraph(graphData);
            graphInitialized = true;
            
            // Remove loading indicator
            if (loadingDiv.parentNode) {
                loadingDiv.parentNode.removeChild(loadingDiv);
            }
        }
    }
    );

    // Function to initialize the graph (moved from main flow)
    function initializeGraph(graphData) {

    searchBox = document.getElementById("search-box");

    let radius = Math.min(window.innerWidth, window.innerHeight) * 0.45;
    let cameraDistance = Math.min(window.innerWidth, window.innerHeight) * 1.4;

    //

    //CHAPTER : CREATE GRAPH FUNCTIONS

    //PLACES THE NODES ON A SPHERE

    function layoutNodes() {
      graphData.nodes.forEach((n, i) => {
        const phi = Math.acos(-1 + (2 * i) / graphData.nodes.length);
        const theta = Math.sqrt(graphData.nodes.length * Math.PI) * phi;
        n.x = radius * Math.cos(theta) * Math.sin(phi);
        n.y = radius * Math.sin(theta) * Math.sin(phi);
        n.z = radius * Math.cos(phi);
      });
      Graph.graphData(graphData); 
    }

    //FUNCTION THAT RESETS THE GRAPH
    function resetGraph(graphData) {
      selectedNode = null;
      selectedFig = null;
      activeFilter = null;
      selectedAssociate = null;

      // Hide selected minifigure overlay
      const overlay = document.getElementById("selected-minifig-overlay");
      overlay.style.display = "none";

      if (searchBox) searchBox.value = "";
      d3.select("#set-list-panel").html("");

      if (typeof renderMinifigChart === "function") {
        renderMinifigChart(graphData.nodes);
      }

      applyStyle("default");
      Graph.refresh();
      renderBarChart(null, graphData);
    }


    //LOADS THE DEFAULT STYLE

    function applyStyle(mode = "default", node = null, associate = null) {
      const isSelected = mode === "nodeSelected" && node;

      // Find connected node IDs for filtering
      const connectedIds = isSelected
        ? new Set(
            graphData.links
              .filter(l => l.source.id === node.id || l.target.id === node.id)
              .flatMap(l => [l.source.id, l.target.id])
          )
        : new Set();

      // Pre-calculate node states once for all nodes
      const nodeStates = new Map();
      graphData.nodes.forEach(n => {
        const isInNetwork = connectedIds.has(n.id) || n.id === node?.id;
        const isSelectedNode = n.id === node?.id;
        const isAssociate = associate && n.label === associate;
        const visible = !isSelected || isInNetwork;
        
        nodeStates.set(n.id, {
          isInNetwork,
          isSelectedNode,
          isAssociate,
          visible
        });
      });

      Graph
        .linkColor(l => {
          if (!isSelected) return 0xF4F4F4;

          const sourceState = nodeStates.get(l.source.id);
          const targetState = nodeStates.get(l.target.id);

          // Check if this is an associate link
          if (associate && (
            (sourceState?.isSelectedNode && targetState?.isAssociate) ||
            (targetState?.isSelectedNode && sourceState?.isAssociate)
          )) return "deepskyblue"; 

          // Check if this is a network link
          if (sourceState?.isSelectedNode || targetState?.isSelectedNode)
            return "limegreen"; 

          return "#000000"; 
        })
        .linkWidth(l => {
          if (!isSelected) return 0.5;
          
          const sourceState = nodeStates.get(l.source.id);
          const targetState = nodeStates.get(l.target.id);
          
          return (sourceState?.isSelectedNode || targetState?.isSelectedNode) ? 2 : 0.1;
        })
        .linkOpacity(isSelected ? 0.2 : 0.2)
        .nodeThreeObject(n => {

          if (!studModel) {
            return null;
          }

          const group = new THREE.Group();
          const scale = Math.sqrt(n.size) * 0.8;
          const stud = studModel.clone(true);
          stud.scale.set(scale, scale, scale);

          // Get pre-calculated node state
          const state = nodeStates.get(n.id);
          const { isInNetwork, isSelectedNode, isAssociate, visible } = state;
          
          let baseColor;
          if (isAssociate) {
            baseColor = 0x00BFFF; // deepskyblue
          } else if (isSelectedNode) {
            baseColor = 0x32CD32; // limegreen
          } else if (isSelected) {
            baseColor = isInNetwork ? 0xF4F4F4 : 0x0;
          } else {
            baseColor = 0xF4F4F4;
          }

          stud.traverse(child => {
            if (child.isMesh) {
              child.material = new THREE.MeshStandardMaterial({
                color: baseColor,
                roughness: 0.4,
                metalness: 0.5,
                transparent: true,
                opacity: visible ? 1.0 : 0.2
              });
            }
          });

          group.add(stud);

          // Add text label based on mode and conditions
          const shouldShowLabel = isSelected 
            ? isInNetwork  // In selected mode: show labels for all nodes in network
            : n.size >= 10; // In default mode: show labels only for nodes with 10+ appearances
            
          if (shouldShowLabel) {
            
            // Create text sprite using canvas
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = 512;
            canvas.height = 128;
            
            // Make text more visible
            context.fillStyle = 'white';
            context.strokeStyle = 'black';
            context.lineWidth = 3;
            context.font = 'bold 32px Arial'; 
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            
            // Draw text with stroke for better visibility
            context.strokeText(n.label, 256, 64);
            context.fillText(n.label, 256, 64);
            
            const texture = new THREE.CanvasTexture(canvas);
            const spriteMaterial = new THREE.SpriteMaterial({ 
              map: texture,
              transparent: true,
              alphaTest: 0.1
            });
            const sprite = new THREE.Sprite(spriteMaterial);
          
            sprite.scale.set(200, 50, 1);
            sprite.position.set(0, scale * 5, 0);
            
            group.add(sprite);
          }

          return group;
        });

      Graph.refresh();
    }



    //CHAPTER : INITIALIZE THE GRAPH
    const Graph = ForceGraph3D()(document.getElementById("3d-graph"))
      .graphData(graphData);

    applyStyle("default");

    Graph.scene().children
    .filter((c) => c.isLight)
    .forEach((l) => Graph.scene().remove(l));

    // Add a balanced three-point lighting setup
    const keyLight = new THREE.DirectionalLight(0xffffff, 0.9);
    keyLight.position.set(5, 10, 8);
    Graph.scene().add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
    fillLight.position.set(-8, 4, -6);
    Graph.scene().add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 0.3);
    rimLight.position.set(0, -5, -10);
    Graph.scene().add(rimLight);

    Graph.scene().add(new THREE.AmbientLight(0x000000, 0.0));



    // CHAPTER : DISABLE PHYSICS
    Graph.d3Force("charge", null);
    Graph.d3Force("center", null);
    Graph.d3Force("link").distance(500).strength(0); //change strength to 0 to force sphere


    // CHAPTER X: ROTATE THE SPHERE
    let angle = 0;
    let rotating = true;
    let animationId = null;
    
    function rotate() {
        if (rotating) {
            angle += Math.PI / 7000; //adjust speed of rotation
            const y = Graph.cameraPosition().y;
            Graph.cameraPosition({
            x: cameraDistance * Math.sin(angle),
            z: cameraDistance * Math.cos(angle),
            y,
            });
            animationId = requestAnimationFrame(rotate);
        }
    }
    
    rotate(); // Start the animation

    // Make each node slowly rotate on its own axis
    let studAnimationId = null;
    function animateStuds() {
        Graph.scene().traverse((obj) => {
            if (obj.isMesh && obj.name === "stud") {
                obj.rotation.y += 0.005; // slow spin
                obj.rotation.x += 0.0005; // subtle wobble
            }
        });
        studAnimationId = requestAnimationFrame(animateStuds);
    }
    animateStuds();

    //ADD SECTION TO ADJUST SIZE


    //INITIAL LAYOUT
    layoutNodes();

    renderMinifigChart(graphData.nodes);
    renderBarChart(null, graphData); // Show welcome text on initial load

    //TOGGLE PLAY PAUSE BUTTON
    document.getElementById("toggle-rotate").addEventListener("click", () => {
        rotating = !rotating;
        if (rotating) {
            rotate(); // Restart rotation if it was stopped
        } else {
            if (animationId) {
                cancelAnimationFrame(animationId);
                animationId = null;
            }
        }
    });

    //RESET BUTTON
    document.getElementById("reset-button").addEventListener("click", () => {
        resetGraph(graphData);
    });

    //ZOOM SLIDER
    const zoomSlider = document.getElementById("zoom-slider");
    zoomSlider.addEventListener("input", (e) => {
        // Invert the zoom: higher slider values = closer camera (lower distance)
        const zoomValue = parseFloat(e.target.value);
        const invertedZoom = 3.5 - zoomValue; 
        cameraDistance = Math.min(window.innerWidth, window.innerHeight) * invertedZoom;
        
        // Update camera position immediately regardless of rotation state
        const currentPos = Graph.cameraPosition();
        const y = currentPos.y;
        
        if (rotating) {
            // If rotating, use the calculated angle
            Graph.cameraPosition({
                x: cameraDistance * Math.sin(angle),
                z: cameraDistance * Math.cos(angle),
                y,
            });
        } else {
            // If not rotating, maintain current angle but update distance
            const currentAngle = Math.atan2(currentPos.x, currentPos.z);
            Graph.cameraPosition({
                x: cameraDistance * Math.sin(currentAngle),
                z: cameraDistance * Math.cos(currentAngle),
                y,
            });
        }
    });

    // --- Graph interactivity ---

    function updateHighlight(node, graphData) {
      selectedNode = node;
      selectedAssociate = null; // reset any right-panel selection
      selectedFig = node.label;

      // Show selected minifigure overlay
      const overlay = document.getElementById("selected-minifig-overlay");
      const nameElement = document.getElementById("selected-minifig-name");
      overlay.style.display = "flex";
      nameElement.textContent = node.label;

      d3.select("#associate-chart").selectAll("rect").attr("fill", "white");
      d3.select("#set-list-panel").html("");

      if (searchBox) searchBox.value = node.label;

      renderMinifigChart(graphData.nodes);

      const connected = new Set(
        graphData.links
          .filter((l) => l.source.id === node.id || l.target.id === node.id)
          .flatMap((l) => [l.source.id, l.target.id])
      );
      connected.add(node.id);

      applyStyle("nodeSelected", node, selectedAssociate);

      // --- Populate set list panel ---
      const listPanel = d3.select("#set-list-panel");
       
      const figSets = graphData.links
        .filter((l) => l.source.id === node.id || l.target.id === node.id)
        .flatMap((l) => l.sets);

      const uniqueSets = Array.from(
        new Map(figSets.map((s) => [s.set_number, s])).values()
      );

      const groupedByYear = d3.group(uniqueSets, (d) => d.set_year);
      const sortedYears = Array.from(groupedByYear.keys()).sort((a, b) => b - a);

      listPanel.html("");
      
      // Add title and subheading
      listPanel
        .append("h3")
        .text("Sets")
        .style("margin", "0 0 8px 0")
        .style("color", "white")
        .style("font-size", "16px")
        .style("font-weight", "bold")
        .style("text-align", "left");
        
      listPanel
        .append("p")
        .text("Click the set name to open it in Rebrickable")
        .style("margin", "0 0 12px 0")
        .style("color", "#ccc")
        .style("font-size", "12px")
        .style("text-align", "left")
        .style("font-style", "italic");
      
      sortedYears.forEach((year) => {
        const yearGroup = groupedByYear.get(year);

        listPanel
          .append("h4")
          .text(year)
          .style("margin", "6px 0 2px 0")
          .style("color", "white")
          .style("padding-left", "14px")
          .style("font-size", "14px")
          .style("font-weight", "bold");

        const ul = listPanel
          .append("ul")
          .style("margin", "0 0 8px 0")
          .style("padding-left", "28px");

        yearGroup.forEach((s) => {
          ul.append("li")
            .attr("data-set-number", s.set_number)
            .style("font-size", "12px")
            .style("color", "white")
            .html(
              `<a href="https://rebrickable.com/sets/${s.set_number}" target="_blank" style="color: inherit; text-decoration: none;">${s.set_name}</a>`
            );
          });
        });

      Graph.refresh();

      // --- Filter left panel to this node ---
      selectedFig = node.label;
      if (searchBox) searchBox.value = node.label;

      // Trigger the same filtering behavior as search
      if (typeof renderMinifigChart === "function") {
        renderMinifigChart(
          graphData.nodes.filter(
            (m) => m.label.toLowerCase() === node.label.toLowerCase()
          )
        );
      }
      // update right chart
      renderBarChart(node, graphData);
    }

    //BAR CHART LEFT PANEL +
    function renderMinifigChart(data) {
      let filteredData = data;

      function reapplyHighlight() {
        container
          .selectAll("rect.minifig-bar")
          .attr("fill", (d) =>
            d.label === selectedFig ? "limegreen" : "white"
          );
      }

      const container = d3.select("#minifig-table");

      function draw(pageData) {
        container.html("");

        const width = 280,
          barHeight = 12,
          gap = 40;
        const height = pageData.length * gap;

        pageData = [...pageData].sort((a, b) => b.size - a.size);

        const svg = container
          .append("svg")
          .attr("width", width)
          .attr("height", height);

        const x = d3
          .scaleLinear()
          .domain([0, d3.max(pageData, (d) => d.size)])
          .range([0, width - 80]);

        const g = svg
          .selectAll("g.row")
          .data(pageData)
          .enter()
          .append("g")
          .attr("class", "row")
          .attr("transform", (d, i) => `translate(10, ${i * gap})`)
          .style("cursor", "pointer");

        // Minifig name
        g.append("text")
          .attr("x", 0)
          .attr("y", 35)
          .attr("fill", "white")
          .attr("font-size", "11px")
          .text((d) => d.label);

        // Bar
        g.append("rect")
          .attr("class", "minifig-bar")
          .attr("x", 0)
          .attr("y", 6)
          .attr("rx", 5)
          .attr("ry", 5)
          .attr("width", (d) => x(d.size))
          .attr("height", barHeight)
          .attr("fill", (d) =>
            d.label === selectedFig ? "limegreen" : "white"
          )
          .on("click", (event, d) => {
            event.stopPropagation();

            // Toggle off if clicking same bar again
            if (activeFilter === d.label) {
              resetGraph(graphData);
              return;
            }

          

            selectedFig = d.label;
            activeFilter = d.label;

            // Highlight node and update right panel
            if (window.highlightNode) window.highlightNode(d.label);
            if (window.renderBarChart) window.renderBarChart(d, graphData);


      const listPanel = d3.select("#set-list-panel");
       
     
      const figSets = graphData.links
        .filter((l) => l.source.id === d.label || l.target.id === d.label)
        .flatMap((l) => l.sets);

      const uniqueSets = Array.from(
        new Map(figSets.map((s) => [s.set_number, s])).values()
      );

      const groupedByYear = d3.group(uniqueSets, (d) => d.set_year);
      const sortedYears = Array.from(groupedByYear.keys()).sort((a, b) => b - a);

      listPanel.html("");
      
      // Add title and subheading
      listPanel
        .append("h3")
        .text("Sets")
        .style("margin", "0 0 8px 0")
        .style("color", "white")
        .style("font-size", "16px")
        .style("font-weight", "bold")
        .style("text-align", "left");
        
      listPanel
        .append("p")
        .text("Click the set name to open it in Rebrickable")
        .style("margin", "0 0 12px 0")
        .style("color", "#ccc")
        .style("font-size", "12px")
        .style("text-align", "left")
        .style("font-style", "italic");
      
      sortedYears.forEach((year) => {
        const yearGroup = groupedByYear.get(year);

        listPanel
          .append("h4")
          .text(year)
          .style("margin", "6px 0 2px 0")
          .style("color", "white")
          .style("padding-left", "14px")
          .style("font-size", "14px")
          .style("font-weight", "bold");

        const ul = listPanel
          .append("ul")
          .style("margin", "0 0 8px 0")
          .style("padding-left", "28px");

        yearGroup.forEach((s) => {
          ul.append("li")
            .attr("data-set-number", s.set_number)
            .style("font-size", "12px")
            .style("color", "white")
            .html(
              `<a href="https://rebrickable.com/sets/${s.set_number}" target="_blank" style="color: inherit; text-decoration: none;">${s.set_name}</a>`
            );
          });
        });

        // Filter left panel to this fig
        filteredData = data.filter(
          (m) => m.label.toLowerCase() === d.label.toLowerCase()
        );
          
        draw(filteredData);
        reapplyHighlight();

        // Update search box
        if (searchBox) searchBox.value = d.label;

          });


        // Value
        g.append("text")
          .attr("x", (d) => x(d.size) + 4)
          .attr("y", barHeight / 2 + 6)
          .attr("alignment-baseline", "middle")
          .attr("fill", "white")
          .attr("font-size", "11px")
          .text((d) => d.size);

      }

      // Search input
      // Search input with reset-on-empty

      d3.select(searchBox).on("input", function () {
        const term = this.value.toLowerCase();

        // Clear set list panel immediately when user starts typing
        d3.select("#set-list-panel").html("");

        if (term === "") {
          resetGraph(graphData);
          return;
        }

        // always start from the full dataset, not filteredData
        const baseData = graphData.nodes;  
        filteredData = baseData.filter(d => d.label.toLowerCase().includes(term));

        draw(filteredData);
        reapplyHighlight();
      });

      

      draw(filteredData);
      reapplyHighlight();
    }
    //BAR CHART LEFT PANEL -

    // BAR CHART RIGHT PANEL
    function renderBarChart(node, graphData) {
      const container = d3.select("#associate-chart");
      container.html("");
      
      // Update the title based on content
      const titleElement = document.getElementById("Assoc");
      if (!node) {
        // Show welcome text in default state
        titleElement.textContent = "How to Explore";
        container.append("div")
          .attr("class", "welcome-text")
          .html(`
            <p>Welcome to a galaxy of Star Wars minifigures. The rotating orb in the center represents a constellation of Star Wars minifigures that have appeared in Lego sets since they were first introduced in 1999.</p>
            
            <p>Each minifigure is represented by a 1 x 1 round plate piece, its size determined by the number of sets that character has made an appearance in. The more common characters are labeled.</p>
            
            <p>The studs are connected by the sets that characters have in common, represented as lines throughout the network.</p>
            
            <p>To see a subnetwork for a particular character, just search the minifigure using the search box on the left and select the bar above the name. You can also scroll the list or select a stud in the constellation.</p>
            
            <p>Once selected, the subnetwork will appear in green, the set list will appear below the bar on the left, and a list of all the minifigures that the character has appeared alongside will show in the right-side pane.</p>
            
            <p>You can select a minifigure on the right to highlight that connection as well as to highlight the sets that the two have in common below the minifigure name in the left panel.</p>
            
            <p>Have fun exploring the network. Connect on LinkedIn at <a href="https://www.linkedin.com/in/bballerstein" target="_blank">linkedin.com/in/bballerstein</a> with any questions or suggestions for improvement.</p>
            
            <p><strong>Ben</strong></p>
          `);
        return;
      } else {
        // Show associate chart
        titleElement.textContent = "Top Associates";
      }

      const counts = {};
      graphData.links.forEach((l) => {
        if (l.source.id === node.id || l.target.id === node.id) {
          const other = l.source.id === node.id ? l.target : l.source;
          const shared = l.sets ? l.sets.length : 1;
          counts[other.id] = (counts[other.id] || 0) + shared;
        }
      });

      const data = Object.entries(counts)
        .map(([id, count]) => {
          const n = graphData.nodes.find((n) => n.id === id);
          return { name: n ? n.label : id, value: count };
        })
        .sort((a, b) => b.value - a.value);

      if (data.length === 0) return;

      const width = 260,
        barHeight = 12,
        gap = 35;
      const chartHeight = data.length * gap;
      const margin = { right: 0, left: 20 };

      const svg = container
        .append("svg")
        .attr("width", width)
        .attr("height", chartHeight);

      const x = d3
        .scaleLinear()
        .domain([0, d3.max(data, (d) => d.value)])
        .range([0, width - margin.right - margin.left]);

      const g = svg
        .selectAll("g")
        .data(data)
        .enter()
        .append("g")
        .attr("transform", (d, i) => `translate(${width - margin.right}, ${i * gap})`)
        .style("cursor", "pointer")
        .on("click", (event, d) => {
          if (!selectedNode) return;

          selectedAssociate = d.name;

          // Update 3D graph with associate selection
          applyStyle("nodeSelected", selectedNode, selectedAssociate);
          Graph.refresh();

          // Highlight clicked associate bar
          svg
            .selectAll("rect")
            .transition()
            .duration(200)
            .attr("fill", (bar) =>
              bar.name === selectedAssociate ? "deepskyblue" : "white"
            );

          // Expand the minifig’s "+" if not open
          const toggles = d3.selectAll("#minifig-table .toggle");
          toggles.each(function (td) {
            if (td.label === selectedNode.id) {
              const toggle = d3.select(this);
              if (toggle.text() === "+") toggle.dispatch("click");
            }
          });

          // Highlight shared sets
          highlightCommonSets(selectedNode.id, d.name, graphData);

          // --- Graph highlighting logic ---
          const connected = new Set(
            graphData.links
              .filter(
                (l) =>
                  l.source.id === selectedNode.id ||
                  l.target.id === selectedNode.id
              )
              .flatMap((l) => [l.source.id, l.target.id])
          );
          connected.add(selectedNode.id);

          Graph.linkColor((l) => {
            if (
              (l.source.id === selectedNode.id && l.target.label === d.name) ||
              (l.target.id === selectedNode.id && l.source.label === d.name)
            )
              return "deepskyblue"; // specific link
            if (
              l.source.id === selectedNode.id ||
              l.target.id === selectedNode.id
            )
              return "limegreen"; // other links in network
            return "#181818"; // dim
          }).nodeColor((n) => {
            if (n.id === selectedNode.id) return "limegreen"; // selected minifig
            if (n.label === selectedAssociate) return "deepskyblue"; // associate node
            return connected.has(n.id) ? "white" : "#333333"; // connected vs dimmed
          });

          Graph.refresh();
        });

      g.append("rect")
        .attr("x", (d) => -x(d.value)) 
        .attr("y", 6)
        .attr("rx", 6)
        .attr("ry", 6)
        .attr("width", (d) => x(d.value))
        .attr("height", barHeight)
        .attr("fill", (d) =>
          d.name === selectedAssociate ? "deepskyblue" : "white"
        );

      g.append("text")
        .attr("x", (d) => -x(d.value) - 6) 
        .attr("y", barHeight * 1.25)
        .attr("text-anchor", "end")
        .attr("fill", "white")
        .attr("font-size", "11px")
        .text((d) => d.value);

      g.append("text")
        .attr("x", 0)
        .attr("y", 35)
        .attr("dy", "-0.3em")
        .attr("text-anchor", "end")
        .attr("fill", "white")
        .attr("font-size", "12px")
        .text((d) => d.name);

      g.attr("text-anchor", "end");
    }
    // BAR CHART RIGHT PANEL

    //Legend
    function renderLegend() {
      const container = d3.select("#legend");
      container.html("");
      const width = 260,
        height = 80;
      const svg = container
        .append("svg")
        .attr("width", width)
        .attr("height", height);

      const sizes = [1, 10, 35, 75];
      const g = svg
        .selectAll("g")
        .data(sizes)
        .enter()
        .append("g")
        .attr(
          "transform",
          (d, i) => `translate(${40 + i * 60}, ${height / 2})`
        )
        ;

      g.append("circle")
        .attr("r", (d) => Math.sqrt(d) * 1.5)
        .attr("fill", "lightgray")
        .attr("stroke", "white");

      g.append("text")
        .attr("y", 30)
        .attr("text-anchor", "middle")
        .attr("fill", "white")
        .style("font-size", "12px")
        .text((d) => `${d}`);

      svg
        .append("text")
        .attr("x", 10)
        .attr("y", 15)
        .attr("fill", "white")
        .style("font-size", "12px")
        .text("Node size = # of set appearances");
    }
    renderLegend();

    Graph.onNodeClick((node) => updateHighlight(node, graphData));
    window.highlightNode = (name) => {
      const node = graphData.nodes.find((n) => n.label === name);
      if (node) updateHighlight(node, graphData);
    };

    Graph.onBackgroundClick(() => resetGraph(graphData));

    // Highlights sets shared between two minifigs in limegreen
    function highlightCommonSets(fig1, fig2, graphData) {
      const commonSets = new Set(
        graphData.links
          .filter(
            (l) =>
              (l.source.id === fig1 && l.target.id === fig2) ||
              (l.source.id === fig2 && l.target.id === fig1)
          )
          .flatMap((l) => l.sets.map((s) => s.set_number))
      );

      d3.select("#set-list-panel")
        .selectAll("li")
        .style("color", function () {
          const setNum = d3.select(this).attr("data-set-number");
          return commonSets.has(setNum) ? "deepskyblue" : "lightgray";
        })
        .style("font-weight", function () {
          const setNum = d3.select(this).attr("data-set-number");
          return commonSets.has(setNum) ? "bold" : "normal";
        });
    }
    
    } // End of initializeGraph function
  })
  .catch((error) => {
    console.error('Failed to load graph data:', error);
    // Show user-friendly error message
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #ff4444;
      color: white;
      padding: 10px 20px;
      border-radius: 4px;
      z-index: 1000;
      font-family: 'Open Sans', sans-serif;
    `;
    errorDiv.textContent = "Failed to load the visualization. Please refresh the page.";
    document.body.appendChild(errorDiv);
  }); 