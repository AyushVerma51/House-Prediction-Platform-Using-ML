// Filter functionality

document.addEventListener("DOMContentLoaded", function () {
  // Retrieve existing filters from localStorage or use defaults
  let savedFilters = localStorage.getItem("propertyFilters");
  const selectedFilters = savedFilters
    ? JSON.parse(savedFilters)
    : {
        transactionType: "Buy",
        cities: [], // Empty default cities
        minBudget: "",
        maxBudget: "",
        propertyTypes: ["Flat", "House/Villa"], // Default property types
        bhkOptions: ["2", "3"], // Default BHK options
      };

  // Store cities data fetched from API
  let cityData = [];

  // Fetch cities from API
  fetch("/api/cities")
    .then((response) => response.json())
    .then((data) => {
      cityData = data.cities;
      // After loading cities, initialize components
      initComponents();
    })
    .catch((error) => {
      console.error("Error fetching cities:", error);
      // Initialize components even if city fetch fails
      initComponents();
    });

  function initComponents() {
    initTransactionTabs();
    initCitySelection();
    initBudgetSlider();
    initPropertyTypes();
    initBHKOptions();
    initButtons();
    updateFilterCount();
  }

  // Transaction tab functionality
  function initTransactionTabs() {
    const tabs = document.querySelectorAll(".tab-button");
    tabs.forEach((tab) => {
      if (tab.dataset.value === selectedFilters.transactionType) {
        tab.classList.add("active");
      }

      tab.addEventListener("click", function () {
        tabs.forEach((t) => t.classList.remove("active"));
        this.classList.add("active");
        selectedFilters.transactionType = this.dataset.value;
        updateFilterCount();
      });
    });
  }

  // City selection functionality
  function initCitySelection() {
    const citySearch = document.getElementById("city-search");
    const citySuggestions = document.getElementById("city-suggestions");
    const addCityBtn = document.getElementById("add-city");
    const selectedCitiesContainer = document.getElementById("selected-cities");

    // Add saved cities
    if (selectedFilters.cities && selectedFilters.cities.length > 0) {
      selectedFilters.cities.forEach((city) => addCityChip(city));
    }

    // Add city button click handler
    addCityBtn.addEventListener("click", function () {
      citySearch.focus();
      showCitySuggestions();
    });

    // City search input handler
    citySearch.addEventListener("input", function () {
      const searchTerm = this.value.toLowerCase();

      if (searchTerm.length > 0) {
        showCitySuggestions();

        // Filter cities based on search term
        const filteredCities = cityData.filter((city) =>
          city.name.toLowerCase().includes(searchTerm)
        );

        renderCitySuggestions(filteredCities);
      } else {
        citySuggestions.style.display = "none";
      }
    });

    // Focus handler
    citySearch.addEventListener("focus", function () {
      if (this.value.length > 0) {
        showCitySuggestions();
      }
    });

    // Click outside to close suggestions
    document.addEventListener("click", function (event) {
      if (
        !citySearch.contains(event.target) &&
        !citySuggestions.contains(event.target) &&
        !addCityBtn.contains(event.target)
      ) {
        citySuggestions.style.display = "none";
      }
    });

    function showCitySuggestions() {
      const searchTerm = citySearch.value.toLowerCase();
      let filteredCities = cityData;

      if (searchTerm.length > 0) {
        filteredCities = cityData.filter((city) =>
          city.name.toLowerCase().includes(searchTerm)
        );
      } else {
        // Show all cities sorted by popularity when search is empty
        filteredCities = [...cityData].sort(
          (a, b) => b.popularity - a.popularity
        );
      }

      renderCitySuggestions(filteredCities);
      citySuggestions.style.display = "block";
    }

    function renderCitySuggestions(cities) {
      citySuggestions.innerHTML = "";

      cities.forEach((city) => {
        if (!selectedFilters.cities.includes(city.name)) {
          const div = document.createElement("div");
          div.classList.add("city-suggestion");

          div.innerHTML = `
            <div class="city-name">${city.name}</div>
            <div class="city-meta">
              <span>${city.properties.toLocaleString()} properties</span>
              <span>${city.avgBHK ? city.avgBHK + " BHK" : ""}</span>
              <span>${
                city.avgSqFt ? Math.round(city.avgSqFt) + " sq.ft" : ""
              }</span>
            </div>
          `;

          div.addEventListener("click", function () {
            addCityChip(city.name);
            citySearch.value = "";
            citySuggestions.style.display = "none";
          });
          citySuggestions.appendChild(div);
        }
      });

      if (citySuggestions.children.length === 0) {
        const div = document.createElement("div");
        div.classList.add("city-suggestion");
        div.textContent = "No matches found";
        citySuggestions.appendChild(div);
      }
    }

    function addCityChip(cityName) {
      if (!selectedFilters.cities.includes(cityName)) {
        selectedFilters.cities.push(cityName);

        const chip = document.createElement("div");
        chip.classList.add("city-chip");
        chip.innerHTML = `
          ${cityName}
          <button class="remove-city" data-city="${cityName}">
            <i class="fas fa-times"></i>
          </button>
        `;

        selectedCitiesContainer.appendChild(chip);

        // Add remove city handler
        chip
          .querySelector(".remove-city")
          .addEventListener("click", function () {
            const cityToRemove = this.dataset.city;
            selectedFilters.cities = selectedFilters.cities.filter(
              (city) => city !== cityToRemove
            );
            this.parentElement.remove();
            updateFilterCount();
            saveFilters();
          });

        updateFilterCount();
        saveFilters();
      }
    }
  }

  // Budget range slider functionality
  function initBudgetSlider() {
    const minBudget = document.getElementById("min-budget");
    const maxBudget = document.getElementById("max-budget");
    const minRange = document.getElementById("min-range");
    const maxRange = document.getElementById("max-range");

    // Set initial values from saved filters
    if (selectedFilters.minBudget) {
      selectDropdownOption(minBudget, selectedFilters.minBudget);
    }
    if (selectedFilters.maxBudget) {
      selectDropdownOption(maxBudget, selectedFilters.maxBudget);
    }

    // Update sliders based on initial dropdown values
    updateSliderPositions();

    // Connect dropdowns to sliders
    minBudget.addEventListener("change", function () {
      selectedFilters.minBudget = this.value;
      updateSliderPositions();
      updateFilterCount();
      saveFilters();
    });

    maxBudget.addEventListener("change", function () {
      selectedFilters.maxBudget = this.value;
      updateSliderPositions();
      updateFilterCount();
      saveFilters();
    });

    // Connect sliders to dropdowns
    minRange.addEventListener("input", function () {
      if (parseInt(minRange.value) > parseInt(maxRange.value)) {
        minRange.value = maxRange.value;
      }
      updateDropdownsFromSliders();
    });

    maxRange.addEventListener("input", function () {
      if (parseInt(maxRange.value) < parseInt(minRange.value)) {
        maxRange.value = minRange.value;
      }
      updateDropdownsFromSliders();
    });

    function selectDropdownOption(dropdown, value) {
      for (let i = 0; i < dropdown.options.length; i++) {
        if (dropdown.options[i].value === value) {
          dropdown.selectedIndex = i;
          break;
        }
      }
    }

    function updateSliderPositions() {
      // This is a simplified version - you would map actual budget values to slider percentages
      const minOptions = minBudget.options;
      const maxOptions = maxBudget.options;

      if (selectedFilters.minBudget) {
        const minIndex = Array.from(minOptions).findIndex(
          (opt) => opt.value === selectedFilters.minBudget
        );
        if (minIndex >= 0) {
          minRange.value = minIndex * (100 / (minOptions.length - 1));
        }
      }

      if (selectedFilters.maxBudget) {
        const maxIndex = Array.from(maxOptions).findIndex(
          (opt) => opt.value === selectedFilters.maxBudget
        );
        if (maxIndex >= 0) {
          maxRange.value = maxIndex * (100 / (maxOptions.length - 1));
        }
      }
    }

    function updateDropdownsFromSliders() {
      const minOptions = minBudget.options;
      const maxOptions = maxBudget.options;

      const minIndex = Math.round(
        (minRange.value * (minOptions.length - 1)) / 100
      );
      const maxIndex = Math.round(
        (maxRange.value * (maxOptions.length - 1)) / 100
      );

      minBudget.selectedIndex = minIndex;
      maxBudget.selectedIndex = maxIndex;

      selectedFilters.minBudget = minBudget.value;
      selectedFilters.maxBudget = maxBudget.value;

      updateFilterCount();
      saveFilters();
    }
  }

  // Property type selection
  function initPropertyTypes() {
    const propertyOptions = document.querySelectorAll(".property-type-option");

    // Set initial selection from saved filters
    propertyOptions.forEach((option) => {
      const value = option.dataset.value;
      if (selectedFilters.propertyTypes.includes(value)) {
        option.classList.add("selected");
      }
    });

    propertyOptions.forEach((option) => {
      option.addEventListener("click", function () {
        this.classList.toggle("selected");

        const value = this.dataset.value;
        if (this.classList.contains("selected")) {
          if (!selectedFilters.propertyTypes.includes(value)) {
            selectedFilters.propertyTypes.push(value);
          }
        } else {
          selectedFilters.propertyTypes = selectedFilters.propertyTypes.filter(
            (type) => type !== value
          );
        }

        updateFilterCount();
        saveFilters();
      });
    });
  }

  // BHK options selection
  function initBHKOptions() {
    const bhkOptions = document.querySelectorAll(".bhk-option");

    // Set initial selection from saved filters
    bhkOptions.forEach((option) => {
      const value = option.dataset.value;
      if (selectedFilters.bhkOptions.includes(value)) {
        option.classList.add("selected");
        option.querySelector("i").className = "fas fa-check";
      }
    });

    bhkOptions.forEach((option) => {
      option.addEventListener("click", function () {
        this.classList.toggle("selected");

        const value = this.dataset.value;
        const icon = this.querySelector("i");

        if (this.classList.contains("selected")) {
          if (!selectedFilters.bhkOptions.includes(value)) {
            selectedFilters.bhkOptions.push(value);
          }
          icon.className = "fas fa-check";
        } else {
          selectedFilters.bhkOptions = selectedFilters.bhkOptions.filter(
            (bhk) => bhk !== value
          );
          icon.className = "fas fa-plus";
        }

        updateFilterCount();
        saveFilters();
      });
    });
  }

  // Button handlers
  function initButtons() {
    const resetButton = document.getElementById("reset-filters");
    const applyFiltersButton = document.getElementById("apply-filters");

    // Reset filters
    resetButton.addEventListener("click", function () {
      // Reset transaction type
      document.querySelectorAll(".tab-button").forEach((tab) => {
        tab.classList.remove("active");
        if (tab.dataset.value === "Buy") {
          tab.classList.add("active");
        }
      });
      selectedFilters.transactionType = "Buy";

      // Reset cities
      document.getElementById("selected-cities").innerHTML = "";
      selectedFilters.cities = [];

      // Reset budget
      document.getElementById("min-budget").selectedIndex = 0;
      document.getElementById("max-budget").selectedIndex = 0;
      document.getElementById("min-range").value = 0;
      document.getElementById("max-range").value = 100;
      selectedFilters.minBudget = "";
      selectedFilters.maxBudget = "";

      // Reset property types
      document.querySelectorAll(".property-type-option").forEach((option) => {
        option.classList.remove("selected");
      });
      selectedFilters.propertyTypes = [];

      // Reset BHK options
      document.querySelectorAll(".bhk-option").forEach((option) => {
        option.classList.remove("selected");
        option.querySelector("i").className = "fas fa-plus";
      });
      selectedFilters.bhkOptions = [];

      updateFilterCount();
      saveFilters();
    });

    // Apply filters button
    applyFiltersButton.addEventListener("click", function () {
      // Save filters before redirecting
      saveFilters();

      // Redirect to properties page
      window.location.href = "/properties";
    });
  }

  // Update filter count
  function updateFilterCount() {
    let count = 0;

    // Count active filters
    if (selectedFilters.transactionType !== "Buy") count++; // Assuming Buy is default
    count += selectedFilters.cities.length;
    if (selectedFilters.minBudget) count++;
    if (selectedFilters.maxBudget) count++;
    count += selectedFilters.propertyTypes.length;
    count += selectedFilters.bhkOptions.length;

    const filterCountElement = document.querySelector(".filter-count");
    if (filterCountElement) {
      filterCountElement.textContent = `(${count})`;
    }

    // Update properties count (simulated)
    const propertyCount = calculateEstimatedPropertyCount();
    const applyFiltersButton = document.getElementById("apply-filters");
    if (applyFiltersButton) {
      applyFiltersButton.textContent = `View ${propertyCount} Properties`;
    }
  }

  // Calculate estimated property count based on filters
  function calculateEstimatedPropertyCount() {
    return predictProperties(selectedFilters);
  }

  // Save filters to localStorage
  function saveFilters() {
    console.log(selectedFilters);
    localStorage.setItem("propertyFilters", JSON.stringify(selectedFilters));
  }

  // Function to get recommended cities based on filters
  function getRecommendedCities(filters) {
    return cityData
      .filter((city) => {
        // Filter based on budget range if specified
        if (filters.minBudget && filters.maxBudget) {
          const minPrice = parseInt(filters.minBudget);
          const maxPrice = parseInt(filters.maxBudget);
          return city.avgPrice >= minPrice && city.avgPrice <= maxPrice;
        }
        return true;
      })
      .sort((a, b) => {
        // Sort by popularity and number of properties
        return b.popularity + b.properties - (a.popularity + a.properties);
      })
      .slice(0, 5) // Get top 5 recommendations
      .map((city) => city.name);
  }

  // Function to predict properties based on filters
  function predictProperties(filters) {
    let totalProperties = 0;

    // Only consider properties from selected cities
    filters.cities.forEach((city) => {
      const cityInfo = cityData.find((c) => c.name === city);
      if (cityInfo) {
        let cityProperties = cityInfo.properties;

        // Adjust based on property types
        if (filters.propertyTypes.length > 0) {
          // Assuming each city has an equal distribution of property types
          cityProperties *= filters.propertyTypes.length / 2; // 2 is total number of property types
        }

        // Adjust based on BHK options
        if (filters.bhkOptions.length > 0) {
          // Assuming each city has an equal distribution of BHK options
          cityProperties *= filters.bhkOptions.length / 4; // 4 is total number of BHK options
        }

        // Adjust based on budget range
        if (filters.minBudget && filters.maxBudget) {
          const minPrice = parseInt(filters.minBudget);
          const maxPrice = parseInt(filters.maxBudget);

          // Check if city's average price falls within budget range
          if (cityInfo.avgPrice >= minPrice && cityInfo.avgPrice <= maxPrice) {
            // If city's average price is in range, keep all properties
            totalProperties += cityProperties;
          } else {
            // If city's average price is outside range, reduce properties
            totalProperties += Math.round(cityProperties * 0.2); // Keep 20% of properties
          }
        } else {
          totalProperties += cityProperties;
        }
      }
    });

    return Math.max(1, Math.round(totalProperties)); // Ensure at least 1 property is shown
  }
});
