import json
import os
from datetime import datetime
from threading import Lock

# Thread-safe lock for counter operations
counter_lock = Lock()

# Path to store analytics data
ANALYTICS_FILE = 'analytics_data.json'

def get_analytics_data():
    """Load analytics data from file, create if doesn't exist."""
    if not os.path.exists(ANALYTICS_FILE):
        default_data = {
            'data_generation_count': 0,
            'eda_operations_count': 0,
            'last_updated': datetime.now().isoformat()
        }
        save_analytics_data(default_data)
        return default_data
    
    try:
        with open(ANALYTICS_FILE, 'r') as f:
            return json.load(f)
    except (json.JSONDecodeError, FileNotFoundError):
        # If file is corrupted or missing, return default
        default_data = {
            'data_generation_count': 0,
            'eda_operations_count': 0,
            'last_updated': datetime.now().isoformat()
        }
        save_analytics_data(default_data)
        return default_data

def save_analytics_data(data):
    """Save analytics data to file."""
    data['last_updated'] = datetime.now().isoformat()
    with open(ANALYTICS_FILE, 'w') as f:
        json.dump(data, f, indent=2)

def increment_data_generation():
    """Increment the data generation counter."""
    with counter_lock:
        data = get_analytics_data()
        data['data_generation_count'] += 1
        save_analytics_data(data)
        return data['data_generation_count']

def increment_eda_operations():
    """Increment the EDA operations counter."""
    with counter_lock:
        data = get_analytics_data()
        data['eda_operations_count'] += 1
        save_analytics_data(data)
        return data['eda_operations_count']

def get_current_stats():
    """Get current analytics statistics."""
    data = get_analytics_data()
    return {
        'data_generations': data['data_generation_count'],
        'eda_operations': data['eda_operations_count'],
        'last_updated': data['last_updated']
    }

def reset_counters():
    """Reset all counters to zero (admin function)."""
    with counter_lock:
        data = {
            'data_generation_count': 0,
            'eda_operations_count': 0,
            'last_updated': datetime.now().isoformat()
        }
        save_analytics_data(data)
        return data
