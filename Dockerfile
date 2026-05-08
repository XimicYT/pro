FROM openjdk:8-jre-slim

# Install wget to download the heavy files
RUN apt-get update && apt-get install -y wget && rm -rf /var/lib/apt/lists/*

WORKDIR /server

# 1. Download the heavy Paper 1.12.2 JAR directly from a mirror
RUN wget -O paper-1.12.2.jar https://github.com

# 2. Copy your small local files (run.sh and plugins)
COPY . .

# 3. Setup permissions and EULA
RUN chmod +x run.sh
RUN echo "eula=true" > eula.txt

# 4. Standard port for Render Web Services
EXPOSE 10000

# 5. Optimized Startup (Critical for Render's 512MB limit)
CMD ["java", "-Xmx400M", "-Xms400M", "-jar", "paper-1.12.2.jar", "nogui"]
