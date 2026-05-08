FROM amazoncorretto:17-al2-full

RUN yum install -y wget && yum clean all
WORKDIR /server

# 1. Download Paper 1.12.2 (Build 1620 is the stable final for 1.12.2)
RUN wget -O paper-1.12.2.jar https://api.papermc.io/v2/projects/paper/versions/1.12.2/builds/1620/downloads/paper-1.12.2-1620.jar

# 2. Pre-accept EULA
RUN echo "eula=true" > eula.txt

# 3. Copy your local files (plugins folder, world folder, server.properties)
COPY . .

# 4. Fix permissions
RUN chmod +x run.sh

# Render looks for traffic on 10000
EXPOSE 10000

CMD ["./run.sh"]