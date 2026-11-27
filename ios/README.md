# Remorse Chess for iOS

Open [RemorseChess.xcodeproj](RemorseChess.xcodeproj) in Xcode 26 or later, select the **RemorseChess** scheme and an iPhone or iPad simulator, then choose **Run**. The minimum device OS is iOS 17. A physical device or a TestFlight upload requires the project's Apple Developer team. See the [release guide](AppStore/RELEASE.md) for signing and device checks.


[Download the compiled iOS Simulator build](Builds/README.md)

## App Store assets

[App Store screenshots and upload sizes](AppStore/Screenshots/README.md)

The app target uses bundle ID `com.remorsechess.ios` and version `1.0`. For a simulator build from the repository root:

```sh
xcodebuild -project ios/RemorseChess.xcodeproj -scheme RemorseChess \
  -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
```

## Online and offline

**Online** opens the live mobile site inside the app. It uses the production server and the website’s existing screens for matchmaking, private games, ranked and daily games, accounts, friends, watching, puzzles, openings, and study. The site session stays in the app when switching tabs. The live lobby starts with timed presets visible. Select **Any popular clock** to use flexible matchmaking.

**Offline** runs a native board with three computer levels, same-device pass-and-play, a daily puzzle, and 80 practice positions. The local engine and artwork are bundled, and the current match and solved puzzles are saved on the device.

The Online tab uses the existing RemorseChess.com account directly. Sign in with the same method you use on the site to load the same profile, ratings, and game history. **Online options** links directly to **Profile and game history** and **Rating history**. Use **Open game or email link** to paste a Remorse Chess invitation or email link into the app.

The Xcode target includes the `webcredentials:remorsechess.com` and `applinks:remorsechess.com` entitlements. The website’s Apple App Site Association file links the production domain to the signed app. Apple uses that association for passkeys in the Online tab and to route invitation and email links. **Open in Safari view** offers a separate browsing session during development. [Apple’s Associated Domains documentation](https://developer.apple.com/documentation/xcode/supporting-associated-domains)

## Board annotations

Right-click a square to highlight it, or right-drag between squares to draw an arrow. Shift adds green, Alt/Option adds blue, and Ctrl swaps the default highlight and arrow colors. A normal board click clears the marks.

On touchscreens, select **Draw**, then tap a square or drag between squares. Use **Clear marks** to erase the annotations. The marks stay on your device.

## Engine

The native SwiftUI board runs the original rules v3, bot, and puzzle code via JavaScriptCore. The TypeScript files came from [LukasJT/remorsechess at a827043](https://github.com/LukasJT/remorsechess/tree/a8270430d9667b7178f0ecdda70e7383a1175303). The bundled script is checked in so Xcode builds without Node or a network connection.

After changing the TypeScript, regenerate the bundled script from this directory.

```sh
npx esbuild Engine/bridge.ts --bundle --format=iife --global-name=RemorseEngine --target=safari17 --outfile=Resources/RemorseEngine.js
```

## Artwork and typography

The app uses the [live Remorse Chess After Hours artwork and palette](https://remorsechess.com/). The engraved pieces are Sam Trenholme’s [public-domain Chess Tepoztlan artwork](https://github.com/samboy/ChessGraphics#tepoztlan), rasterized for the native board. The app wordmark uses the site’s horse artwork. The Chakra Petch and IBM Plex Mono font license texts are included in `Resources/Fonts`.
