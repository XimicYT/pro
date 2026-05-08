FROM openjdk:8-jre-slim

# Install necessary tools
RUN apt-get update && apt-get install -y wget && rm -rf /var/lib/apt/lists/*

# Create server directory
WORKDIR /server

# Download the files from the repo manually since we aren't forking
RUN wget https://github.com
RUN wget https://github.com
RUN wget https://github.com

# Copy plugins folder (if you want the default ones)
RUN mkdir plugins
RUN wget -P plugins/ https://github.com

# Setup Permissions
RUN chmod +x run.sh
RUN echo "eula=true" > eula.txt

# Render uses a dynamic port; Eaglercraft usually needs 25565
EXPOSE 25565

# Start the server with low RAM settings for Render Free Tier
CMD ["java", "-Xmx400M", "-Xms400M", "-jar", "paper-1.12.2.jar", "nogui"]
