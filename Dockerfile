FROM amazoncorretto:8-al2-full

RUN yum install -y wget && yum clean all

WORKDIR /server

# Download from your private Netlify mirror
RUN wget -O paper-1.12.2.jar "https://zippy-kitsune-232a22.netlify.app/paper-1.12.2.jar"

COPY . .

RUN chmod +x run.sh
RUN echo "eula=true" > eula.txt

EXPOSE 10000

# Optimized for 512MB RAM
CMD ["java", "-Xmx400M", "-Xms400M", "-jar", "paper-1.12.2.jar", "nogui"]
