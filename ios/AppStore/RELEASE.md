# Remorse Chess iOS release

## App identity and signing

- Bundle ID `com.remorsechess.ios`, marketing version 1.0, build 1. Use the next unused build number for each upload.
- The app supports iPhone and iPad on iOS 17 or later. Archive with Xcode 26 or later and the iOS 26 SDK or later.
- Select the Apple Developer team that owns the Remorse Chess app record. Enable Associated Domains for its bundle identifier. Select that team in Xcode and let Xcode manage signing.
- Configure `IOS_APP_TEAM_ID` on the existing production Remorse Chess Worker when deploying the association endpoint. Verify `https://remorsechess.com/.well-known/apple-app-site-association` answers directly with JSON and names the signed app in both `webcredentials` and `applinks`. Keep the existing `LOBBY` and `ROOMS` namespaces and account secrets when deploying.
- Archive the Release scheme from Xcode with an iOS device destination. Upload the signed archive to the corresponding App Store Connect record, then confirm the processed build appears in TestFlight.

[Apple upload requirements](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds) · [Associated Domains](https://developer.apple.com/documentation/xcode/supporting-associated-domains)

## TestFlight acceptance checks

Use a physical iPhone and iPad with the signed build. For account checks, use an existing account you control that has a rating and a saved replay.

1. On the website, record the account's player ID, a current rating, and one existing game. Open Offline in the app with airplane mode enabled, finish a move, and verify the match reloads after relaunch.
2. In the app's Online tab, sign in with the existing account's passkey. Repeat with an existing password account and with an email sign-in link. Open an email link from Mail and a game invitation from another app to verify both links open in Remorse Chess.
3. From Online options, open Profile and game history and then Rating history. Verify the player ID, rating, and saved replay match the website. Switch to Offline and back and relaunch to confirm the Online session is still signed in.
4. Play a private online game with a consenting tester. Verify moves and dice rolls on both devices.

## App Store information

**Subtitle** · Chess with consequences

**Description**

Every first capture changes the game. Roll the die and adapt as pieces freeze, lose the ability to capture, or earn a second move. Use a bishop to help a piece recover before it is too late.

Play offline against the computer, share one device with a friend, or try a daily puzzle and 80 practice positions. Go online to play at RemorseChess.com with your existing account and access your ratings and game history.

**Keywords** · chess,dice,strategy,board game,puzzles,offline,multiplayer,pass and play

Use the checked-in [iPhone and iPad simulator screenshots](Screenshots/README.md).

## Before submitting for review

- Add an approved public privacy policy and support URL to App Store Connect. Disclose the data used by the live service and any sponsor ads loaded by the Online tab. The app's privacy manifest declares on-device settings access.
- The Online tab offers website signup. Apple requires an in-app way to initiate account deletion. This repository still needs that flow and a retention decision for shared match records before public submission.
- Provide App Review with a dedicated review account via the secure submission form. Use a working sign-in method reviewers can complete and confirm the production service remains available during review.

[Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) · [Account deletion requirement](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion/)
