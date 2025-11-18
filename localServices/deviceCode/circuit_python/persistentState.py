import json
import os
import microcontroller
import struct

class PersistentState:
    def __init__(self, filename="persistentState/state.json", device=None, use_nvm=False):
        """
        Initialize the PersistentState class.
        
        Args:
            filename (str): The JSON file to store persistent state (used if use_nvm=False)
            device: The microDevice instance to check for read-only mode
            use_nvm (bool): If True, use Non-Volatile Memory instead of JSON files
        """
        self.filename = filename
        self.device = device
        self.state = {}
        self.use_nvm = use_nvm
        
        if use_nvm:
            # Initialize NVM-specific attributes
            self.nvm = microcontroller.nvm if hasattr(microcontroller, 'nvm') else None
            if self.nvm is None:
                print("NVM not available on this board, falling back to file storage")
                self.use_nvm = False
            else:
                self.nvm_size = len(self.nvm)
                self.magic_header = b'NV01'  # Magic header to identify valid NVM data
                print(f"NVM initialized: {self.nvm_size} bytes available")
                self._load_state()
        else:
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
        """Load state from storage (NVM or JSON file) into the local dictionary."""
        if self.use_nvm:
            self._load_from_nvm()
        else:
            self._load_from_file()
    
    def _load_from_file(self):
        """Load state from JSON file."""
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
        except Exception as e:
            print(f"Error loading state: {e}")
            self.state = {}
    
    def _load_from_nvm(self):
        """Load state from NVM using a simple key-value format."""
        self.state = {}
        try:
            # Check magic header
            if self.nvm[0:4] != self.magic_header:
                print("NVM not initialized or corrupted, starting fresh")
                self._initialize_nvm()
                return
            
            # Read data length (stored after magic header)
            data_len = struct.unpack('<H', self.nvm[4:6])[0]
            
            if data_len > self.nvm_size - 6:
                print("NVM data length invalid, reinitializing")
                self._initialize_nvm()
                return
            
            # Read the JSON data
            json_data = bytes(self.nvm[6:6+data_len]).decode('utf-8')
            self.state = json.loads(json_data)
            
            print(f"Loaded {len(self.state)} items from NVM ({data_len} bytes used)")
            self._print_nvm_usage()
            
        except Exception as e:
            print(f"Error loading from NVM: {e}")
            self._initialize_nvm()
    
    def _initialize_nvm(self):
        """Initialize NVM with magic header and empty state."""
        self.state = {}
        self._save_to_nvm()
    
    def _save_state(self):
        """Save the current state dictionary to storage (NVM or file)."""
        if self.use_nvm:
            self._save_to_nvm()
        else:
            self._save_to_file()
    
    def _save_to_file(self):
        """Save state to JSON file."""
        if self.device and self.device.read_only:
            print("Filesystem is read-only, cannot save state")
            return     
        try:
            with open(self.filename, 'w') as f:
                json.dump(self.state, f)
        except OSError as e:
            print(f"Error saving state to file: {e}")
            raise
    
    def _save_to_nvm(self):
        """Save state to NVM using a compact format."""
        try:
            # Convert state to JSON string
            json_data = json.dumps(self.state, separators=(',', ':'))
            json_bytes = json_data.encode('utf-8')
            
            # Check if data fits in NVM (magic header + length + data)
            required_size = 4 + 2 + len(json_bytes)
            if required_size > self.nvm_size:
                print(f"Error: State too large for NVM ({required_size} > {self.nvm_size} bytes)")
                # Try to compact by removing less critical data
                self._compact_state()
                json_data = json.dumps(self.state, separators=(',', ':'))
                json_bytes = json_data.encode('utf-8')
                required_size = 4 + 2 + len(json_bytes)
                if required_size > self.nvm_size:
                    raise MemoryError(f"State still too large after compaction ({required_size} bytes)")
            
            # Write magic header
            self.nvm[0:4] = self.magic_header
            
            # Write data length
            self.nvm[4:6] = struct.pack('<H', len(json_bytes))
            
            # Write JSON data
            self.nvm[6:6+len(json_bytes)] = json_bytes
            
            print(f"Saved {len(self.state)} items to NVM ({len(json_bytes)} bytes used)")
            self._print_nvm_usage()
            
        except Exception as e:
            print(f"Error saving to NVM: {e}")
            raise
    
    def _compact_state(self):
        """Remove less critical data to save NVM space."""
        # This is a placeholder - implement based on your specific needs
        # For now, we'll keep only the most recent 10 items
        if len(self.state) > 10:
            # Sort by key and keep the most important ones
            # Prioritize certain keys like "armed", "fatal_error", etc.
            priority_keys = ["armed", "fatal_error", "device_id"]
            new_state = {}
            
            # Keep priority keys
            for key in priority_keys:
                if key in self.state:
                    new_state[key] = self.state[key]
            
            # Keep remaining keys up to limit
            for key, value in list(self.state.items())[-7:]:
                if key not in new_state:
                    new_state[key] = value
            
            self.state = new_state
            print(f"Compacted state to {len(self.state)} items")
    
    def _print_nvm_usage(self):
        """Print current NVM usage statistics."""
        if not self.use_nvm:
            return
        
        try:
            data_len = struct.unpack('<H', self.nvm[4:6])[0]
            used = 6 + data_len  # magic header + length + data
            free = self.nvm_size - used
            percent = (used / self.nvm_size) * 100
            print(f"NVM usage: {used}/{self.nvm_size} bytes ({percent:.1f}% used, {free} bytes free)")
        except:
            pass
    
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
        
        if self.use_nvm:
            self._print_nvm_usage()
    
    # NVM-specific helper methods for optimization
    def get_nvm_usage(self):
        """Get current NVM usage statistics."""
        if not self.use_nvm:
            return None
        
        try:
            data_len = struct.unpack('<H', self.nvm[4:6])[0]
            used = 6 + data_len
            return {
                'total': self.nvm_size,
                'used': used,
                'free': self.nvm_size - used,
                'percent': (used / self.nvm_size) * 100,
                'items': len(self.state)
            }
        except:
            return None
    
    def optimize_nvm_storage(self):
        """Manually trigger NVM optimization/compaction."""
        if not self.use_nvm:
            return
        
        print("Optimizing NVM storage...")
        self._compact_state()
        self._save_state()
    
    # Compatibility methods to match the old API names
    def add_nvm_state(self, key, value):
        """Alias for add_persistent_state when using NVM."""
        return self.add_persistent_state(key, value)
    
    def get_nvm_state(self, key, default=None):
        """Alias for get_state when using NVM."""
        return self.get_state(key, default)