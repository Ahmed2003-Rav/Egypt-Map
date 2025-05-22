# Smart Cairo Transportation Optimization

A web-based platform for optimizing Cairo's transportation network using advanced algorithms for road, public transit, and traffic signal planning. Visualize, analyze, and improve city mobility with interactive maps and real-time feedback.

---

## Features
- **Interactive Map**: Visualize Cairo's neighborhoods, facilities, and road network.
- **Network Design**: Optimize the road network using Minimum Spanning Tree (Prim's/Kruskal's) algorithms.
- **Shortest & Alternate Routes**: Find optimal and alternate routes considering real-time traffic (Dijkstra/A*).
- **Emergency Planning**: Plan fastest emergency vehicle routes.
- **Public Transit Optimization**: Dynamic programming for metro and bus schedules, transfers, and resource allocation.
- **Traffic Signal Optimization**: Greedy algorithm for intersection signal timing and emergency preemption.
- **Traffic Analysis**: Real-time traffic visualization and analysis.
- **Modern UI**: Responsive design with Bootstrap, Leaflet, and custom JavaScript.

---

## Tech Stack
- **Backend**: Python, Flask
- **Frontend**: HTML, CSS (Bootstrap), JavaScript (Leaflet, custom JS)
- **Algorithms**: MST, Dijkstra, A*, Dynamic Programming, Greedy
- **Data**: Simulated Cairo neighborhoods, facilities, roads, traffic, metro, and bus routes

---

## Installation
1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd EgyptMap/ago
   ```
2. Create and activate a virtual environment (Windows):
   ```bash
   python -m venv venv
   venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Run the application:
   ```bash
   python app.py
   ```
5. Open your browser and visit [http://localhost:5000](http://localhost:5000)

---

## Usage
- Use the navigation bar to access different modules:
  - **Network Design**: Optimize the road network.
  - **Traffic Flow**: Find best and alternate routes.
  - **Emergency Planning**: Plan emergency vehicle routes.
  - **Public Transit**: Optimize metro and bus schedules.
  - **Traffic Signals**: Optimize intersection timings.
- Visualize results and analytics on interactive maps.

---

## API Endpoints
- `GET /api/road_network` – Retrieve network data
- `POST /api/shortest_path` – Find shortest route
- `POST /api/optimize_network` – MST optimization
- `POST /api/optimize_transport` – Public transport optimization
- `POST /api/optimize_signals` – Traffic signal optimization
- `POST /api/emergency_route` – Emergency route planning
- `POST /api/alternate_routes` – Alternate route suggestions
- `POST /api/traffic_analysis` – Analyze traffic at a location

---

## Algorithms
- **Shortest Path**: Dijkstra's and A* (for emergencies)
- **MST**: Prim's and Kruskal's for network design
- **Public Transport**: Dynamic programming for schedules, transfers, and resource allocation
- **Traffic Signals**: Greedy optimization for green time allocation and emergency preemption

---

## Data Model
- **Neighborhoods**: Name, population, type, coordinates
- **Facilities**: Airports, hospitals, universities, etc.
- **Roads**: Existing and potential, with distance, capacity, condition
- **Metro Lines & Bus Routes**: Stations, stops, passenger data
- **Traffic Patterns**: Time-of-day traffic for each road

See [`data/cairo_data.py`](data/cairo_data.py) for details and customization.

---

## Customization
- Add or modify neighborhoods, facilities, or roads in `data/cairo_data.py`
- Extend or improve algorithms in the `algorithms/` directory
- Update frontend UI in `templates/` and `static/`

---

## Screenshots
(Add screenshots of the UI and maps here)

---

## License
(Specify your license here)

---

## Acknowledgements
- Inspired by real-world urban mobility challenges
- Built with Flask, Bootstrap, Leaflet, and open-source libraries 