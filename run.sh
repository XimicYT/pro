#!/bin/bash

# Only try to download if the file exists on Supabase to avoid unzip errors
./sync.sh download

# Optimization: -XX:MaxDirectMemorySize limits buffer overhead
# -XX:+UseSerialGC is actually BETTER for very small RAM (under 1GB)
java -Xmx350M -Xms350M -XX:+UseSerialGC -Dfile.encoding=UTF-8 -jar paper-1.12.2.jar nogui &
JAVA_PID=$!

trap './sync.sh upload; kill $JAVA_PID' SIGTERM
wait $JAVA_PID
./sync.sh upload