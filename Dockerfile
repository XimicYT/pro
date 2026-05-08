FROM amazoncorretto:17-al2-full

RUN yum install -y wget curl zip unzip && yum clean all
WORKDIR /server

# Download Paper
RUN wget -O paper-1.12.2.jar https://api.papermc.io/v2/projects/paper/versions/1.12.2/builds/1620/downloads/paper-1.12.2-1620.jar

# RUN THE JAR ONCE DURING BUILD to let it patch itself and expand
# This keeps the "Vanilla Download" out of the production RAM
RUN java -Xmx400M -jar paper-1.12.2.jar init || true

COPY . .
RUN chmod +x run.sh sync.sh
RUN echo "eula=true" > eula.txt

EXPOSE 10000
CMD ["./run.sh"]