# Upgrade to Java 17 to support the Eaglercraft plugin
FROM amazoncorretto:17-al2-full

RUN yum install -y wget && yum clean all

WORKDIR /server

# Download the engine from your Netlify mirror
RUN wget -O paper-1.12.2.jar "https://netlify.app"

COPY . .

RUN chmod +x run.sh
RUN echo "eula=true" > eula.txt

EXPOSE 10000

# Optimized Startup (Keeping 400M to avoid Render RAM crashes)
CMD ["java", "-Xmx400M", "-Xms400M", "-jar", "paper-1.12.2.jar", "nogui"]
