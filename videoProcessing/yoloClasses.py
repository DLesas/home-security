yolo_classes = {
    # Transportation - Bright distinct colors
    0: {'name': "person", 'color': (0, 255, 0)},      # Bright green
    1: {'name': "bicycle", 'color': (255, 0, 255)},   # Magenta
    2: {'name': "car", 'color': (255, 0, 0)},         # Bright red
    3: {'name': "motorcycle", 'color': (255, 255, 0)}, # Yellow
    4: {'name': "airplane", 'color': (128, 0, 128)},   # Purple
    5: {'name': "bus", 'color': (0, 128, 255)},       # Light blue
    6: {'name': "train", 'color': (165, 42, 42)},     # Brown
    7: {'name': "truck", 'color': (0, 0, 255)},       # Bright blue
    8: {'name': "boat", 'color': (0, 255, 255)},      # Cyan
    
    # Traffic & Street
    9: {'name': "traffic light", 'color': (255, 140, 0)},    # Dark orange
    10: {'name': "fire hydrant", 'color': (220, 20, 60)},    # Crimson
    11: {'name': "stop sign", 'color': (255, 69, 0)},        # Red-orange
    12: {'name': "parking meter", 'color': (128, 128, 128)}, # Gray
    13: {'name': "bench", 'color': (139, 69, 19)},           # Saddle brown
    
    # Animals
    14: {'name': "bird", 'color': (0, 255, 127)},            # Spring green
    15: {'name': "cat", 'color': (218, 112, 214)},           # Orchid
    16: {'name': "dog", 'color': (160, 82, 45)},             # Sienna
    17: {'name': "horse", 'color': (255, 140, 0)},           # Dark orange
    18: {'name': "sheep", 'color': (255, 248, 220)},         # Cornsilk
    19: {'name': "cow", 'color': (210, 105, 30)},            # Chocolate
    20: {'name': "elephant", 'color': (169, 169, 169)},      # Dark gray
    21: {'name': "bear", 'color': (139, 69, 19)},            # Saddle brown
    22: {'name': "zebra", 'color': (112, 128, 144)},         # Slate gray
    23: {'name': "giraffe", 'color': (218, 165, 32)},        # Golden rod
    
    # Personal Items
    24: {'name': "backpack", 'color': (47, 79, 79)},         # Dark slate gray
    25: {'name': "umbrella", 'color': (25, 25, 112)},        # Midnight blue
    26: {'name': "handbag", 'color': (188, 143, 143)},       # Rosy brown
    27: {'name': "tie", 'color': (72, 61, 139)},             # Dark slate blue
    28: {'name': "suitcase", 'color': (199, 21, 133)},       # Medium violet red
    
    # Sports Equipment
    29: {'name': "frisbee", 'color': (32, 178, 170)},        # Light sea green
    30: {'name': "skis", 'color': (219, 112, 147)},          # Pale violet red
    31: {'name': "snowboard", 'color': (255, 182, 193)},     # Light pink
    32: {'name': "sports ball", 'color': (176, 224, 230)},   # Powder blue
    33: {'name': "kite", 'color': (127, 255, 212)},          # Aquamarine
    34: {'name': "baseball bat", 'color': (176, 196, 222)},  # Light steel blue
    35: {'name': "baseball glove", 'color': (230, 230, 250)},# Lavender
    36: {'name': "skateboard", 'color': (244, 164, 96)},     # Sandy brown
    37: {'name': "surfboard", 'color': (70, 130, 180)},      # Steel blue
    38: {'name': "tennis racket", 'color': (210, 180, 140)}, # Tan
    
    # Kitchen & Dining
    39: {'name': "bottle", 'color': (0, 206, 209)},          # Dark turquoise
    40: {'name': "wine glass", 'color': (147, 112, 219)},    # Medium purple
    41: {'name': "cup", 'color': (60, 179, 113)},            # Medium sea green
    42: {'name': "fork", 'color': (186, 85, 211)},           # Medium orchid
    43: {'name': "knife", 'color': (123, 104, 238)},         # Medium slate blue
    44: {'name': "spoon", 'color': (0, 250, 154)},           # Medium spring green
    45: {'name': "bowl", 'color': (72, 209, 204)},           # Medium turquoise
    
    # Food
    46: {'name': "banana", 'color': (238, 232, 170)},        # Pale goldenrod
    47: {'name': "apple", 'color': (152, 251, 152)},         # Pale green
    48: {'name': "sandwich", 'color': (222, 184, 135)},      # Burlywood
    49: {'name': "orange", 'color': (255, 160, 122)},        # Light salmon
    50: {'name': "broccoli", 'color': (34, 139, 34)},        # Forest green
    51: {'name': "carrot", 'color': (255, 127, 80)},         # Coral
    52: {'name': "hot dog", 'color': (233, 150, 122)},       # Dark salmon
    53: {'name': "pizza", 'color': (240, 128, 128)},         # Light coral
    54: {'name': "donut", 'color': (255, 192, 203)},         # Pink
    55: {'name': "cake", 'color': (221, 160, 221)},          # Plum
    
    # Furniture & Appliances
    56: {'name': "chair", 'color': (176, 48, 96)},           # Maroon
    57: {'name': "couch", 'color': (95, 158, 160)},          # Cadet blue
    58: {'name': "potted plant", 'color': (46, 139, 87)},    # Sea green
    59: {'name': "bed", 'color': (205, 92, 92)},             # Indian red
    60: {'name': "dining table", 'color': (205, 133, 63)},   # Peru
    61: {'name': "toilet", 'color': (240, 230, 140)},        # Khaki
    62: {'name': "tv", 'color': (100, 149, 237)},            # Cornflower blue
    63: {'name': "laptop", 'color': (143, 188, 143)},        # Dark sea green
    64: {'name': "mouse", 'color': (216, 191, 216)},         # Thistle
    65: {'name': "remote", 'color': (255, 250, 205)},        # Light yellow
    66: {'name': "keyboard", 'color': (238, 130, 238)},      # Violet
    67: {'name': "cell phone", 'color': (154, 205, 50)},     # Yellow green
    68: {'name': "microwave", 'color': (135, 206, 250)},     # Light sky blue
    69: {'name': "oven", 'color': (106, 90, 205)},           # Slate blue
    70: {'name': "toaster", 'color': (255, 99, 71)},         # Tomato
    71: {'name': "sink", 'color': (119, 136, 153)},          # Light slate gray
    72: {'name': "refrigerator", 'color': (173, 255, 47)},   # Green yellow
    
    # Miscellaneous
    73: {'name': "book", 'color': (240, 248, 255)},          # Alice blue
    74: {'name': "clock", 'color': (250, 235, 215)},         # Antique white
    75: {'name': "vase", 'color': (127, 255, 0)},            # Chartreuse
    76: {'name': "scissors", 'color': (64, 224, 208)},       # Turquoise
    77: {'name': "teddy bear", 'color': (216, 191, 216)},    # Thistle
    78: {'name': "hair drier", 'color': (255, 228, 225)},    # Misty rose
    79: {'name': "toothbrush", 'color': (245, 222, 179)},    # Wheat
}
