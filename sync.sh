#!/bin/bash

# Usage: ./sync.sh download OR ./sync.sh upload
ACTION=$1

if [ "$ACTION" == "download" ]; then
    echo "Downloading world from Supabase..."
    curl -X GET "${SUPABASE_URL}/storage/v1/object/public/minecraft/world.zip" -o world.zip
    unzip -o world.zip
    rm world.zip
elif [ "$ACTION" == "upload" ]; then
    echo "Compressing and uploading world..."
    zip -r world.zip world/ world_nether/ world_the_end/
    curl -X POST "${SUPABASE_URL}/storage/v1/object/minecraft/world.zip" \
         -H "Authorization: Bearer ${SUPABASE_KEY}" \
         -H "Content-Type: application/zip" \
         -H "x-upsert: true" \
         --data-binary "@world.zip"
    rm world.zip
fi