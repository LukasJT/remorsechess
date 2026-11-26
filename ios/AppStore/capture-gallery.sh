#!/bin/bash
set -euo pipefail

platform=$1
output="$RUNNER_TEMP/gallery-images"
app="$RUNNER_TEMP/store-gallery/Build/Products/Release-iphonesimulator/RemorseChess.app"
bundle=com.remorsechess.ios
mkdir -p "$output"

case "$platform" in
  iphone) name="iPhone 17"; runtime="27-0" ;;
  iphone-large) name="iPhone 18 Pro Max"; runtime="27-0" ;;
  ipad) name="iPad Pro 13-inch (M5)"; runtime="27-0" ;;
  duo) name="iPhone Duo"; runtime="27-1" ;;
esac

device=$(xcrun simctl list devices available -j | jq -er \
  --arg device "$name" --arg runtime "com.apple.CoreSimulator.SimRuntime.iOS-$runtime" \
  '.devices[$runtime] | map(select(.name == $device)) | first | .udid // error("Requested simulator was absent")')
xcrun simctl bootstatus "$device" -b
xcrun simctl status_bar "$device" override --time "9:41" --dataNetwork wifi --wifiMode active --wifiBars 3 --batteryState unplugged --batteryLevel 100 || true
xcrun simctl install "$device" "$app"

launch_scene() {
  SIMCTL_CHILD_REMORSE_GALLERY_SCENE=$1 xcrun simctl launch --terminate-running-process "$device" "$bundle"
  sleep 3
}

if [ "$platform" != duo ]; then
  for scene in capture beginner puzzle friends; do
    launch_scene "$scene"
    xcrun simctl io "$device" screenshot "$output/$scene.png"
  done
  exit
fi

xcrun simctl io "$device" enumerate
git clone -q https://github.com/skarol/duoctl.git "$RUNNER_TEMP/duoctl"
git -C "$RUNNER_TEMP/duoctl" checkout -q c6ff3e961a9858fb061907448e702d7d1617dc4a
duoctl="$RUNNER_TEMP/duoctl/bin/duoctl"
launch_scene capture
for panel in outer inner; do
  if [ "$panel" = outer ]; then
    "$duoctl" -d "$device" close
  else
    "$duoctl" -d "$device" open
  fi
  for scene in capture puzzle friends; do
    launch_scene "$scene"
    "$duoctl" -d "$device" screenshot "$output/$panel-$scene.png"
  done
done
