

def read_env_file(file_path='config.env'):
    env_vars = {}
    try:
        with open(file_path, 'r') as file:
            for line in file:
                line = line.strip()
                if line and not line.startswith('#'):
                    key, value = line.split('=', 1)
                    env_vars[key.strip()] = value.strip()
    except OSError as e:
        print(f"Error reading env file: {e}")
    return env_vars