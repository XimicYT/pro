#!/bin/bash

# 1. Pull the latest world from Supabase
./sync.sh download

# 2. Start the Minecraft Server
# We use a trap to catch when Render shuts down the service
trap './sync.sh upload; exit' SIGTERM

java -Xmx400M -Xms400M -jar paper-1.12.2.jar nogui &
JAVA_PID=$!

# Wait for the process
wait $JAVA_PID

# 3. Upload when the server stops naturally
./sync.sh upload