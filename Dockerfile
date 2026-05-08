FROM amazoncorretto:8-al2-full

RUN yum install -y wget && yum clean all

WORKDIR /server

# FORCE CLEAR: Download the actual 30MB file from the official build server
RUN wget --no-check-certificate -O paper-1.12.2.jar "https://papermc.io"

COPY . .

RUN chmod +x run.sh
RUN echo "eula=true" > eula.txt

EXPOSE 10000

# Strict 400MB limit to fit Render's 512MB free tier
CMD ["java", "-Xmx400M", "-Xms400M", "-jar", "paper-1.12.2.jar", "nogui"]
