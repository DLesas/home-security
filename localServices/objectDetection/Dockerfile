# Object Detection Service Dockerfile
# YOLO-based object detection with GPU support via PyTorch CUDA
#
# GPU Requirements (must be installed separately on host):
# 1. NVIDIA GPU drivers
# 2. NVIDIA Container Toolkit - NOT included with Docker, install separately:
#    https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html
# 3. Run container with: --gpus all
#
# CPU Fallback: If no GPU detected, PyTorch automatically uses CPU (slower inference)

FROM python:3.11-slim

# Install system dependencies for OpenCV headless
RUN apt-get update && apt-get install -y \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    libgl1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy and install requirements
COPY requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

# Create weights directory for YOLO models
RUN mkdir -p /app/models/weights

# Copy application source
COPY src/ .

CMD ["python3", "main.py"]
