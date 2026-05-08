# Use a more reliable Java 8 image
FROM amazoncorretto:8-al2-full

# Install wget
RUN yum install -y wget && yum clean all

WORKDIR /server

# 1. DOWNLOAD the engine
RUN wget -O paper-1.12.2.jar https://github.com

# 2. COPY your local files (run.sh, plugins, etc.)
COPY . .

# 3. Setup permissions and EULA
RUN chmod +x run.sh
RUN echo "eula=true" > eula.txt

# 4. Standard port for Render
EXPOSE 10000

# 5. Optimized Startup (Critical for 512MB RAM)
CMD ["java", "-Xmx400M", "-Xms400M", "-jar", "paper-1.12.2.jar", "nogui"]
