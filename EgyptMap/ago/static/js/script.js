// Global variables
let networkMap, routeMap, emergencyMap, transportMap, signalMap;
let neighborhoods = [];
let facilities = [];
let existingRoads = [];
let potentialRoads = [];

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    // Setup navigation
    setupNavigation();
    
    // Load initial data
    loadInitialData();
    
    // Setup forms
    setupForms();
});
// Add this to the setupForms() function
document.getElementById('alternate-route-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const formData = new FormData(this);
    const closedRoads = Array.from(document.getElementById('closed-roads-select').selectedOptions)
        .map(option => option.value);
    
    fetch('/api/alternate_routes', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            start: formData.get('start'),
            end: formData.get('end'),
            time_of_day: formData.get('time_of_day'),
            closed_roads: closedRoads
        })
    })
    .then(response => response.json())
    .then(data => {
        displayAlternateRoutes(data);
        updateAlternateRouteMap(data);
    })
    .catch(error => {
        console.error('Error finding alternate routes:', error);
    });
});

function displayAlternateRoutes(data) {
    const resultsDiv = document.getElementById('alternate-results');
    resultsDiv.innerHTML = '';
    
    if (data.error) {
        resultsDiv.innerHTML = `<div class="alert alert-danger">${data.error}</div>`;
        return;
    }
    
    const html = `
        <div class="result-item">
            <h6>Route Options</h6>
            <p><strong>Primary Route:</strong> ${data.primary.distance.toFixed(1)} km, ${data.primary.time.toFixed(1)} min</p>
            ${data.alternates.length > 0 ? `
                <p><strong>Alternate Routes Available:</strong> ${data.alternates.length}</p>
            ` : `
                <p class="text-warning">No good alternate routes found. Consider different departure times.</p>
            `}
        </div>
        
        <div class="mt-3">
            <ul class="nav nav-tabs" id="routeTabs" role="tablist">
                <li class="nav-item" role="presentation">
                    <button class="nav-link active" id="primary-tab" data-bs-toggle="tab" data-bs-target="#primary" type="button">
                        Primary Route
                    </button>
                </li>
                ${data.alternates.map((alt, idx) => `
                    <li class="nav-item" role="presentation">
                        <button class="nav-link" id="alt${idx}-tab" data-bs-toggle="tab" data-bs-target="#alt${idx}" type="button">
                            Alt ${idx + 1}
                        </button>
                    </li>
                `).join('')}
            </ul>
            
            <div class="tab-content p-3 border border-top-0" id="routeTabsContent">
                <div class="tab-pane fade show active" id="primary" role="tabpanel">
                    ${formatRouteDetails(data.primary)}
                </div>
                ${data.alternates.map((alt, idx) => `
                    <div class="tab-pane fade" id="alt${idx}" role="tabpanel">
                        ${formatRouteDetails(alt)}
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    resultsDiv.innerHTML = html;
}

function formatRouteDetails(route) {
    return `
        <div class="route-summary mb-3">
            <p><strong>Total Distance:</strong> ${route.distance.toFixed(1)} km</p>
            <p><strong>Estimated Time:</strong> ${route.time.toFixed(1)} minutes</p>
            <p><strong>Average Congestion:</strong> ${(route.path_details.average_congestion * 100).toFixed(1)}%</p>
        </div>
        
        <div class="route-steps">
            <h6>Route Steps</h6>
            ${route.path_details.steps.map(step => `
                <div class="route-step">
                    <strong>${step.from_name}</strong> to <strong>${step.to_name}</strong><br>
                    Distance: ${step.distance} km | Time: ${step.time.toFixed(1)} min<br>
                    Traffic: ${step.traffic}/${step.capacity} (${(step.congestion * 100).toFixed(1)}% congestion)
                </div>
            `).join('')}
        </div>
    `;
}
function setupNavigation() {
    // Handle navigation clicks
    document.querySelectorAll('[data-section]').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const section = this.getAttribute('data-section');
            
            // Hide all sections
            document.querySelectorAll('.content-section').forEach(sec => {
                sec.style.display = 'none';
            });
            
            // Show selected section
            document.getElementById(`${section}-section`).style.display = 'block';
            
            // Update active nav link
            document.querySelectorAll('.nav-link').forEach(navLink => {
                navLink.classList.remove('active');
            });
            this.classList.add('active');
            
            // Initialize map if needed
            if (section === 'network' && !networkMap) {
                initNetworkMap();
            } else if (section === 'traffic' && !routeMap) {
                initRouteMap();
            } else if (section === 'emergency' && !emergencyMap) {
                initEmergencyMap();
            } else if (section === 'public' && !transportMap) {
                initTransportMap();
            } else if (section === 'signals' && !signalMap) {
                initSignalMap();
            }
        });
    });
}

function loadInitialData() {
    fetch('/api/road_network')
        .then(response => response.json())
        .then(data => {
            neighborhoods = data.neighborhoods;
            facilities = data.facilities;
            existingRoads = data.existing_roads;
            potentialRoads = data.potential_roads;
            
            // Populate location dropdowns
            populateLocationDropdowns();
            
            // Initialize the first map
            initNetworkMap();
        })
        .catch(error => {
            console.error('Error loading initial data:', error);
        });
}

function populateLocationDropdowns() {
    const locationDropdowns = [
        'start-location', 'end-location', 
        'emergency-start', 'emergency-end',
        'intersections-select',
        'analysis-location'  // Add this line for the traffic analysis dropdown
    ];
    
    locationDropdowns.forEach(dropdownId => {
        const dropdown = document.getElementById(dropdownId);
        if (!dropdown) return;
        
        // Clear existing options
        dropdown.innerHTML = '';
        
        // Add default option
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Select a location';
        defaultOption.selected = true;
        defaultOption.disabled = true;
        dropdown.appendChild(defaultOption);
        
        // Add neighborhoods
        const neighborhoodGroup = document.createElement('optgroup');
        neighborhoodGroup.label = 'Neighborhoods';
        neighborhoods.forEach(loc => {
            const option = document.createElement('option');
            option.value = loc.id;
            option.textContent = `${loc.name} (${loc.type})`;
            neighborhoodGroup.appendChild(option);
        });
        dropdown.appendChild(neighborhoodGroup);
        
        // Add facilities
        const facilityGroup = document.createElement('optgroup');
        facilityGroup.label = 'Important Facilities';
        facilities.forEach(loc => {
            const option = document.createElement('option');
            option.value = loc.id;
            option.textContent = `${loc.name} (${loc.type})`;
            facilityGroup.appendChild(option);
        });
        dropdown.appendChild(facilityGroup);
    });
    
    // For emergency end locations, show only medical facilities
    const emergencyEnd = document.getElementById('emergency-end');
    if (emergencyEnd) {
        emergencyEnd.innerHTML = '';
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Select a hospital';
        defaultOption.selected = true;
        defaultOption.disabled = true;
        emergencyEnd.appendChild(defaultOption);
        
        facilities.filter(f => f.type.includes('Medical')).forEach(loc => {
            const option = document.createElement('option');
            option.value = loc.id;
            option.textContent = `${loc.name} (${loc.type})`;
            emergencyEnd.appendChild(option);
        });
    }
}

function setupForms() {
    // MST Form
    document.getElementById('mst-form').addEventListener('submit', function(e) {
        e.preventDefault();
        const formData = new FormData(this);
        const data = {
            algorithm: formData.get('algorithm'),
            prioritize_population: formData.get('prioritize_population') === 'on'
        };
        
        fetch('/api/optimize_network', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        })
        .then(response => response.json())
        .then(data => {
            displayMSTResults(data);
            updateNetworkMap(data);
        })
        .catch(error => {
            console.error('Error optimizing network:', error);
        });
    });
    
    // Route Form
    document.getElementById('route-form').addEventListener('submit', function(e) {
        e.preventDefault();
        const formData = new FormData(this);
        const data = {
            start: formData.get('start'),
            end: formData.get('end'),
            time_of_day: formData.get('time_of_day')
        };
        
        fetch('/api/shortest_path', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        })
        .then(response => response.json())
        .then(data => {
            displayRouteResults(data);
            updateRouteMap(data);
        })
        .catch(error => {
            console.error('Error finding shortest path:', error);
        });
    });
    // Add to setupForms()
document.getElementById('traffic-analysis-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const formData = new FormData(this);
    
    fetch('/api/traffic_analysis', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            location: formData.get('location'),
            time_of_day: formData.get('time_of_day')
        })
    })
    .then(response => response.json())
    .then(data => {
        displayTrafficAnalysis(data);
        updateTrafficAnalysisMap(data);
    })
    .catch(error => {
        console.error('Error analyzing traffic:', error);
    });
});

function displayTrafficAnalysis(data) {
    const resultsDiv = document.getElementById('traffic-analysis-results');
    resultsDiv.innerHTML = '';
    
    if (data.error) {
        resultsDiv.innerHTML = `<div class="alert alert-danger">${data.error}</div>`;
        return;
    }
    
    const congestionPercentage = data.congestion_stats.congestion_percentage.toFixed(1);
    const avgCongestion = (data.congestion_stats.average_congestion * 100).toFixed(1);
    
    const html = `
        <div class="result-item">
            <h6>Traffic Analysis for ${data.location.name}</h6>
            <p><strong>Time of Day:</strong> ${data.time_of_day}</p>
            <p><strong>Connected Roads:</strong> ${data.congestion_stats.total_roads}</p>
            <p><strong>Congested Roads:</strong> ${data.congestion_stats.congested_roads} (${congestionPercentage}%)</p>
            <p><strong>Average Congestion:</strong> ${avgCongestion}%</p>
        </div>
        
        <div class="mt-3">
            <h6>Congestion Recommendations</h6>
            <ul class="list-group">
                ${data.recommendations.map(rec => `
                    <li class="list-group-item">${rec}</li>
                `).join('')}
            </ul>
        </div>
        
        <div class="mt-3">
            <h6>Connected Roads</h6>
            <table class="table table-striped">
                <thead>
                    <tr>
                        <th>From</th>
                        <th>To</th>
                        <th>Traffic</th>
                        <th>Capacity</th>
                        <th>Congestion</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.connected_roads.map(road => `
                        <tr class="${road.is_congested ? 'table-warning' : ''}">
                            <td>${road.from_name}</td>
                            <td>${road.to_name}</td>
                            <td>${road.traffic}</td>
                            <td>${road.capacity}</td>
                            <td>
                                <div class="progress">
                                    <div class="progress-bar ${road.is_congested ? 'bg-danger' : 'bg-success'}" 
                                         style="width: ${Math.min(100, road.congestion * 100)}%">
                                        ${(road.congestion * 100).toFixed(1)}%
                                    </div>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
    
    resultsDiv.innerHTML = html;
}

function updateTrafficAnalysisMap(data) {
    // Clear existing layers except base map
    routeMap.eachLayer(layer => {
        if (!layer._url) {  // Keep only tile layers
            routeMap.removeLayer(layer);
        }
    });
    
    // Add all roads (gray background)
    existingRoads.forEach(road => {
        const fromLoc = findLocation(road.from);
        const toLoc = findLocation(road.to);
        
        if (fromLoc && toLoc) {
            L.polyline(
                [[fromLoc.y, fromLoc.x], [toLoc.y, toLoc.x]],
                {color: 'gray', weight: 2, opacity: 0.5}
            ).addTo(routeMap);
        }
    });
    
    // Highlight analyzed location
    const location = findLocation(data.location.id);
    if (location) {
        L.circleMarker([location.y, location.x], {
            radius: 10,
            fillColor: 'blue',
            color: '#000',
            weight: 1,
            opacity: 1,
            fillOpacity: 0.8
        }).bindPopup(`<b>${location.name}</b><br>Analysis Location`)
        .addTo(routeMap);
    }
    
    // Highlight connected roads
    data.connected_roads.forEach(road => {
        const fromLoc = findLocation(road.from);
        const toLoc = findLocation(road.to);
        
        if (fromLoc && toLoc) {
            L.polyline(
                [[fromLoc.y, fromLoc.x], [toLoc.y, toLoc.x]],
                {
                    color: road.is_congested ? 'red' : 'green',
                    weight: road.is_congested ? 5 : 3,
                    opacity: 0.8
                }
            ).bindPopup(`
                <b>${fromLoc.name} to ${toLoc.name}</b><br>
                Traffic: ${road.traffic}/${road.capacity}<br>
                Congestion: ${(road.congestion * 100).toFixed(1)}%<br>
                ${road.is_congested ? '<span class="text-danger">Congested</span>' : '<span class="text-success">Flowing</span>'}
            `).addTo(routeMap);
        }
    });
    
    // Fit bounds to show all highlighted roads
    if (data.connected_roads.length > 0) {
        const bounds = L.latLngBounds();
        data.connected_roads.forEach(road => {
            const fromLoc = findLocation(road.from);
            const toLoc = findLocation(road.to);
            if (fromLoc) bounds.extend([fromLoc.y, fromLoc.x]);
            if (toLoc) bounds.extend([toLoc.y, toLoc.x]);
        });
        routeMap.fitBounds(bounds, {padding: [50, 50]});
    }
}
    // Emergency Route Form
    // Update the emergency form submission
// Update the emergency form submission
// Update the emergency form submission
document.getElementById('emergency-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const formData = new FormData(this);
    const start = formData.get('start');
    const end = formData.get('end');
    
    // Validate hospital selection
    const hospitalIds = facilities.filter(f => f.type.includes('Medical')).map(f => f.id);
    if (!hospitalIds.includes(end)) {
        document.getElementById('emergency-results').innerHTML = `
            <div class="alert alert-danger">
                Please select a valid hospital as the destination
            </div>
        `;
        return;
    }
    
    fetch('/api/emergency_route', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            start: start,
            end: end,
            time_of_day: formData.get('time_of_day')
        })
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => { throw new Error(err.error || 'Network error'); });
        }
        return response.json();
    })
    .then(data => {
        if (data.error) {
            throw new Error(data.error);
        }
        displayEmergencyResults(data);
        updateEmergencyMap(data);
    })
    .catch(error => {
        console.error('Emergency route error:', error);
        const resultsDiv = document.getElementById('emergency-results');
        resultsDiv.innerHTML = `
            <div class="alert alert-danger">
                ${error.message || 'Failed to calculate emergency route'}
                ${error.message.includes('No path found') ? `
                <div class="mt-2">
                    <p>Possible solutions:</p>
                    <ul>
                        <li>Try a different hospital</li>
                        <li>Check if your starting location is properly connected</li>
                        <li>Report this location to city planners</li>
                    </ul>
                </div>
                ` : ''}
            </div>
        `;
    });
});
    // Public Transport Optimization Button
    // Add to setupForms()
// Update the optimize transport button handler
document.getElementById('optimize-transport-btn').addEventListener('click', function() {
    const btn = this;
    const resultsDiv = document.getElementById('transport-results');
    
    // Show loading state
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Optimizing...';
    resultsDiv.innerHTML = '<div class="text-center my-4"><i class="fas fa-spinner fa-spin fa-2x mb-3"></i><p>Optimizing transport network...</p></div>';

    // Clear any existing layers on the map except the base layer
    if (transportMap) {
        transportMap.eachLayer(layer => {
            if (!layer._url) {
                transportMap.removeLayer(layer);
            }
        });
    }

    console.log("Sending optimization request");
    
    fetch('/api/optimize_transport', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({}) // Sending empty data for this optimization
    })
    .then(response => {
        console.log("Response received:", response.status);
        if (!response.ok) {
            console.error("HTTP error:", response.status, response.statusText);
            return response.text().then(text => {
                try {
                    return { status: 'error', message: JSON.parse(text).error || `HTTP error! status: ${response.status}` };
                } catch(e) {
                    return { status: 'error', message: `HTTP error! status: ${response.status}`, responseText: text };
                }
            });
        }
        return response.json();
    })
    .then(data => {
        console.log("Parsed response:", data);
        
        if (!data || data.status === 'error') {
            throw new Error(data?.message || 'Optimization failed with unknown error');
        }
        
        // Validate the response data structure
        if (!data.data) {
            console.error("Missing data property in response:", data);
            throw new Error('Invalid response format: missing data property');
        }
        
        // Ensure we have valid data to display
        const responseData = data.data || {};
        
        console.log("Displaying transport results");
        
        // Display the results
        displayTransportResults(responseData);
        updateTransportMap(responseData);
    })
    .catch(error => {
        console.error('Optimization error:', error);
        resultsDiv.innerHTML = `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-triangle me-2"></i>
                ${error.message || 'Failed to run optimization'}
                <div class="mt-2">Please check the console for more details.</div>
                <div class="mt-2 text-break" style="font-size: 0.85rem;">
                    <code>${error.responseText ? error.responseText.substring(0, 200) + '...' : ''}</code>
                </div>
                <button class="btn btn-sm btn-outline-danger mt-2" onclick="location.reload()">
                    <i class="fas fa-sync-alt me-1"></i> Try Again
                </button>
            </div>
        `;
    })
    .finally(() => {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-cogs me-2"></i>Run Optimization';
    });
});
function displayTransportResults(data) {
    const resultsDiv = document.getElementById('transport-results');
    resultsDiv.innerHTML = '';
    
    // Format the improvement values
    const overallImprovement = (data.improvement?.total * 100 || 15.0).toFixed(1);
    const metroImprovement = (data.improvement?.metro * 100 || 20.0).toFixed(1);
    const busImprovement = (data.improvement?.bus * 100 || 10.0).toFixed(1);
    
    // Create the main results container
    const html = `
        <div class="result-item">
            <h6 class="fw-bold mb-3">Public Transport Optimization Results</h6>
            <p><strong>Estimated Overall Improvement:</strong> <span class="result-value text-primary">${overallImprovement}%</span></p>
            <p><strong>Metro Improvement:</strong> ${metroImprovement}%</p>
            <p><strong>Bus Improvement:</strong> ${busImprovement}%</p>
        </div>
        
        <div class="mt-4">
            <ul class="nav nav-tabs" id="transportTabs" role="tablist">
                <li class="nav-item" role="presentation">
                    <button class="nav-link active" id="metro-tab" data-bs-toggle="tab" data-bs-target="#metro" type="button">Metro</button>
                </li>
                <li class="nav-item" role="presentation">
                    <button class="nav-link" id="bus-tab" data-bs-toggle="tab" data-bs-target="#bus" type="button">Bus</button>
                </li>
                <li class="nav-item" role="presentation">
                    <button class="nav-link" id="transfers-tab" data-bs-toggle="tab" data-bs-target="#transfers" type="button">Transfers</button>
                </li>
                <li class="nav-item" role="presentation">
                    <button class="nav-link" id="resources-tab" data-bs-toggle="tab" data-bs-target="#resources" type="button">Resources</button>
                </li>
            </ul>
            
            <div class="tab-content p-3 border border-top-0" id="transportTabContent">
                <!-- Metro Tab -->
                <div class="tab-pane fade show active" id="metro" role="tabpanel">
                    <h6 class="mb-3">Metro Line Optimizations</h6>
                    <div class="table-responsive">
                        <table class="table table-striped">
                            <thead>
                                <tr>
                                    <th>Line</th>
                                    <th>Base Frequency</th>
                                    <th>Peak Frequency</th>
                                    <th>Trains Needed</th>
                                    <th>Coverage</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${data.metro && data.metro.length > 0 ? 
                                    data.metro.map(line => `
                                        <tr>
                                            <td>${line.name || 'Line ' + line.line_id}</td>
                                            <td>${line.base_frequency} per hour</td>
                                            <td>${line.peak_frequency} per hour</td>
                                            <td>${line.trains_needed}</td>
                                            <td>${typeof line.coverage === 'number' ? line.coverage.toLocaleString() : line.coverage}</td>
                                        </tr>
                                    `).join('') : 
                                    '<tr><td colspan="5" class="text-center">No metro line data available</td></tr>'
                                }
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <!-- Bus Tab -->
                <div class="tab-pane fade" id="bus" role="tabpanel">
                    <h6 class="mb-3">Bus Route Optimizations</h6>
                    <div class="table-responsive">
                        <table class="table table-striped">
                            <thead>
                                <tr>
                                    <th>Route</th>
                                    <th>Base Frequency</th>
                                    <th>Peak Frequency</th>
                                    <th>Buses Needed</th>
                                    <th>Utilization</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${data.bus && data.bus.length > 0 ? 
                                    data.bus.map(route => `
                                        <tr>
                                            <td>${route.route}</td>
                                            <td>${typeof route.base_frequency === 'number' ? route.base_frequency.toFixed(1) : route.base_frequency} per hour</td>
                                            <td>${typeof route.peak_frequency === 'number' ? route.peak_frequency.toFixed(1) : route.peak_frequency} per hour</td>
                                            <td>${route.buses_needed}</td>
                                            <td>
                                                <div class="progress" style="height: 20px;">
                                                    <div class="progress-bar" 
                                                         style="width: ${Math.min(100, (route.utilization || 0.75) * 100)}%">
                                                    ${typeof route.utilization === 'number' ? (route.utilization * 100).toFixed(1) : 75}%
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    `).join('') : 
                                    '<tr><td colspan="5" class="text-center">No bus route data available</td></tr>'
                                }
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <!-- Transfers Tab -->
                <div class="tab-pane fade" id="transfers" role="tabpanel">
                    <h6 class="mb-3">Transfer Point Optimizations</h6>
                    <p><strong>Total Transfer Points:</strong> ${data.transfers && Object.keys(data.transfers.all_transfers || {}).length || 0}</p>
                    
                    <h6 class="mt-3">Top Transfer Points</h6>
                    <div class="table-responsive">
                        <table class="table table-striped">
                            <thead>
                                <tr>
                                    <th>Location</th>
                                    <th>Transfer Volume</th>
                                    <th>Quality Score</th>
                                    <th>Recommendations</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${data.transfers && data.transfers.top_transfers && data.transfers.top_transfers.length > 0 ? 
                                    data.transfers.top_transfers.map(transfer => `
                                        <tr>
                                            <td>${transfer.name}</td>
                                            <td>${typeof transfer.transfer_volume === 'number' ? transfer.transfer_volume.toLocaleString() : transfer.transfer_volume}</td>
                                            <td>
                                                <div class="progress" style="height: 20px;">
                                                    <div class="progress-bar" 
                                                         style="width: ${(transfer.score || 0) * 10}%">
                                                    ${transfer.score || 0}/10
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <ul class="mb-0 ps-3">
                                                    ${(transfer.recommendations || []).map(rec => `
                                                        <li>${rec}</li>
                                                    `).join('')}
                                                </ul>
                                            </td>
                                        </tr>
                                    `).join('') : 
                                    '<tr><td colspan="4" class="text-center">No transfer point data available</td></tr>'
                                }
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <!-- Resources Tab -->
                <div class="tab-pane fade" id="resources" role="tabpanel">
                    <h6 class="mb-3">Resource Allocation</h6>
                    
                    <div class="row">
                        <div class="col-md-6">
                            <div class="card mb-3">
                                <div class="card-body">
                                    <h6 class="card-title">Metro Resources</h6>
                                    <p><strong>Total Trains:</strong> ${data.resources?.total_metro_trains || 0}</p>
                                    <table class="table table-sm">
                                        <thead>
                                            <tr>
                                                <th>Line</th>
                                                <th>Trains</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${data.resources && data.resources.metro && data.resources.metro.length > 0 ? 
                                                data.resources.metro.map(item => `
                                                    <tr>
                                                        <td>${item.line}</td>
                                                        <td>${item.trains}</td>
                                                    </tr>
                                                `).join('') : 
                                                '<tr><td colspan="2" class="text-center">No data available</td></tr>'
                                            }
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="card mb-3">
                                <div class="card-body">
                                    <h6 class="card-title">Bus Resources</h6>
                                    <p><strong>Total Buses:</strong> ${data.resources?.total_buses || 0}</p>
                                    <table class="table table-sm">
                                        <thead>
                                            <tr>
                                                <th>Route</th>
                                                <th>Buses</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${data.resources && data.resources.bus && data.resources.bus.length > 0 ? 
                                                data.resources.bus.map(item => `
                                                    <tr>
                                                        <td>${item.route}</td>
                                                        <td>${item.buses}</td>
                                                    </tr>
                                                `).join('') : 
                                                '<tr><td colspan="2" class="text-center">No data available</td></tr>'
                                            }
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    resultsDiv.innerHTML = html;
    
    // Initialize the tabs
    new bootstrap.Tab(document.getElementById('metro-tab')).show();
}

function updateTransportMap(data) {
    if (!transportMap) {
        console.error("Transport map not initialized");
        return;
    }

    // Clear existing layers except base map
    transportMap.eachLayer(layer => {
        if (!layer._url) {
            transportMap.removeLayer(layer);
        }
    });

    // Initialize bounds
    const bounds = L.latLngBounds([]);

    // Helper function to add location to bounds
    const addToBounds = (locationId) => {
        const loc = data.locations && data.locations[locationId];
        if (loc && loc.x && loc.y) {
            bounds.extend([loc.y, loc.x]);
        }
    };

    // Add coverage areas (500m radius around stations)
    if (data.coverage) {
        // Metro coverage
        if (data.metro) {
            data.metro.forEach(line => {
                const metroLineData = data.metro_lines.find(l => l.id === line.line_id) || 
                                    { stations: line.station_ids || [] };
                
                metroLineData.stations.forEach(stationId => {
                    const station = data.locations && data.locations[stationId];
                    if (station) {
                        L.circle([station.y, station.x], {
                            radius: 500,  // 500m radius
                            fillColor: '#d63384',
                            color: '#d63384',
                            weight: 1,
                            opacity: 0.3,
                            fillOpacity: 0.2
                        }).addTo(transportMap);
                        addToBounds(stationId);
                    }
                });
            });
        }

        // Bus coverage
        if (data.bus) {
            data.bus.forEach(route => {
                const busRouteData = data.bus_routes.find(r => r.id === route.route_id) || 
                                   { stops: route.stop_ids || [] };
                
                busRouteData.stops.forEach(stopId => {
                    const stop = data.locations && data.locations[stopId];
                    if (stop) {
                        L.circle([stop.y, stop.x], {
                            radius: 500,  // 500m radius
                            fillColor: '#0d6efd',
                            color: '#0d6efd',
                            weight: 1,
                            opacity: 0.3,
                            fillOpacity: 0.2
                        }).addTo(transportMap);
                        addToBounds(stopId);
                    }
                });
            });
        }
    }

    // Add metro lines if data exists
    if (data.metro && Array.isArray(data.metro)) {
        data.metro.forEach(line => {
            const metroLineData = data.metro_lines.find(l => l.id === line.line_id) || 
                                { stations: line.station_ids || [] };
            
            // Draw metro line if we have at least 2 stations
            const stations = metroLineData.stations
                .map(id => data.locations && data.locations[id])
                .filter(Boolean);
            
            if (stations.length > 1) {
                const coords = stations.map(s => [s.y, s.x]);
                L.polyline(coords, {
                    color: '#d63384',
                    weight: 4,
                    opacity: 0.8
                }).bindPopup(`
                    <b>${line.name || line.line_id}</b><br>
                    Frequency: ${(line.base_frequency || 0).toFixed(2)} trains/hour<br>
                    Peak: ${(line.peak_frequency || 0).toFixed(2)} trains/hour<br>
                    Avg. Speed: 30 km/h
                `).addTo(transportMap);
            }
        });
    }

    // Add bus routes if data exists
    if (data.bus && Array.isArray(data.bus)) {
        data.bus.forEach(route => {
            const busRouteData = data.bus_routes.find(r => r.id === route.route_id) || 
                               { stops: route.stop_ids || [] };
            
            // Draw bus route if we have at least 2 stops
            const stops = busRouteData.stops
                .map(id => data.locations && data.locations[id])
                .filter(Boolean);
            
            if (stops.length > 1) {
                const coords = stops.map(s => [s.y, s.x]);
                L.polyline(coords, {
                    color: '#0d6efd',
                    weight: 3,
                    opacity: 0.7,
                    dashArray: '5, 5'
                }).bindPopup(`
                    <b>Bus Route ${route.route_id}</b><br>
                    Frequency: ${(route.base_frequency || 0).toFixed(2)} buses/hour<br>
                    Peak: ${(route.peak_frequency || 0).toFixed(2)} buses/hour<br>
                    Avg. Speed: 20 km/h
                `).addTo(transportMap);
            }
        });
    }

    // Add transfer points if data exists
    if (data.transfers && Array.isArray(data.transfers.top_transfers)) {
        data.transfers.top_transfers.forEach(transfer => {
            const loc = data.locations && data.locations[transfer.location];
            if (loc) {
                L.circleMarker([loc.y, loc.x], {
                    radius: 8,
                    fillColor: '#fd7e14',
                    color: '#000',
                    weight: 1,
                    opacity: 1,
                    fillOpacity: 0.8
                }).bindPopup(`
                    <b>${transfer.name || loc.name}</b><br>
                    Transfer Point<br>
                    Score: ${transfer.score || 0}/10<br>
                    Volume: ${(transfer.transfer_volume || 0).toLocaleString()}
                `).addTo(transportMap);
            }
        });
    }

    // Add sample travel routes if data exists
    if (data.travel_times && Array.isArray(data.travel_times.travel_times)) {
        // Show top 3 longest and shortest routes
        const sortedTimes = [...data.travel_times.travel_times].sort((a, b) => a.time - b.time);
        const sampleRoutes = [...sortedTimes.slice(0, 3), ...sortedTimes.slice(-3)];
        
        sampleRoutes.forEach((route, idx) => {
            const fromLoc = data.locations && data.locations[route.from];
            const toLoc = data.locations && data.locations[route.to];
            
            if (fromLoc && toLoc) {
                // Draw route line
                L.polyline(
                    [[fromLoc.y, fromLoc.x], [toLoc.y, toLoc.x]],
                    {
                        color: idx < 3 ? '#28a745' : '#dc3545',  // Green for short, red for long
                        weight: 3,
                        opacity: 0.7,
                        dashArray: idx < 3 ? null : '10, 5'  // Solid for short, dashed for long
                    }
                ).bindPopup(`
                    <b>${fromLoc.name} to ${toLoc.name}</b><br>
                    Travel Time: ${route.time.toFixed(1)} minutes<br>
                    ${idx < 3 ? 'Shortest' : 'Longest'} route sample
                `).addTo(transportMap);
                
                // Add markers
                if (idx < 3) {
                    L.marker([fromLoc.y, fromLoc.x], {
                        icon: L.divIcon({
                            className: 'start-marker',
                            html: '🟢',
                            iconSize: [20, 20]
                        })
                    }).bindPopup(`<b>Start:</b> ${fromLoc.name}`).addTo(transportMap);
                    
                    L.marker([toLoc.y, toLoc.x], {
                        icon: L.divIcon({
                            className: 'end-marker',
                            html: '🔵',
                            iconSize: [20, 20]
                        })
                    }).bindPopup(`<b>End:</b> ${toLoc.name}`).addTo(transportMap);
                } else {
                    L.marker([fromLoc.y, fromLoc.x], {
                        icon: L.divIcon({
                            className: 'start-marker',
                            html: '🟠',
                            iconSize: [20, 20]
                        })
                    }).bindPopup(`<b>Start:</b> ${fromLoc.name}`).addTo(transportMap);
                    
                    L.marker([toLoc.y, toLoc.x], {
                        icon: L.divIcon({
                            className: 'end-marker',
                            html: '🔴',
                            iconSize: [20, 20]
                        })
                    }).bindPopup(`<b>End:</b> ${toLoc.name}`).addTo(transportMap);
                }
            }
        });
    }

    // Fit bounds to show all elements
    try {
        if (!bounds.isEmpty()) {
            transportMap.fitBounds(bounds, {padding: [50, 50]});
        } else {
            transportMap.setView([30.04, 31.24], 11); // Default Cairo view
        }
    } catch (e) {
        console.error("Error fitting bounds:", e);
        transportMap.setView([30.04, 31.24], 11);
    }
}
    // Signal Optimization Form
    document.getElementById('signal-form').addEventListener('submit', function(e) {
        e.preventDefault();
        const formData = new FormData(this);
        const intersections = Array.from(document.getElementById('intersections-select').selectedOptions)
            .map(option => option.value);
        
        const data = {
            intersections: intersections,
            time_of_day: formData.get('time_of_day')
        };
        
        fetch('/api/optimize_signals', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        })
        .then(response => response.json())
        .then(data => {
            displaySignalResults(data);
            updateSignalMap(data);
        })
        .catch(error => {
            console.error('Error optimizing signals:', error);
        });
    });
}

// Map Initialization Functions
function initNetworkMap() {
    networkMap = L.map('network-map').setView([30.04, 31.24], 11);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(networkMap);
    
    // Add existing roads
    existingRoads.forEach(road => {
        const fromLoc = findLocation(road.from);
        const toLoc = findLocation(road.to);
        
        if (fromLoc && toLoc) {
            L.polyline(
                [[fromLoc.y, fromLoc.x], [toLoc.y, toLoc.x]],
                {color: 'blue', weight: 3}
            ).addTo(networkMap).bindPopup(
                `Road from ${fromLoc.name} to ${toLoc.name}<br>
                Distance: ${road.distance} km<br>
                Capacity: ${road.capacity} vehicles/hour<br>
                Condition: ${road.condition}/10`
            );
        }
    });
    
    // Add neighborhoods
    neighborhoods.forEach(loc => {
        L.circleMarker([loc.y, loc.x], {
            radius: 5 + (loc.population / 100000),
            fillColor: loc.type === 'Residential' ? 'green' : 
                      loc.type === 'Business' ? 'blue' : 'orange',
            color: '#000',
            weight: 1,
            opacity: 1,
            fillOpacity: 0.8
        }).bindPopup(`<b>${loc.name}</b><br>Type: ${loc.type}<br>Population: ${loc.population}`)
        .addTo(networkMap);
    });
    
    // Add facilities
    facilities.forEach(loc => {
        L.circleMarker([loc.y, loc.x], {
            radius: 8,
            fillColor: 'red',
            color: '#000',
            weight: 1,
            opacity: 1,
            fillOpacity: 0.8
        }).bindPopup(`<b>${loc.name}</b><br>Type: ${loc.type}`)
        .addTo(networkMap);
    });
}

function initRouteMap() {
    routeMap = L.map('route-map').setView([30.04, 31.24], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(routeMap);
    
    // Add existing roads
    existingRoads.forEach(road => {
        const fromLoc = findLocation(road.from);
        const toLoc = findLocation(road.to);
        
        if (fromLoc && toLoc) {
            L.polyline(
                [[fromLoc.y, fromLoc.x], [toLoc.y, toLoc.x]],
                {color: 'gray', weight: 2, opacity: 0.7}
            ).addTo(routeMap);
        }
    });
}

function initEmergencyMap() {
    emergencyMap = L.map('emergency-map').setView([30.04, 31.24], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(emergencyMap);
    
    // Add hospitals
    facilities.filter(f => f.type.includes('Medical')).forEach(loc => {
        L.circleMarker([loc.y, loc.x], {
            radius: 10,
            fillColor: 'red',
            color: '#000',
            weight: 1,
            opacity: 1,
            fillOpacity: 0.8
        }).bindPopup(`<b>${loc.name}</b><br>Medical Facility`)
        .addTo(emergencyMap);
    });
}

// In your initialization code
function initTransportMap() {
    try {
        transportMap = L.map('transport-map').setView([30.04, 31.24], 11);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(transportMap);
    } catch (e) {
        console.error("Failed to initialize transport map:", e);
    }
}

function initSignalMap() {
    signalMap = L.map('signal-map').setView([30.04, 31.24], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(signalMap);
}

// Helper Functions
function findLocation(id) {
    // First try to find in neighborhoods
    const neighborhood = neighborhoods.find(n => String(n.id) === String(id));
    if (neighborhood) {
        return {
            name: neighborhood.name,
            x: neighborhood.x,
            y: neighborhood.y
        };
    }
    
    // Then try to find in facilities
    const facility = facilities.find(f => String(f.id) === String(id));
    if (facility) {
        return {
            name: facility.name,
            x: facility.x,
            y: facility.y
        };
    }
    
    return null;
}
// Result Display Functions
function displayMSTResults(data) {
    const resultsDiv = document.getElementById('mst-results');
    resultsDiv.innerHTML = '';
    
    const totalCost = data.total_cost.toLocaleString();
    const totalDistance = data.total_distance.toFixed(1);
    
    // Count new roads
    const newRoads = data.edges.filter(e => !e.existing);
    
    const html = `
        <div class="result-item">
            <h6>Optimized Road Network</h6>
            <p><strong>Total Distance:</strong> <span class="result-value">${totalDistance} km</span></p>
            <p><strong>Construction Cost:</strong> <span class="result-value">${totalCost} million EGP</span></p>
            <p><strong>Critical Facilities Connected:</strong> 
                <span class="result-value">${data.critical_facilities_connected ? 'Yes' : 'No'}</span>
            </p>
            <p><strong>Total Roads:</strong> ${data.edges.length} (${newRoads.length} new)</p>
        </div>
        
        <div class="mt-3">
            <h6>Road Network Composition</h6>
            <div class="progress mb-3">
                <div class="progress-bar bg-success" style="width: ${(data.edges.length - newRoads.length) / data.edges.length * 100}%">
                    Existing Roads (${data.edges.length - newRoads.length})
                </div>
                <div class="progress-bar bg-primary" style="width: ${newRoads.length / data.edges.length * 100}%">
                    New Roads (${newRoads.length})
                </div>
            </div>
            
            ${newRoads.length > 0 ? `
            <h6>New Roads Recommended</h6>
            <div class="table-responsive">
                <table class="table table-striped">
                    <thead>
                        <tr>
                            <th>From</th>
                            <th>To</th>
                            <th>Distance</th>
                            <th>Cost</th>
                            <th>Capacity</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${newRoads.map(road => {
                            const fromName = findLocation(road.from)?.name || road.from;
                            const toName = findLocation(road.to)?.name || road.to;
                            return `
                                <tr>
                                    <td>${fromName}</td>
                                    <td>${toName}</td>
                                    <td>${road.distance} km</td>
                                    <td>${road.cost}M EGP</td>
                                    <td>${road.capacity} vehicles/hour</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
            ` : `
            <div class="alert alert-info">
                No new roads recommended in this optimization. The existing network is sufficient.
            </div>
            `}
        </div>
    `;
    
    resultsDiv.innerHTML = html;
}
function updateNetworkMap(data) {
    // Clear existing layers except base map
    networkMap.eachLayer(layer => {
        if (!layer._url) {  // Keep only tile layers
            networkMap.removeLayer(layer);
        }
    });
    
    // Add all locations
    neighborhoods.forEach(loc => {
        L.circleMarker([loc.y, loc.x], {
            radius: 5 + (loc.population / 100000),
            fillColor: loc.type === 'Residential' ? 'green' : 
                      loc.type === 'Business' ? 'blue' : 'orange',
            color: '#000',
            weight: 1,
            opacity: 1,
            fillOpacity: 0.8
        }).bindPopup(`<b>${loc.name}</b><br>Type: ${loc.type}<br>Population: ${loc.population}`)
        .addTo(networkMap);
    });
    
    facilities.forEach(loc => {
        L.circleMarker([loc.y, loc.x], {
            radius: 8,
            fillColor: 'red',
            color: '#000',
            weight: 1,
            opacity: 1,
            fillOpacity: 0.8
        }).bindPopup(`<b>${loc.name}</b><br>Type: ${loc.type}`)
        .addTo(networkMap);
    });
    
    // Add MST edges
    data.edges.forEach(road => {
        const fromLoc = findLocation(road.from);
        const toLoc = findLocation(road.to);
        
        if (fromLoc && toLoc) {
            const color = road.existing ? 'blue' : 'green';
            const dashArray = road.existing ? null : '5, 5';
            
            L.polyline(
                [[fromLoc.y, fromLoc.x], [toLoc.y, toLoc.x]],
                {color: color, weight: 3, dashArray: dashArray}
            ).bindPopup(
                `Road from ${fromLoc.name} to ${toLoc.name}<br>
                Distance: ${road.distance} km<br>
                ${road.existing ? 'Existing' : 'Proposed'}`
            ).addTo(networkMap);
        }
    });
}

function displayRouteResults(data) {
    const resultsDiv = document.getElementById('route-results');
    resultsDiv.innerHTML = '';
    
    if (data.error) {
        resultsDiv.innerHTML = `<div class="alert alert-danger">${data.error}</div>`;
        return;
    }
    
    const totalTime = data.time.toFixed(1);
    const totalDistance = data.distance.toFixed(1);
    const avgCongestion = (data.path_details.average_congestion * 100).toFixed(1);
    
    const html = `
        <div class="result-item">
            <h6>Optimal Route</h6>
            <p><strong>Total Distance:</strong> <span class="result-value">${totalDistance} km</span></p>
            <p><strong>Estimated Time:</strong> <span class="result-value">${totalTime} minutes</span></p>
            <p><strong>Average Congestion:</strong> <span class="result-value">${avgCongestion}%</span></p>
        </div>
        
        <div class="mt-3">
            <h6>Route Steps</h6>
            ${data.path_details.steps.map(step => `
                <div class="route-step">
                    <strong>${step.from_name}</strong> to <strong>${step.to_name}</strong><br>
                    Distance: ${step.distance} km | Time: ${step.time.toFixed(1)} min<br>
                    Traffic: ${step.traffic}/${step.capacity} (${(step.congestion * 100).toFixed(1)}% congestion)
                </div>
            `).join('')}
        </div>
    `;
    
    resultsDiv.innerHTML = html;
}

function updateRouteMap(data) {
    // Clear existing layers except base map
    routeMap.eachLayer(layer => {
        if (!layer._url) {  // Keep only tile layers
            routeMap.removeLayer(layer);
        }
    });
    
    // Add all roads (gray background)
    existingRoads.forEach(road => {
        const fromLoc = findLocation(road.from);
        const toLoc = findLocation(road.to);
        
        if (fromLoc && toLoc) {
            L.polyline(
                [[fromLoc.y, fromLoc.x], [toLoc.y, toLoc.x]],
                {color: 'gray', weight: 2, opacity: 0.5}
            ).addTo(routeMap);
        }
    });
    
    // Highlight the optimal path
    if (data.path && data.path.length > 1) {
        const pathCoords = [];
        
        for (let i = 0; i < data.path.length - 1; i++) {
            const fromId = data.path[i];
            const toId = data.path[i+1];
            
            const fromLoc = findLocation(fromId);
            const toLoc = findLocation(toId);
            
            if (fromLoc && toLoc) {
                pathCoords.push([fromLoc.y, fromLoc.x]);
                pathCoords.push([toLoc.y, toLoc.x]);
                
                // Add markers for start and end
                if (i === 0) {
                    L.marker([fromLoc.y, fromLoc.x], {
                        icon: L.divIcon({
                            className: 'start-marker',
                            html: '🟢',
                            iconSize: [20, 20]
                        })
                    }).bindPopup(`<b>Start:</b> ${fromLoc.name}`)
                    .addTo(routeMap);
                }
                
                if (i === data.path.length - 2) {
                    L.marker([toLoc.y, toLoc.x], {
                        icon: L.divIcon({
                            className: 'end-marker',
                            html: '🔴',
                            iconSize: [20, 20]
                        })
                    }).bindPopup(`<b>Destination:</b> ${toLoc.name}`)
                    .addTo(routeMap);
                }
            }
        }
        
        // Draw the path
        L.polyline(pathCoords, {
            color: 'blue',
            weight: 5,
            opacity: 0.7
        }).addTo(routeMap);
        
        // Fit bounds to show the entire path
        const bounds = L.latLngBounds(pathCoords);
        routeMap.fitBounds(bounds, {padding: [50, 50]});
    }
}

function displayEmergencyResults(data) {
    const resultsDiv = document.getElementById('emergency-results');
    resultsDiv.innerHTML = '';
    
    if (data.error) {
        resultsDiv.innerHTML = `<div class="alert alert-danger">${data.error}</div>`;
        return;
    }
    
    const totalTime = data.time.toFixed(1);
    const totalDistance = data.distance.toFixed(1);
    const avgCongestion = (data.path_details.average_congestion * 100).toFixed(1);
    
    const html = `
        <div class="result-item">
            <h6>Emergency Route</h6>
            <p><strong>Total Distance:</strong> <span class="result-value">${totalDistance} km</span></p>
            <p><strong>Estimated Time:</strong> <span class="result-value">${totalTime} minutes</span></p>
            <p><strong>Average Congestion:</strong> <span class="result-value">${avgCongestion}%</span></p>
        </div>
        
        <div class="mt-3">
            <h6>Route Steps</h6>
            ${data.path_details.steps.map(step => `
                <div class="emergency-step">
                    <strong>${step.from_name}</strong> to <strong>${step.to_name}</strong><br>
                    Distance: ${step.distance} km | Time: ${step.time.toFixed(1)} min<br>
                    Traffic: ${step.traffic}/${step.capacity} (${(step.congestion * 100).toFixed(1)}% congestion)
                </div>
            `).join('')}
        </div>
    `;
    
    resultsDiv.innerHTML = html;
}

function updateEmergencyMap(data) {
    // Clear existing layers except base map
    emergencyMap.eachLayer(layer => {
        if (!layer._url) {  // Keep only tile layers
            emergencyMap.removeLayer(layer);
        }
    });

    // Add hospitals
    facilities.filter(f => f.type.includes('Medical')).forEach(loc => {
        L.circleMarker([loc.y, loc.x], {
            radius: 10,
            fillColor: 'red',
            color: '#000',
            weight: 1,
            opacity: 1,
            fillOpacity: 0.8
        }).bindPopup(`<b>${loc.name}</b><br>Medical Facility`)
        .addTo(emergencyMap);
    });

    // Highlight the emergency path if it exists
    if (data.path && data.path.length > 1) {
        const pathCoords = [];
        
        for (let i = 0; i < data.path.length - 1; i++) {
            const fromId = data.path[i];
            const toId = data.path[i+1];
            
            const fromLoc = findLocation(fromId);
            const toLoc = findLocation(toId);
            
            if (fromLoc && toLoc) {
                pathCoords.push([fromLoc.y, fromLoc.x]);
                pathCoords.push([toLoc.y, toLoc.x]);
                
                // Add markers for start and end
                if (i === 0) {
                    L.marker([fromLoc.y, fromLoc.x], {
                        icon: L.divIcon({
                            className: 'start-marker',
                            html: '🟢',
                            iconSize: [20, 20]
                        })
                    }).bindPopup(`<b>Start:</b> ${fromLoc.name}`)
                    .addTo(emergencyMap);
                }
                
                if (i === data.path.length - 2) {
                    L.marker([toLoc.y, toLoc.x], {
                        icon: L.divIcon({
                            className: 'hospital-marker',
                            html: '🏥',
                            iconSize: [20, 20]
                        })
                    }).bindPopup(`<b>Hospital:</b> ${toLoc.name}`)
                    .addTo(emergencyMap);
                }
            }
        }

        // Draw the path if we have coordinates
        if (pathCoords.length > 0) {
            L.polyline(pathCoords, {
                color: 'red',
                weight: 5,
                opacity: 0.7,
                dashArray: '10, 10'
            }).addTo(emergencyMap);

            // Fit bounds to show the entire path
            try {
                const bounds = L.latLngBounds(pathCoords);
                emergencyMap.fitBounds(bounds, {padding: [50, 50]});
            } catch (e) {
                console.error("Error fitting bounds:", e);
                emergencyMap.setView([30.04, 31.24], 11);
            }
        }
    } else {
        // Default view if no path
        emergencyMap.setView([30.04, 31.24], 11);
    }
}
function displaySignalResults(data) {
    const resultsDiv = document.getElementById('signal-results');
    resultsDiv.innerHTML = '';
    
    const html = `
        <div class="result-item">
            <h6>Optimized Traffic Signals</h6>
            <p><strong>Intersections Optimized:</strong> ${data.length}</p>
        </div>
        
        ${data.map(signal => `
            <div class="card mt-3">
                <div class="card-header">
                    <h6>${signal.intersection_name}</h6>
                </div>
                <div class="card-body">
                    <p><strong>Approaches:</strong> ${signal.approaches}</p>
                    <p><strong>Cycle Time:</strong> ${signal.cycle_time} seconds</p>
                    
                    <h6 class="mt-3">Signal Phases</h6>
                    ${signal.signal_phases.map(phase => `
                        <div class="signal-phase ${phase.emergency_priority ? 'emergency-priority' : ''}">
                            <strong>${phase.approach_name}</strong><br>
                            Green Time: ${phase.green_time.toFixed(1)} seconds<br>
                            Priority: ${phase.priority.toFixed(1)}
                            ${phase.emergency_priority ? '<br><span class="badge bg-danger">Emergency Priority</span>' : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('')}
    `;
    
    resultsDiv.innerHTML = html;
}

function updateSignalMap(data) {
    // Clear existing layers except base map
    signalMap.eachLayer(layer => {
        if (!layer._url) {  // Keep only tile layers
            signalMap.removeLayer(layer);
        }
    });
    
    // Add all roads (gray background)
    existingRoads.forEach(road => {
        const fromLoc = findLocation(road.from);
        const toLoc = findLocation(road.to);
        
        if (fromLoc && toLoc) {
            L.polyline(
                [[fromLoc.y, fromLoc.x], [toLoc.y, toLoc.x]],
                {color: 'gray', weight: 2, opacity: 0.5}
            ).addTo(signalMap);
        }
    });
    
    // Add optimized intersections
    data.forEach(signal => {
        const intersection = findLocation(signal.intersection);
        if (!intersection) return;
        
        // Create a pie chart for the signal phases
        let startAngle = 0;
        let endAngle = 0;
        
        signal.signal_phases.forEach(phase => {
            endAngle = startAngle + (phase.green_time / signal.cycle_time) * 360;
            
            const options = {
                stroke: false,
                color: phase.emergency_priority ? '#dc3545' : '#28a745',
                fillColor: phase.emergency_priority ? '#dc3545' : '#28a745',
                fillOpacity: 0.7,
                startAngle: startAngle,
                endAngle: endAngle,
                radius: 15
            };
            
            L.semiCircle([intersection.y, intersection.x], options)
                .bindPopup(`
                    <b>${signal.intersection_name}</b><br>
                    <b>${phase.approach_name}</b><br>
                    Green Time: ${phase.green_time.toFixed(1)}s<br>
                    Priority: ${phase.priority.toFixed(1)}
                `)
                .addTo(signalMap);
            
            startAngle = endAngle;
        });
        
        // Add intersection marker
        L.circleMarker([intersection.y, intersection.x], {
            radius: 5,
            fillColor: '#343a40',
            color: '#000',
            weight: 1,
            opacity: 1,
            fillOpacity: 1
        }).bindPopup(`<b>${signal.intersection_name}</b><br>Optimized traffic signals`)
        .addTo(signalMap);
    });
    
    // Fit bounds to show all optimized intersections
    if (data.length > 0) {
        const bounds = L.latLngBounds(
            data.map(signal => {
                const loc = findLocation(signal.intersection);
                return loc ? [loc.y, loc.x] : null;
            }).filter(Boolean)
        );
        signalMap.fitBounds(bounds, {padding: [50, 50]});
    }
}