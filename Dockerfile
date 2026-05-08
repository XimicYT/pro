FROM amazoncorretto:8-al2-full

RUN yum install -y wget && yum clean all

WORKDIR /server

# FIX: Use the correct direct download link for the JAR
RUN wget -O paper-1.12.2.jar "https://github.com"

COPY . .

RUN chmod +x run.sh
RUN echo "eula=true" > eula.txt

EXPOSE 10000

# Optimized Startup for Render Free Tier
CMD ["java", "-Xmx400M", "-Xms400M", "-jar", "paper-1.12.2.jar", "nogui"]
