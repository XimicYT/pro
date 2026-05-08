#!/bin/sh
# Render free tier limit is 512MB. We give Java 400MB to leave room for the OS.
java -Xmx400M -Xms400M -jar paper-1.12.2.jar nogui