FROM amazoncorretto:17-al2-full

RUN yum install -y wget curl zip unzip && yum clean all
WORKDIR /server

# Download Paper 1.12.2
RUN wget -O paper-1.12.2.jar https://api.papermc.io/v2/projects/paper/versions/1.12.2/builds/1620/downloads/paper-1.12.2-1620.jar

# Copy your scripts and config
COPY . .

# Set up environment variables for the run script
# (You will set these in the Render Dashboard, not here!)
RUN chmod +x run.sh sync.sh
RUN echo "eula=true" > eula.txt

EXPOSE 10000

CMD ["./run.sh"]