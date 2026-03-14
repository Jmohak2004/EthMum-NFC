## 📲 How to Get the Android APK

Since your project uses `react-native-nfc-manager` (which contains custom native code), you cannot use the standard Expo Go app or a simple JS bundle. You need a fully compiled Android APK.

Here is the easiest way to generate it so you can download and install it on your Android phone.

### Option 1: Build the APK in the Cloud (Easiest)
Expo provides free cloud servers to build your app for you.

1. Open your terminal in the `EthMum-NFC` folder.
2. Run this command:
   ```bash
   npx eas-cli build -p android --profile preview
   ```
3. **Log in:** It will ask you to log in to your Expo account (create a free one at [expo.dev](https://expo.dev) if you haven't already).
4. **Wait for the build:** Expo will upload your code to their servers and compile it. This usually takes about 5-10 minutes.
5. **Download:** When it's done, it will give you a direct hyperlink in your terminal. You can open that link on your Android phone to download and install the `.apk` file!

*(Note: Whenever you plan to do this, make sure `buildType: "apk"` is set in your `eas.json` under the `"preview"` section. I have already configured this for you!)*

---

### Option 2: Build the APK Locally on your Mac (Requires Android Studio)
If you already have Android Studio and Java/Gradle fully configured on your Mac, you can compile the APK entirely on your own machine without sending it to the cloud.

1. Open your terminal in the `EthMum-NFC` folder.
2. Run this command:
   ```bash
   npx eas-cli build -p android --profile preview --local
   ```
*(Note: If this fails with a generic error, it means your Mac is missing some Android build dependencies, and you should use Option 1).*
