#!/bin/bash
# Check PM2 Health and Restart Missing Instances

echo "Checking PM2 instances health..."

# Expected instances
EXPECTED_INSTANCES=(13 14 15 16 17 18 19)

# Check each instance
for i in "${EXPECTED_INSTANCES[@]}"; do
  INSTANCE_NAME="instance-$i"

  # Check if instance exists and is online
  STATUS=$(pm2 describe $INSTANCE_NAME 2>/dev/null | grep "status" | grep "online" || echo "missing")

  if [[ "$STATUS" == *"missing"* ]]; then
    echo "⚠️  $INSTANCE_NAME is not running! Restarting..."
    pm2 restart ecosystem.workers.config.cjs --only $INSTANCE_NAME
  else
    echo "✅ $INSTANCE_NAME is online"
  fi
done

echo ""
echo "PM2 Health Check Complete!"
pm2 list
