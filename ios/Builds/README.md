# Compiled Remorse Chess build

[Download RemorseChess 1.0 for iOS Simulator](RemorseChess-1.0-iOS-Simulator.zip). This Release build contains Apple silicon and Intel Simulator executables and includes the board annotation feature. App Store distribution requires a signed device archive built from the [Xcode project](../README.md).

After extracting the ZIP, install the app on a running Simulator:

```sh
xcrun simctl install booted RemorseChess.app
xcrun simctl launch booted com.remorsechess.ios
```

SHA-256: `683bc268a2cba52b073707e97fda6b67d404469d4e1309543f968d5ff2ed3f13`
