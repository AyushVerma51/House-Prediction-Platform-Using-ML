document.addEventListener("DOMContentLoaded", function () {
  // Get elements
  const propertiesContainer = document.getElementById("properties-container");
  const propertyCount = document.getElementById("property-count");
  const loadingIndicator = document.getElementById("loading-indicator");
  const noResults = document.getElementById("no-results");
  const mapViewBtn = document.getElementById("map-view-btn");
  const listView = document.getElementById("list-view");
  const mapView = document.getElementById("map-view");
  const mapFrame = document.getElementById("mapFrame");
  const sortBtn = document.getElementById("sort-btn");
  const sortOptions = document.getElementById("sort-options");
  const filterBtn = document.getElementById("filter-btn");

  // Initialize properties from server-provided data
  let properties = window.initialProperties || [];

  // Initialize filters
  let currentFilters = {
    cities: [],
    propertyTypes: [],
    bhkOptions: [],
    transactionType: "Buy",
    minBudget: "",
    maxBudget: "",
  };

  // Load saved filters from localStorage
  const savedFilters = localStorage.getItem("propertyFilters");
  if (savedFilters) {
    try {
      const parsedFilters = JSON.parse(savedFilters);
      currentFilters = {
        ...parsedFilters,
        cities: Array.isArray(parsedFilters.cities) ? parsedFilters.cities : [],
        propertyTypes: Array.isArray(parsedFilters.propertyTypes)
          ? parsedFilters.propertyTypes
          : [],
        bhkOptions: Array.isArray(parsedFilters.bhkOptions)
          ? parsedFilters.bhkOptions
          : [],
      };
      console.log("Loaded filters from localStorage:", currentFilters);
    } catch (e) {
      console.error("Error parsing saved filters:", e);
    }
  }

  // If we have server-provided filter state, use it
  if (window.filterState && Object.keys(window.filterState).length > 0) {
    currentFilters = {
      ...window.filterState,
      cities: Array.isArray(window.filterState.cities)
        ? window.filterState.cities
        : [],
      propertyTypes: Array.isArray(window.filterState.property_types)
        ? window.filterState.property_types
        : [],
      bhkOptions: Array.isArray(window.filterState.bhk_options)
        ? window.filterState.bhk_options
        : [],
    };
    console.log("Using server-provided filter state:", currentFilters);
  }

  let currentSort = "price-asc"; // Default sort

  // Set up event listeners
  setupEventListeners();

  // Initial load of properties
  if (properties.length === 0) {
    loadProperties();
  } else {
    console.log("Using initial properties:", properties);
    renderProperties(properties);
  }

  function setupEventListeners() {
    // Filter button click
    filterBtn.addEventListener("click", function () {
      window.location.href = "/filters";
    });

    // Map view toggle
    mapViewBtn.addEventListener("click", function () {
      toggleMapView();
    });

    // Sort button click
    sortBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      sortOptions.style.display =
        sortOptions.style.display === "block" ? "none" : "block";
    });

    // Sort options
    document.querySelectorAll(".sort-option").forEach((option) => {
      option.addEventListener("click", function () {
        const sortValue = this.dataset.sort;
        currentSort = sortValue;
        sortProperties(sortValue);
        sortOptions.style.display = "none";

        // Update sort button text
        let sortText = "Sort By";
        if (sortValue === "price-asc") sortText = "Price: Low to High";
        if (sortValue === "price-desc") sortText = "Price: High to Low";
        if (sortValue === "area-asc") sortText = "Area: Small to Large";
        if (sortValue === "area-desc") sortText = "Area: Large to Small";

        sortBtn.innerHTML = `<i class="fas fa-sort"></i> ${sortText}`;
      });
    });

    // Close sort dropdown when clicking outside
    document.addEventListener("click", function () {
      sortOptions.style.display = "none";
    });
  }

  async function loadProperties() {
    console.log("Starting property load process...");

    // Clear cities array before loading properties
    currentFilters.cities = [];
    // Save the cleared filters to localStorage
    localStorage.setItem("propertyFilters", JSON.stringify(currentFilters));

    // Show loading state
    if (propertiesContainer) {
      propertiesContainer.innerHTML =
        '<div class="loading">Loading properties...</div>';
    }

    // Log current filter state
    console.log("Current filters:", {
      cities: currentFilters.cities,
      propertyTypes: currentFilters.propertyTypes,
      bhkOptions: currentFilters.bhkOptions,
      transactionType: currentFilters.transactionType,
      budgetRange: {
        min: parseFloat(currentFilters.minBudget),
        max: parseFloat(currentFilters.maxBudget),
      },
    });

    try {
      const response = await fetch("/api/filter-properties", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cities: currentFilters.cities,
          property_types: currentFilters.propertyTypes,
          bhk_options: currentFilters.bhkOptions,
          transaction_types: [currentFilters.transactionType],
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Received data from server:", data);

      if (!data.properties || data.properties.length === 0) {
        console.log("No properties found");
        if (propertiesContainer) {
          propertiesContainer.innerHTML = `
                    <div class="no-results">
                        <h3>No properties found</h3>
                        <p>Try adjusting your filters to see more properties.</p>
                    </div>
                `;
        }
        return;
      }

      // Store properties globally
      properties = data.properties;
      console.log(`Found ${properties.length} properties`);

      // Update property count
      const propertyCount = document.getElementById("property-count");
      if (propertyCount) {
        propertyCount.textContent = `${properties.length} Properties Found`;
      }

      // Render properties
      renderProperties(properties);

      // Update map if in map view
      if (document.getElementById("map-view").style.display !== "none") {
        sendPropertiesToMap();
      }
    } catch (error) {
      console.error("Error loading properties:", error);
      if (propertiesContainer) {
        propertiesContainer.innerHTML = `
                <div class="error">
                    <h3>Error loading properties</h3>
                    <p>Please try again later.</p>
                </div>
            `;
      }
    }
  }

  function showNoPropertiesMessage() {
    const container = document.getElementById("property-container");
    if (container) {
      container.innerHTML = `
        <div class="no-properties-message">
          <h3>No properties found</h3>
          <p>Try adjusting your filters to see more properties.</p>
        </div>
      `;
    }
  }

  function showErrorMessage(message) {
    const container = document.getElementById("property-container");
    if (container) {
      container.innerHTML = `
        <div class="error-message">
          <h3>Error</h3>
          <p>${message}</p>
        </div>
      `;
    }
  }

  function showProgressIndicator(total) {
    const progressContainer = document.createElement("div");
    progressContainer.id = "progress-indicator";
    progressContainer.innerHTML = `
      <div class="progress-content">
        <div class="progress-bar">
          <div class="progress-fill"></div>
        </div>
        <div class="progress-text">Processing properties: <span class="progress-count">0</span>/${total}</div>
      </div>
    `;
    document.body.appendChild(progressContainer);
    return progressContainer;
  }

  function updateProgress(current, total, message) {
    const progressIndicator = document.getElementById("progress-indicator");
    if (!progressIndicator) return;

    const progressFill = progressIndicator.querySelector(".progress-fill");
    const progressCount = progressIndicator.querySelector(".progress-count");

    const percentage = (current / total) * 100;
    progressFill.style.width = `${percentage}%`;
    progressCount.textContent = current;

    if (current >= total) {
      setTimeout(() => {
        progressIndicator.remove();
      }, 1000);
    }

    const progressText = progressIndicator.querySelector(".progress-text");
    if (progressText) {
      progressText.textContent =
        message || `Processing properties (${current}/${total})`;
    }
  }

  async function handlePredictedProperties(properties) {
    console.log("Processing properties for prediction...");

    const progressIndicator = showProgressIndicator(properties.length);
    const filteredProperties = [];
    let processed = 0;

    for (const property of properties) {
      try {
        // Process property prediction
        const predictionData = {
          area: property.area,
          location: property.location,
          bedrooms: property.bedrooms,
          property_type: property.property_type,
        };

        console.log("Prediction data:", predictionData);

        const response = await fetch("/api/predict", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(predictionData),
        });

        if (!response.ok) {
          console.error("Prediction failed for property:", property);
          continue;
        }

        const prediction = await response.json();
        property.predictedPrice = prediction.predicted_price;

        // Apply budget filter
        const minBudget =
          parseFloat(document.getElementById("min-budget").value) * 100000;
        const maxBudget =
          parseFloat(document.getElementById("max-budget").value) * 100000;

        if (
          property.predictedPrice >= minBudget &&
          property.predictedPrice <= maxBudget
        ) {
          filteredProperties.push(property);
        }

        processed++;
        updateProgress(
          processed,
          properties.length,
          `Processing properties (${processed}/${properties.length})`
        );
      } catch (error) {
        console.error("Error processing property:", error);
        processed++;
        updateProgress(
          processed,
          properties.length,
          `Processing properties (${processed}/${properties.length})`
        );
      }
    }

    console.log("Filtered properties:", filteredProperties);

    if (filteredProperties.length === 0) {
      showNoPropertiesMessage();
    } else {
      displayProperties(filteredProperties);
    }
  }

  function displayProperties(properties) {
    const container = document.querySelector(".property-cards");
    if (!container) return;

    // Update property count
    const countElement = document.querySelector(".property-count");
    if (countElement) {
      countElement.textContent = `(${properties.length})`;
    }

    // Clear existing properties
    container.innerHTML = "";

    // Sort properties if needed
    if (window.currentSort) {
      properties.sort((a, b) => {
        const priceA = a.predictedPrice || 0;
        const priceB = b.predictedPrice || 0;
        return window.currentSort === "asc" ? priceA - priceB : priceB - priceA;
      });
    }

    // Create and append property cards
    properties.forEach((property) => {
      const card = document.createElement("div");
      card.className = "property-card";

      const price = property.predictedPrice
        ? new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 0,
          }).format(property.predictedPrice)
        : "Price on request";

      card.innerHTML = `
        <div class="property-image">
          <img src="${
            property.image_url || "static/images/placeholder.jpg"
          }" alt="${
        property.title || "Property"
      }" onerror="this.src='static/images/placeholder.jpg'">
        </div>
        <div class="property-details">
          <h3>${property.title || "Untitled Property"}</h3>
          <p class="location">${
            property.location || "Location not specified"
          }</p>
          <p class="price">${price}</p>
          <div class="property-features">
            <span>${property.bedrooms || "N/A"} BHK</span>
            <span>${property.property_type || "Residential"}</span>
            <span>${property.area || "N/A"} sq.ft</span>
          </div>
        </div>
      `;

      // Add click handler for property details
      card.addEventListener("click", () => {
        showPropertyDetails(property);
      });

      container.appendChild(card);
    });

    // Update map if available
    if (typeof updateMap === "function") {
      updateMap(properties);
    }
  }

  function showPropertyDetails(property) {
    // Create modal for property details
    const modal = document.createElement("div");
    modal.className = "property-modal";
    modal.innerHTML = `
      <div class="modal-content">
        <span class="close">&times;</span>
        <div class="property-details-full">
          <img src="${
            property.image_url || "static/images/placeholder.jpg"
          }" alt="${
      property.title || "Property"
    }" onerror="this.src='static/images/placeholder.jpg'">
          <h2>${property.title || "Untitled Property"}</h2>
          <p class="price">${new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 0,
          }).format(property.predictedPrice)}</p>
          <div class="details-grid">
            <div class="detail-item">
              <span class="label">Location</span>
              <span class="value">${property.location || "Not specified"}</span>
            </div>
            <div class="detail-item">
              <span class="label">Property Type</span>
              <span class="value">${
                property.property_type || "Not specified"
              }</span>
            </div>
            <div class="detail-item">
              <span class="label">BHK</span>
              <span class="value">${property.bedrooms || "N/A"}</span>
            </div>
            <div class="detail-item">
              <span class="label">Area</span>
              <span class="value">${property.area || "N/A"} sq.ft</span>
            </div>
          </div>
          ${
            property.description
              ? `<p class="description">${property.description}</p>`
              : ""
          }
        </div>
      </div>
    `;

    // Add close functionality
    modal.querySelector(".close").addEventListener("click", () => {
      document.body.removeChild(modal);
    });

    // Close on outside click
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    });

    document.body.appendChild(modal);
  }

  function renderProperties(propertiesList) {
    console.log("Rendering properties:", propertiesList);

    const propertiesContainer = document.getElementById("properties-container");
    if (!propertiesContainer) {
      console.error("Properties container not found!");
      return;
    }

    // Clear properties container
    propertiesContainer.innerHTML = "";

    if (!propertiesList || propertiesList.length === 0) {
      propertiesContainer.innerHTML = `
            <div class="no-results">
                <h3>No properties found</h3>
                <p>Try adjusting your filters to see more properties.</p>
            </div>
        `;
      return;
    }

    // Create and append property cards
    propertiesList.forEach((property) => {
      console.log("Creating card for property:", property);
      const card = createPropertyCard(property);
      propertiesContainer.appendChild(card);
    });
  }

  function createPropertyCard(property) {
    const card = document.createElement("div");
    card.className = "property-card";

    // Format price from the CSV data
    const formattedPrice = formatPrice(property.price);

    // Create property status badges
    const statusBadges = [];
    if (property.ready_to_move)
      statusBadges.push(
        '<span class="status-badge ready">Ready to Move</span>'
      );
    if (property.under_construction)
      statusBadges.push(
        '<span class="status-badge construction">Under Construction</span>'
      );
    if (property.resale)
      statusBadges.push('<span class="status-badge resale">Resale</span>');
    if (property.rera)
      statusBadges.push('<span class="status-badge rera">RERA</span>');

    card.innerHTML = `
        <div class="property-image">
            <div class="property-image-placeholder">
                <i class="fas fa-home"></i>
            </div>
            <button class="property-favorite">
                <i class="far fa-heart"></i>
            </button>
            <div class="property-badges">
                ${statusBadges.join("")}
            </div>
        </div>
        <div class="property-details">
            <div class="property-price">
                ₹ ${formattedPrice}
            </div>
            <div class="property-address">${
              property.address || "Location not specified"
            }</div>
            <div class="property-location">${property.city || ""}</div>
            <div class="property-specs">
                <div class="spec-item">
                    <div class="spec-value">${property.bhk_no || "N/A"}</div>
                    <div class="spec-label">BHK</div>
                </div>
                <div class="spec-item">
                    <div class="spec-value">${
                      property.square_ft
                        ? Math.round(property.square_ft)
                        : "N/A"
                    }</div>
                    <div class="spec-label">Sq.ft</div>
                </div>
                <div class="spec-item">
                    <div class="spec-value">${
                      property.posted_by === 1
                        ? "Dealer"
                        : property.posted_by === 2
                        ? "Owner"
                        : "Builder"
                    }</div>
                    <div class="spec-label">Posted By</div>
                </div>
            </div>
        </div>
    `;

    // Add click event to show property details
    card.addEventListener("click", function () {
      showPropertyDetails(property);
    });

    // Handle favorite button
    const favoriteBtn = card.querySelector(".property-favorite");
    favoriteBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      this.innerHTML = this.innerHTML.includes("far")
        ? '<i class="fas fa-heart" style="color: #ff4a9e;"></i>'
        : '<i class="far fa-heart"></i>';
    });

    return card;
  }

  function formatPrice(price) {
    // If price is undefined, null, NaN, or otherwise invalid
    if (price === null || price === undefined || isNaN(parseFloat(price))) {
      return "Price not available";
    }

    // Convert price to number if it's a string
    const numPrice = typeof price === "string" ? parseFloat(price) : price;

    // Format according to Indian currency system
    if (numPrice >= 10000000) {
      // 1 crore or more
      return (numPrice / 10000000).toFixed(2) + " Cr";
    } else if (numPrice >= 100000) {
      // 1 lakh or more
      return (numPrice / 100000).toFixed(2) + " Lac";
    } else {
      // For prices less than 1 lakh, format as regular number
      return new Intl.NumberFormat("en-IN").format(numPrice);
    }
  }

  function sortProperties(sortType) {
    if (!properties || properties.length === 0) return;

    let sortedProperties = [...properties];

    switch (sortType) {
      case "price-asc":
        sortedProperties.sort((a, b) => {
          const priceA = a.price || 0;
          const priceB = b.price || 0;
          return priceA - priceB;
        });
        break;
      case "price-desc":
        sortedProperties.sort((a, b) => {
          const priceA = a.price || 0;
          const priceB = b.price || 0;
          return priceB - priceA;
        });
        break;
      case "area-asc":
        sortedProperties.sort((a, b) => {
          const areaA = a.square_ft ? parseFloat(a.square_ft) : 0;
          const areaB = b.square_ft ? parseFloat(b.square_ft) : 0;
          return areaA - areaB;
        });
        break;
      case "area-desc":
        sortedProperties.sort((a, b) => {
          const areaA = a.square_ft ? parseFloat(a.square_ft) : 0;
          const areaB = b.square_ft ? parseFloat(b.square_ft) : 0;
          return areaB - areaA;
        });
        break;
    }

    renderProperties(sortedProperties);
  }

  function toggleMapView() {
    if (listView.style.display !== "none") {
      // Switch to map view
      listView.style.display = "none";
      mapView.style.display = "block";
      mapViewBtn.innerHTML = '<i class="fas fa-list"></i> List View';

      // Send properties to map if not already done
      sendPropertiesToMap();
    } else {
      // Switch to list view
      mapView.style.display = "none";
      listView.style.display = "block";
      mapViewBtn.innerHTML = '<i class="fas fa-map-marked-alt"></i> Map View';
    }
  }

  function sendPropertiesToMap() {
    // Wait for iframe to load
    mapFrame.onload = function () {
      // Send properties to map
      mapFrame.contentWindow.postMessage(
        {
          type: "updateProperties",
          properties: properties,
        },
        "*"
      );
    };

    // If iframe is already loaded, send properties immediately
    if (mapFrame.contentDocument.readyState === "complete") {
      mapFrame.contentWindow.postMessage(
        {
          type: "updateProperties",
          properties: properties,
        },
        "*"
      );
    }
  }

  // Add CSS styles for loading and error states
  const style = document.createElement("style");
  style.textContent = `
      .loading {
          text-align: center;
          padding: 20px;
          font-size: 18px;
          color: #666;
      }
      .error {
          text-align: center;
          padding: 20px;
          color: #dc3545;
      }
      .no-results {
          text-align: center;
          padding: 20px;
          color: #666;
      }
      #properties-container {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 20px;
          padding: 20px;
      }
  `;
  document.head.appendChild(style);
});
