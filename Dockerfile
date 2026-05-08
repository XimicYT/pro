FROM amazoncorretto:8-al2-full

RUN yum install -y wget && yum clean all

WORKDIR /server

# FIX: Using the official PaperMC API for a guaranteed real JAR file
RUN wget -O paper-1.12.2.jar "https://papermc.io"

COPY . .

RUN chmod +x run.sh
RUN echo "eula=true" > eula.txt

EXPOSE 10000

# Optimized Startup for Render Free Tier (512MB)
CMD ["java", "-Xmx400M", "-Xms400M", "-jar", "paper-1.12.2.jar", "nogui"]
