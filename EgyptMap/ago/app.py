from flask import Flask, render_template, jsonify, request
from data.cairo_data import CairoData
from algorithms.shortest_path import ShortestPathFinder
from algorithms.mst import MSTOptimizer
from algorithms.dynamic_prog import PublicTransportOptimizer
from algorithms.greedy import TrafficSignalOptimizer

app = Flask(__name__)

# Initialize data
cairo_data = CairoData()
cairo_data.load_data()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/road_network', methods=['GET'])
def get_road_network():
    try:
        return jsonify({
            'neighborhoods': cairo_data.neighborhoods,
            'facilities': cairo_data.facilities,
            'existing_roads': cairo_data.existing_roads,
            'potential_roads': cairo_data.potential_roads
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/shortest_path', methods=['POST'])
def find_shortest_path():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
            
        start = data.get('start')
        end = data.get('end')
        time_of_day = data.get('time_of_day', 'morning')
        
        # Validate inputs
        if not start or not end:
            return jsonify({'error': 'Missing start or end location'}), 400
        
        if str(start) == str(end):
            return jsonify({'error': 'Start and end locations cannot be the same'}), 400
        
        # Check if locations exist
        if not cairo_data.location_exists(start):
            return jsonify({'error': f'Start location ID {start} not found'}), 404
        
        if not cairo_data.location_exists(end):
            return jsonify({'error': f'End location ID {end} not found'}), 404
        
        path_finder = ShortestPathFinder(cairo_data)
        result = path_finder.find_shortest_path(str(start), str(end), time_of_day)
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({'error': f'Failed to calculate path: {str(e)}'}), 500

@app.route('/api/optimize_network', methods=['POST'])
def optimize_network():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
            
        optimizer = MSTOptimizer(cairo_data)
        result = optimizer.optimize_network(
            use_prim=data.get('algorithm', 'prim') == 'prim',
            prioritize_population=data.get('prioritize_population', True)
        )
        return jsonify(result)
        
    except Exception as e:
        return jsonify({'error': f'Network optimization failed: {str(e)}'}), 500

@app.route('/api/optimize_transport', methods=['POST'])
def optimize_transport():
    try:
        print("Starting transport optimization...")
        optimizer = PublicTransportOptimizer(cairo_data)
        print("Running optimization algorithm...")
        result = optimizer.optimize_transport()
        print("Optimization completed successfully")
        
        # Check if we got a dictionary result
        if not isinstance(result, dict):
            print(f"Warning: Expected dictionary result but got {type(result)}. Converting to empty dict.")
            result = {}
            
        # Debug print result structure
        print(f"Result keys: {result.keys() if isinstance(result, dict) else 'None'}")
        
        # Check if we got status from the optimizer result
        status = result.get('status', 'success')
        data = result.get('data', {})
        
        if status == 'error':
            print(f"Error from optimizer: {result.get('message', 'Unknown error')}")
            return jsonify(result), 500
            
        # Prepare response data with defaults
        response_data = {
            'metro': data.get('metro', []),
            'bus': data.get('bus', []),
            'transfers': data.get('transfers', {'all_transfers': {}, 'top_transfers': []}),
            'resources': data.get('resources', {'metro': [], 'bus': [], 'total_metro_trains': 0, 'total_buses': 0}),
            'improvement': data.get('improvement', {'total': 0.15, 'metro': 0.2, 'bus': 0.1}),
            'network': data.get('network', {'nodes': [], 'edges': [], 'transfer_points': []}),
            'coverage': data.get('coverage', {
                'population_covered': 0,
                'total_population': sum(n['population'] for n in cairo_data.neighborhoods),
                'coverage_percentage': 0,
                'metro_stations': len(set().union(*[set(line['stations']) for line in cairo_data.metro_lines])),
                'bus_stops': len(set().union(*[set(route['stops']) for route in cairo_data.bus_routes]))
            }),
            'travel_times': data.get('travel_times', {
                'average_time': 30,
                'travel_times': [],
                'num_pairs': 0
            }),
            'locations': {**{str(n['id']): n for n in cairo_data.neighborhoods}, 
                         **{f['id']: f for f in cairo_data.facilities}},
            'metro_lines': cairo_data.metro_lines,
            'bus_routes': cairo_data.bus_routes
        }
        
        print("Sending success response")
        return jsonify({
            'status': 'success',
            'data': response_data
        })
        
    except Exception as e:
        import traceback
        error_traceback = traceback.format_exc()
        print(f"Optimization error: {str(e)}")
        print(f"Traceback: {error_traceback}")
        
        return jsonify({
            'status': 'error',
            'message': str(e),
            'traceback': error_traceback,
            'data': {
                'metro': [],
                'bus': [],
                'transfers': {'all_transfers': {}, 'top_transfers': []},
                'resources': {'metro': [], 'bus': [], 'total_metro_trains': 0, 'total_buses': 0},
                'improvement': {'total': 0, 'metro': 0, 'bus': 0},
                'network': {'nodes': [], 'edges': [], 'transfer_points': []},
                'coverage': {
                    'population_covered': 0,
                    'total_population': sum(n['population'] for n in cairo_data.neighborhoods),
                    'coverage_percentage': 0,
                    'metro_stations': 0,
                    'bus_stops': 0
                },
                'travel_times': {
                    'average_time': 0,
                    'travel_times': [],
                    'num_pairs': 0
                },
                'locations': {},
                'metro_lines': [],
                'bus_routes': []
            }
        }), 500

@app.route('/api/optimize_signals', methods=['POST'])
def optimize_signals():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
            
        optimizer = TrafficSignalOptimizer(cairo_data)
        result = optimizer.optimize_signals(
            intersections=data.get('intersections', []),
            time_of_day=data.get('time_of_day', 'morning')
        )
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': f'Signal optimization failed: {str(e)}'}), 500

@app.route('/api/emergency_route', methods=['POST'])
def find_emergency_route():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
            
        start = data.get('start')
        end = data.get('end')
        time_of_day = data.get('time_of_day', 'morning')
        
        # Validate inputs
        if not start or not end:
            return jsonify({'error': 'Missing start or end location'}), 400
        
        if str(start) == str(end):
            return jsonify({'error': 'Start and end locations cannot be the same'}), 400
        
        # Check if locations exist
        if not cairo_data.location_exists(start):
            return jsonify({'error': f'Start location ID {start} not found'}), 404
        
        if not cairo_data.location_exists(end):
            return jsonify({'error': f'End location ID {end} not found'}), 404
        
        # Verify end is a medical facility
        end_facility = cairo_data.get_facility(end)
        if not end_facility or 'Medical' not in end_facility['type']:
            return jsonify({'error': 'Destination must be a medical facility'}), 400
        
        path_finder = ShortestPathFinder(cairo_data)
        result = path_finder.emergency_route(str(start), str(end), time_of_day)
        
        # Validate path coordinates
        if result.get('path'):
            path_coords = []
            for loc_id in result['path']:
                loc = cairo_data.get_neighborhood(loc_id) or cairo_data.get_facility(loc_id)
                if loc:
                    path_coords.append({'lat': loc['y'], 'lng': loc['x']})
            result['path_coords'] = path_coords
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({'error': f'Failed to calculate emergency route: {str(e)}'}), 500

@app.route('/api/alternate_routes', methods=['POST'])
def find_alternate_routes():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
            
        start = data.get('start')
        end = data.get('end')
        time_of_day = data.get('time_of_day', 'morning')
        closed_roads = data.get('closed_roads', [])
        
        # Validate inputs
        if not start or not end:
            return jsonify({'error': 'Missing start or end location'}), 400
        
        if str(start) == str(end):
            return jsonify({'error': 'Start and end locations cannot be the same'}), 400
        
        # Check if locations exist
        if not cairo_data.location_exists(start):
            return jsonify({'error': f'Start location ID {start} not found'}), 404
        
        if not cairo_data.location_exists(end):
            return jsonify({'error': f'End location ID {end} not found'}), 404
        
        path_finder = ShortestPathFinder(cairo_data)
        result = path_finder.find_alternate_routes(
            str(start), str(end), 
            time_of_day=time_of_day,
            closed_roads=closed_roads
        )
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({'error': f'Failed to calculate alternate routes: {str(e)}'}), 500

@app.route('/api/traffic_analysis', methods=['POST'])
def analyze_traffic():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
            
        time_of_day = data.get('time_of_day', 'morning')
        location = data.get('location')
        
        if not location:
            return jsonify({'error': 'Location is required'}), 400
        
        path_finder = ShortestPathFinder(cairo_data)
        
        # Get all connected roads
        connected_roads = []
        for road in cairo_data.existing_roads:
            if str(road['from']) == str(location) or str(road['to']) == str(location):
                traffic = cairo_data.get_road_traffic(
                    str(road['from']), 
                    str(road['to']), 
                    time_of_day
                )
                capacity = road['capacity']
                congestion = traffic / capacity
                
                connected_roads.append({
                    'from': road['from'],
                    'to': road['to'],
                    'from_name': cairo_data.get_location_name(road['from']),
                    'to_name': cairo_data.get_location_name(road['to']),
                    'traffic': traffic,
                    'capacity': capacity,
                    'congestion': congestion,
                    'is_congested': congestion > path_finder.congestion_threshold
                })
        
        # Calculate congestion statistics
        total_roads = len(connected_roads)
        congested_roads = sum(1 for r in connected_roads if r['is_congested'])
        congestion_percentage = (congested_roads / total_roads * 100) if total_roads > 0 else 0
        
        return jsonify({
            'location': {
                'id': location,
                'name': cairo_data.get_location_name(location)
            },
            'time_of_day': time_of_day,
            'connected_roads': connected_roads,
            'congestion_stats': {
                'total_roads': total_roads,
                'congested_roads': congested_roads,
                'congestion_percentage': congestion_percentage,
                'average_congestion': sum(r['congestion'] for r in connected_roads) / total_roads if total_roads > 0 else 0
            },
            'recommendations': _generate_congestion_recommendations(connected_roads)
        })
        
    except Exception as e:
        return jsonify({'error': f'Traffic analysis failed: {str(e)}'}), 500

def _generate_congestion_recommendations(roads):
    recommendations = []
    congested_roads = [r for r in roads if r['is_congested']]
    
    if not congested_roads:
        return ["No significant congestion detected in this area"]
    
    # Group by highest congestion
    most_congested = max(congested_roads, key=lambda x: x['congestion'])
    recommendations.append(
        f"Avoid {most_congested['from_name']} to {most_congested['to_name']} "
        f"(congestion: {(most_congested['congestion'] * 100):.1f}%)"
    )
    
    # Check if there are alternative routes
    if len(roads) > 1:
        least_congested = min(roads, key=lambda x: x['congestion'])
        if least_congested['congestion'] < 0.5:  # Only recommend if significantly better
            recommendations.append(
                f"Consider using {least_congested['from_name']} to {least_congested['to_name']} "
                f"as alternative (congestion: {(least_congested['congestion'] * 100):.1f}%)"
            )
    
    # General recommendations based on congestion level
    avg_congestion = sum(r['congestion'] for r in congested_roads) / len(congested_roads)
    if avg_congestion > 1.0:
        recommendations.append("This area is experiencing severe congestion. Consider delaying travel if possible.")
    elif avg_congestion > 0.8:
        recommendations.append("This area is experiencing heavy congestion. Expect delays.")
    
    return recommendations

if __name__ == '__main__':
    app.run(debug=True)