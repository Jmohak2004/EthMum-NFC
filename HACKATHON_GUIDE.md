# 🏆 Hackathon Guide: Running EthMum NFC Pay

To make a killer impression at your hackathon, you need to know exactly how to demo this app on real devices and how the funding/wallets work. Here is your complete guide.

---

## 1️⃣ Hardware Setup (Android & iOS)

NFC **cannot** be tested in a simulator or using standard Expo Go. You **must** use a real physical device.

### Android Setup (Recommended for Hackathons)
Android is the best platform for demonstrating **Phone-to-Phone** NFC (where phone A writes data, and phone B reads it).

1. Connect your Android phone to your Mac via USB.
2. Ensure **USB Debugging** is enabled in your Android Developer Options.
3. Open your terminal in the project folder (`/Users/mohakjaiswal/ETH_NFC/EthMum-NFC`) and run:
   ```bash
   npx expo run:android
   ```
4. This will build the native Android app with NFC permissions and install it on your phone.

### iOS Setup
Apple restricts iOS from acting as an NFC "writer" for phone-to-phone communication in the same way Android does.
*   **What works on iOS:** Your iOS device **can** be the "Customer" (reader). It can read NFC tags or read an Android phone that is transmitting an NFC signal.
*   **To run on iOS:**
    ```bash
    npx expo run:ios
    ```
    *(Note: You will need an Apple Developer account configured in Xcode to deploy the app to a physical iPhone).*

**💡 Pro Hackathon Tip:** Use one Android phone as the **Merchant** (Writer) and a second phone (Android or iOS) as the **Customer** (Reader).

---

## 2️⃣ Wallet Setup & Funding

Right now, the app uses a **Hardcoded Demo Wallet** in `src/utils/wallet.js` to automatically sign and send transactions in the background when the user taps "Confirm & Pay". This provides the smoothest UX for a quick hackathon pitch.

### The Current Demo Wallet
In `src/utils/wallet.js`, you'll see:
```javascript
const DEMO_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'; // Hardhat #0
```
This is a standard testing private key. Its public address is: `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`.

### How to make it work LIVE for the judges:
To make the app actually send real transactions on the **Sepolia Testnet** during your presentation, you need to fund this demo wallet with test ETH and test USDC.

1. **Get Testnet ETH:** Go to [Sepolia Faucet (Alchemy)](https://sepoliafaucet.com/) and send Sepolia ETH to `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`.
2. **Get Testnet USDC:** You can usually get test USDC from Circle's faucet or swap some Sepolia ETH for USDC on Uniswap (Sepolia network).
3. **Alternatively, use your own wallet:**
   If you have your own MetaMask wallet installed on your phone with Sepolia ETH, you can replace the `DEMO_PRIVATE_KEY` in `src/utils/wallet.js` with **your own private key** from your secondary wallet that you don't mind putting in code. *(Never put a mainnet private key with real funds in code!)*

### Real-World Integration (If judges ask)
If judges ask, "Is it secure to hardcode a private key?"
**Your Answer:** *"For this 48hr hackathon demo, we used an embedded ethers.js wallet for speed. In our production architecture, we would integrate **WalletConnect v2** or **MetaMask SDK** here, which would deep-link out to the user's actual crypto wallet app to securely sign the transaction before returning to our app."*

---

## 3️⃣ The Perfect Demo Flow

When you walk up to present, here is the exact script and flow to use:

1. **Show the Merchant Phone (Android).** Enter an amount like `$5` and select `USDC`. Tap "Send via NFC". The app will start pulsing.
2. **Explain:** *"The merchant's phone is now continuously broadcasting an NDEF NFC signal containing the payment request data."*
3. **Take the Customer Phone (Android/iOS).** Open the app to the Customer tab. Tap "Scan NFC".
4. **The Tap:** Physically tap the two phones back-to-back.
5. **The Magic:** The Customer phone instantly pops up a beautiful glassmorphic card showing the exact merchant name, wallet, and `$5` amount.
6. **The Confirmation:** Tap "Confirm & Pay" on the Customer phone.
7. **The Proof:** Wait ~5 seconds for the Sepolia network to process it. A green confirmation badge will appear. Tap "View on Etherscan" to show the judges the literal on-chain transaction hash proving money moved.

---

## 4️⃣ Key Files You Should Know About

If you want to tweak things before your pitch:

*   **`src/theme.js`**: Change colors, gradients, and fonts here.
*   **`src/utils/wallet.js`**: Where the blockchain magic happens. You can change `USDC_ADDRESS` if you find a different token you want to use.
*   **`src/screens/MerchantScreen.js`**: Where the NFC `Ndef.textRecord` is constructed. You can add more data to the payload here (like a product ID or order number).
