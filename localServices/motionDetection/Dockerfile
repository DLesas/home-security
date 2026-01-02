# Motion Detection Service Dockerfile
# Supports both CPU and GPU via build argument
# Set USE_GPU=true in .env for GPU support, or USE_GPU=false for CPU (default)

ARG USE_GPU=false

# ============================================================================
# Stage 1: GPU Base (Ubuntu 20.04, CUDA 11.3.1, OpenCV 4.6.0 with CUDA)
# ============================================================================
FROM datamachines/cudnn_tensorflow_opencv:11.3.1_2.9.1_4.6.0-20220815 AS base-true

# ============================================================================
# Stage 2: CPU Base (Python 3.11 slim)
# ============================================================================
FROM python:3.11-slim AS base-false

# Install system dependencies for OpenCV
RUN apt-get update && apt-get install -y \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    libgl1 \
    && rm -rf /var/lib/apt/lists/*

# ============================================================================
# Stage 3: Final - Select base based on USE_GPU argument
# ============================================================================
FROM base-${USE_GPU} AS final

# Set USE_GPU as environment variable for runtime reference
ARG USE_GPU
ENV USE_GPU=${USE_GPU}

WORKDIR /app

# Copy requirements
COPY requirements.txt .

# Install base dependencies (redis, numpy, etc.) from requirements.txt
# These are needed for both CPU and GPU builds
RUN pip3 install --no-cache-dir -r requirements.txt

# Conditionally install opencv-python ONLY for CPU build
# GPU build already has OpenCV with CUDA support in base image
RUN if [ "$USE_GPU" = "false" ]; then \
      echo "Building CPU version - installing opencv-python"; \
      pip3 install --no-cache-dir opencv-python>=4.8.0; \
    else \
      echo "Building GPU version - using pre-installed OpenCV with CUDA"; \
    fi

# Copy application source
COPY src/ .

# Python runtime will auto-detect GPU:
# - If GPU available: Uses CUDA (3-5ms per frame)
# - If no GPU: Falls back to CPU (10-15ms per frame)

CMD ["python3", "main.py"]
