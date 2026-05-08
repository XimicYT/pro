FROM openjdk:8-jre-slim

# Install wget to download the heavy engine file
RUN apt-get update && apt-get install -y wget && rm -rf /var/lib/apt/lists/*

WORKDIR /server

# 1. DOWNLOAD the heavy Paper 1.12.2 engine directly so you don't have to upload it
RUN wget -O paper-1.12.2.jar https://github.com

# 2. COPY your local files (run.sh, plugins/EaglercraftXServer.jar, etc.)
COPY . .

# 3. Setup permissions and EULA
RUN chmod +x run.sh
RUN echo "eula=true" > eula.txt

# 4. Standard port for Render Web Services
EXPOSE 10000

# 5. Optimized Startup for 512MB RAM
CMD ["java", "-Xmx400M", "-Xms400M", "-jar", "paper-1.12.2.jar", "nogui"]
