import json
import os

class PersistentState:
    def __init__(self, filename="persistentState/state.json", device=None):
        """
        Initialize the PersistentState class.
        
        Args:
            filename (str): The JSON file to store persistent state
            device: The microDevice instance to check for read-only mode
        """
        self.filename = filename
        self.device = device
        self.state = {}
        self._ensure_directory_exists()
        self._load_state()
    
    def _ensure_directory_exists(self):
        """Ensure the directory for the persistent state file exists."""
        if self.device and self.device.read_only:
            print("Filesystem is read-only, skipping directory creation")
            return
            
        try:
            os.mkdir("persistentState")
        except OSError as e:
            print('failed to make dir in persistentState: ',e)
            pass
    
    def _load_state(self):
        """Load state from JSON file into the local dictionary."""
        try:
            with open(self.filename, 'r') as f:
                self.state = json.load(f)
                print(f"Loaded persistent state from {self.filename}")
        except OSError:
            # File doesn't exist, start with empty state
            self.state = {}
            print(f"No existing state file found, starting fresh")
        except ValueError as e:
            # JSON parsing error
            print(f"Error parsing JSON file: {e}")
            self.state = {}
    
    def _save_state(self):
        """Save the current state dictionary to the JSON file."""
        if self.device and self.device.read_only:
            print("Filesystem is read-only, cannot save state")
            return     
        try:
            with open(self.filename, 'w') as f:
                json.dump(self.state, f)
        except OSError as e:
            print(f"Error saving state to file: {e}")
            raise
    
    def add_persistent_state(self, key, value):
        """
        Add or update a persistent state value.
        
        Args:
            key (str): The key for the state
            value: The value to store (must be JSON serializable)
        """
        self.state[key] = value
        if self.device and self.device.read_only:
            print(f"Updated persistent state in memory (read-only): {key} = {value}")
        else:
            self._save_state()
            print(f"Added/updated persistent state: {key} = {value}")
    
    def remove_persistent_state(self, key):
        """
        Remove a persistent state value.
        
        Args:
            key (str): The key to remove
            
        Raises:
            KeyError: If the key doesn't exist in the state
        """
        if key not in self.state:
            raise KeyError(f"Persistent state key '{key}' not found")
        
        del self.state[key]
        if self.device and self.device.read_only:
            print(f"Removed persistent state from memory (read-only): {key}")
        else:
            self._save_state()
            print(f"Removed persistent state: {key}")
    
    def remove_all_persistent_states(self):
        """Remove all persistent state data."""
        self.state = {}
        if self.device and self.device.read_only:
            print("Removed all persistent states from memory (read-only)")
        else:
            self._save_state()
            print("Removed all persistent states")
    
    def get_state(self, key, default=None):
        """
        Get a state value.
        
        Args:
            key (str): The key to retrieve
            default: Default value if key doesn't exist
            
        Returns:
            The value associated with the key, or default if not found
        """
        return self.state.get(key, default)
    
    def has_state(self, key):
        """
        Check if a state key exists.
        
        Args:
            key (str): The key to check
            
        Returns:
            bool: True if key exists, False otherwise
        """
        return key in self.state
    
    def get_all_states(self):
        """
        Get a copy of all persistent states.
        
        Returns:
            dict: Copy of the current state dictionary
        """
        return self.state.copy()
    
    def print_all_states(self):
        """Print all current persistent states for debugging."""
        print("Current persistent states:")
        for key, value in self.state.items():
            print(f"  {key}: {value}")