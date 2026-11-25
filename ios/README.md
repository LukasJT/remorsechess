# Remorse Chess for iOS

Open [RemorseChess.xcodeproj](RemorseChess.xcodeproj) in Xcode, select the **RemorseChess** scheme and an iPhone or iPad simulator, then choose **Run**. The minimum OS is iOS 17. For a physical device, select your development team in **Signing & Capabilities**.

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

Use **Online options → Open game or email link** to paste a Remorse Chess invitation or email link into the app. **Online options → Online with a passkey** opens Apple’s in-app Safari browser for passkey users. Keep playing in that browser after sign-in because it uses a separate session from the main Online tab. The main Online tab supports the site’s email and password sign-in flows.

The production site currently has no Apple App Site Association (AASA) file. To enable passkeys in the main Online tab and open HTTPS invitation links directly from other apps, a future signed build needs the `webcredentials:remorsechess.com` and `applinks:remorsechess.com` Associated Domains entries. The site also needs an AASA file naming the signed Apple Team ID and bundle identifier. [Apple’s Associated Domains documentation](https://developer.apple.com/documentation/xcode/supporting-associated-domains) covers the server and signing setup.

## Engine

The native SwiftUI board runs the original rules v3, bot, and puzzle code via JavaScriptCore. The TypeScript files came from [LukasJT/remorsechess at a827043](https://github.com/LukasJT/remorsechess/tree/a8270430d9667b7178f0ecdda70e7383a1175303). The bundled script is checked in so Xcode builds without Node or a network connection.

After changing the TypeScript, regenerate the bundled script from this directory.

```sh
npx esbuild Engine/bridge.ts --bundle --format=iife --global-name=RemorseEngine --target=safari17 --outfile=Resources/RemorseEngine.js
```

## Artwork and typography

The app uses the [live Remorse Chess After Hours artwork and palette](https://remorsechess.com/). The engraved pieces are Sam Trenholme’s [public-domain Chess Tepoztlan artwork](https://github.com/samboy/ChessGraphics#tepoztlan), rasterized for the native board. The app wordmark uses the site’s horse artwork. The Chakra Petch and IBM Plex Mono font license texts are included in `Resources/Fonts`.
