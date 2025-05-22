import heapq
import math
from collections import defaultdict

class ShortestPathFinder:
    def __init__(self, cairo_data):
        self.data = cairo_data
        self.traffic_multipliers = {
            'morning': 1.5,  # 7-9 AM
            'afternoon': 1.2,  # 12-4 PM
            'evening': 1.7,  # 5-7 PM
            'night': 0.8    # 9 PM-6 AM
        }
        self.congestion_threshold = 0.8  # Threshold to consider road congested
        
    def find_shortest_path(self, start, end, time_of_day='morning', avoid_roads=None):
        return self._find_path(start, end, time_of_day, emergency=False, avoid_roads=avoid_roads)
    
    def emergency_route(self, start, end, time_of_day='morning'):
        return self._find_path(start, end, time_of_day, emergency=True)
    
    def find_alternate_routes(self, start, end, time_of_day='morning', closed_roads=None, count=3):
        """Find multiple alternate routes using Yen's algorithm"""
        routes = []
        avoid_roads = closed_roads or []
        
        # Get primary route
        primary_route = self._find_path(start, end, time_of_day, emergency=False, avoid_roads=avoid_roads)
        if primary_route.get('error'):
            return primary_route
        
        routes.append(primary_route)
        
        # Find alternate routes by temporarily removing road segments
        for i in range(count - 1):
            # Get the most congested segment from the current best route
            if len(primary_route['path']) > 2:
                congested_segment = self._find_most_congested_segment(primary_route['path_details']['steps'])
                avoid_roads.append(f"{congested_segment['from']}-{congested_segment['to']}")
            
            alt_route = self._find_path(start, end, time_of_day, emergency=False, avoid_roads=avoid_roads)
            if not alt_route.get('error') and alt_route['path'] != primary_route['path']:
                routes.append(alt_route)
                primary_route = alt_route
        
        return {
            'routes': routes,
            'primary': routes[0],
            'alternates': routes[1:] if len(routes) > 1 else [],
            'congestion_reduction': self._calculate_congestion_reduction(routes)
        }
    
    def _find_most_congested_segment(self, path_steps):
        """Find the segment with highest congestion in a path"""
        return max(path_steps, key=lambda x: x['congestion'])
    
    def _calculate_congestion_reduction(self, routes):
        """Calculate potential congestion reduction from alternate routes"""
        if len(routes) < 2:
            return 0
        
        primary_congestion = routes[0]['path_details']['average_congestion']
        avg_alternate_congestion = sum(
            r['path_details']['average_congestion'] for r in routes[1:]
        ) / len(routes[1:])
        
        reduction = (primary_congestion - avg_alternate_congestion) / primary_congestion
        return max(0, reduction * 100)  # Return as percentage
    
    def _find_path(self, start, end, time_of_day, emergency=False, avoid_roads=None):
        # Use Dijkstra's algorithm for standard routes, A* for emergency
        if emergency:
            return self._a_star_search(start, end, time_of_day, avoid_roads)
        else:
            return self._dijkstra_search(start, end, time_of_day, avoid_roads)
    
    def _dijkstra_search(self, start, end, time_of_day, avoid_roads=None):
        graph = self._prepare_graph(time_of_day, False, avoid_roads or [])
        
        start = str(start)
        end = str(end)
        
        if start not in graph or end not in graph:
            return {'path': [], 'distance': 0, 'time': 0, 'error': 'Invalid start or end location'}
        
        # Priority queue: (total_time, current_node, path)
        heap = []
        heapq.heappush(heap, (0, start, [start]))
        
        visited = set()
        distances = {node: float('inf') for node in graph}
        distances[start] = 0
        previous_nodes = {node: None for node in graph}
        
        while heap:
            current_time, current_node, path = heapq.heappop(heap)
            
            if current_node in visited:
                continue
                
            visited.add(current_node)
            
            if current_node == end:
                path_details = self._get_path_details(path, time_of_day, False)
                total_distance = path_details['total_distance']
                total_time = sum(step['time'] for step in path_details['steps']) if path_details['steps'] else 0
                
                return {
                    'path': path,
                    'distance': total_distance,
                    'time': total_time,
                    'path_details': path_details
                }
            
            for neighbor, edge_data in graph[current_node].items():
                if neighbor in visited:
                    continue
                    
                new_time = current_time + edge_data['weight']
                
                if new_time < distances[neighbor]:
                    distances[neighbor] = new_time
                    previous_nodes[neighbor] = current_node
                    heapq.heappush(heap, (new_time, neighbor, path + [neighbor]))
        
        return {'path': [], 'distance': 0, 'time': 0, 'error': 'No path found'}
    
    def _a_star_search(self, start, end, time_of_day, avoid_roads=None):
        graph = self._prepare_graph(time_of_day, True, avoid_roads or [])
        
        start = str(start)
        end = str(end)
        
        if start not in graph or end not in graph:
            return {'path': [], 'distance': 0, 'time': 0, 'error': 'Invalid start or end location'}
        
        open_set = []
        heapq.heappush(open_set, (0, start))
        
        came_from = {}
        g_score = {node: float('inf') for node in graph}
        g_score[start] = 0
        
        f_score = {node: float('inf') for node in graph}
        f_score[start] = self._heuristic(start, end)
        
        while open_set:
            _, current = heapq.heappop(open_set)
            
            if current == end:
                path = self._reconstruct_path(came_from, current)
                path_details = self._get_path_details(path, time_of_day, True)
                total_distance = path_details['total_distance']
                total_time = sum(step['time'] for step in path_details['steps']) if path_details['steps'] else 0
                
                return {
                    'path': path,
                    'distance': total_distance,
                    'time': total_time,
                    'path_details': path_details
                }
                
            for neighbor, edge_data in graph[current].items():
                tentative_g_score = g_score[current] + edge_data['weight']
                
                if tentative_g_score < g_score[neighbor]:
                    came_from[neighbor] = current
                    g_score[neighbor] = tentative_g_score
                    f_score[neighbor] = tentative_g_score + self._heuristic(neighbor, end)
                    heapq.heappush(open_set, (f_score[neighbor], neighbor))
        
        # Try again with relaxed constraints if no path found
        return self._dijkstra_search(start, end, time_of_day, avoid_roads)
    
    def _heuristic(self, a, b):
        """Euclidean distance heuristic for A* algorithm"""
        node_a = self.data.get_neighborhood(a) or self.data.get_facility(a)
        node_b = self.data.get_neighborhood(b) or self.data.get_facility(b)
        
        if node_a and node_b:
            dx = node_a['x'] - node_b['x']
            dy = node_a['y'] - node_b['y']
            return math.sqrt(dx*dx + dy*dy) / 50  # Approximate km with scaling factor
        return 0
    
    def _prepare_graph(self, time_of_day, emergency, avoid_roads=None):
        graph = defaultdict(dict)
        avoid_roads = avoid_roads or []
        
        # Add all nodes
        for loc in self.data.neighborhoods + self.data.facilities:
            graph[str(loc['id'])] = {}
        
        # Add all edges with time-dependent weights
        for road in self.data.existing_roads:
            from_id = str(road['from'])
            to_id = str(road['to'])
            road_id = f"{from_id}-{to_id}"
            
            if road_id in avoid_roads or f"{to_id}-{from_id}" in avoid_roads:
                continue
                
            traffic = self.data.get_road_traffic(from_id, to_id, time_of_day)
            capacity = road['capacity']
            congestion = min(traffic / capacity, 2.0)  # Cap congestion at 200%
            
            # Time-dependent traffic multiplier
            traffic_mult = self.traffic_multipliers.get(time_of_day, 1.0)
            congestion *= traffic_mult
            
            # Calculate speed
            if emergency:
                base_speed = 80  # km/h for emergency vehicles
                congestion_factor = max(0.4, 1 - (congestion * 0.3))  # 40-100% of speed
            else:
                base_speed = 30  # km/h for regular traffic
                congestion_factor = max(0.2, 1 - (congestion * 0.4))  # 20-100% of speed
            
            speed = base_speed * congestion_factor
            
            # Road condition penalty (1-10, 10 is best)
            condition_factor = 1 + ((10 - road['condition']) * 0.05)  # 1.0-1.45 multiplier
            
            # Calculate weight (time in hours)
            weight = (road['distance'] / speed) * condition_factor if speed > 0 else float('inf')
            
            # Add congestion penalty to discourage congested routes
            if congestion > self.congestion_threshold:
                weight *= 1 + (congestion - self.congestion_threshold) * 2
            
            # Add edge in both directions
            graph[from_id][to_id] = {
                'weight': weight,
                'distance': road['distance'],
                'traffic': traffic,
                'capacity': capacity,
                'condition': road['condition']
            }
            graph[to_id][from_id] = {
                'weight': weight,
                'distance': road['distance'],
                'traffic': traffic,
                'capacity': capacity,
                'condition': road['condition']
            }
        
        return graph
    
    def _reconstruct_path(self, came_from, current):
        path = [current]
        while current in came_from:
            current = came_from[current]
            path.append(current)
        path.reverse()
        return path
    
    def _get_path_details(self, path, time_of_day, emergency=False):
        details = []
        total_distance = 0
        valid_steps = 0

        for i in range(len(path) - 1):
            from_id = path[i]
            to_id = path[i+1]
            
            road = self.data.get_road_between(from_id, to_id)
            if not road:
                continue
                
            distance = road['distance']
            total_distance += distance
            
            traffic = self.data.get_road_traffic(from_id, to_id, time_of_day)
            capacity = road['capacity']
            congestion = min(traffic / capacity, 2.0)  # Cap at 200% congestion
            
            # Calculate time
            if emergency:
                speed = 80 * max(0.4, 1 - (congestion * 0.3))  # 40-100% of speed
            else:
                speed = 30 * max(0.2, 1 - (congestion * 0.4))  # 20-100% of speed
            
            condition_factor = 1 + ((10 - road['condition']) * 0.05)
            time = (distance / speed) * condition_factor * 60  # in minutes
            
            details.append({
                'from': from_id,
                'to': to_id,
                'from_name': self.data.get_location_name(from_id),
                'to_name': self.data.get_location_name(to_id),
                'distance': distance,
                'condition': road['condition'],
                'traffic': traffic,
                'capacity': capacity,
                'congestion': congestion,
                'time': time,
                'is_congested': congestion > self.congestion_threshold
            })
            valid_steps += 1

        return {
            'steps': details,
            'total_distance': total_distance,
            'average_congestion': sum(d['congestion'] for d in details) / valid_steps if valid_steps > 0 else 0,
            'congested_segments': sum(1 for d in details if d['is_congested'])
        }