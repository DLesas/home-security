# Use the official Python image as a base
FROM python:3

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy the requirements file and install Python dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Install FFmpeg
RUN apt-get update && apt-get install -y ffmpeg && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Copy the rest of your application code
COPY . .

# Specify the command to run your application
CMD ["python", "./your-daemon-or-script.py"]
