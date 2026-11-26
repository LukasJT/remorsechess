# Remorse Chess iOS release

## App identity and signing

- The [RemorseChess.com App Store Connect record](https://appstoreconnect.apple.com/apps/6838933038/distribution) uses bundle ID `com.remorsechess.ios` on team `35F2V4A65C`. The project targets marketing version 1.0, build 1. Use the next unused build number for each upload.
- The app supports iPhone and iPad on iOS 17 or later. Archive with Xcode 26 or later and the iOS 26 SDK or later.
- Sign in to Xcode with access to the owning Apple Developer team. Automatic signing is already selected for the app target. Confirm the generated provisioning profile supports Associated Domains.
- The website serves the association as a static asset. Verify `https://remorsechess.com/.well-known/apple-app-site-association` returns JSON directly and lists the signed app in both `webcredentials` and `applinks`. Compare that identity with the `application-identifier` entitlement in the signed archive.
- Archive the Release scheme from Xcode with an iOS device destination. Upload the signed archive to the corresponding App Store Connect record, then confirm the processed build appears in TestFlight.

[Apple upload requirements](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds) · [Associated Domains](https://developer.apple.com/documentation/xcode/supporting-associated-domains)

## TestFlight acceptance checks

Use a physical iPhone and iPad with the signed build. For account checks, use an existing account you control that has a rating and a saved replay.

1. On the website, record the account's player ID, a current rating, and one existing game. Open Offline in the app with airplane mode enabled, finish a move, and verify the match reloads after relaunch.
2. In the app's Online tab, sign in with the existing account's passkey. Repeat with an existing password account and with an email sign-in link. Open an email link from Mail and a game invitation from another app to verify both links open in Remorse Chess.
3. From Online options, open Profile and game history and then Rating history. Verify the player ID, rating, and saved replay match the website. Switch to Offline and back and relaunch to confirm the Online session is still signed in.
4. Play a private online game with a consenting tester. Verify moves and dice rolls on both devices.
5. Create a disposable account and use Online options → Profile and game history → Delete account. Confirm that the app signs out, the receipt reports completion, and the original sign-in no longer works. Use a separate reviewer account for App Review.

## App Store information

**Subtitle** · Chess with consequences

**Description**

Every first capture changes the game. Roll the die and adapt as pieces freeze, lose the ability to capture, or earn a second move. Use a bishop to help a piece recover before it is too late.

Play offline against the computer, share one device with a friend, or try a daily puzzle and 80 practice positions. Go online to play at RemorseChess.com with your existing account and access your ratings and game history.

**Keywords** · chess,dice,strategy,board game,puzzles,offline,multiplayer,pass and play

Use the checked-in [iPhone, iPad, and iPhone Duo simulator screenshots](Screenshots/README.md). Verify the board and controls on both iPhone Duo displays when preparing with Xcode 27.1 or later.

## Before submitting for review

- Verify that the review changes are live on RemorseChess.com. Check that **Delete account** appears in Online options → Profile and game history and the Online tab excludes browser sponsor ads.
- Add the [privacy policy](https://remorsechess.com/privacy/) and [support page](https://remorsechess.com/support/) to App Store Connect after both are live and the owner has verified their contents. Complete App Privacy using the live service's actual practices. Inventory account identifiers, contact information, credentials, optional user content, gameplay and friends, and provider request logs. The privacy manifest describes the native app's use of local settings.
- Create a dedicated reviewer account on the live site with email and password access and a saved replay. Provide the login only in the App Review Information fields. Keep the account active throughout review. Provide a second disposable account if you want reviewers to test deletion without losing their main login.
- Verify the screenshots match the submitted app. Complete the age rating and export compliance questions with the account owner's verified answers. Select the processed build after the device checks and submit the version for review.

### Review notes

Offline opens a native chess board with computer opponents, same-device play, and puzzles. For online features, open Online and sign in using the email and password in the review credentials. Open Online options → Profile and game history to see a saved game, or Online options → Rating history to see ratings. The app and website share the same Remorse Chess account. To request deletion on a disposable account, open Online options → Profile and game history → Delete account within 15 minutes of signing in, type DELETE, and confirm. A receipt page shows the deletion status.

[Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) · [Account deletion requirement](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion/)
