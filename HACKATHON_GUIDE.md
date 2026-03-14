# 🏆 Hackathon Guide: Running EthMum NFC Pay

To make a killer impression at your hackathon, you need to know exactly how to demo this app on real devices and how the funding/wallets work. Here is your complete guide.

---

## 1️⃣ Hardware Setup (Android & iOS)

NFC **cannot** be tested in a simulator or using standard Expo Go. You **must** use a real physical device and **physical NFC tags** (NTAG215 stickers, ~$1 each).

### Android Setup (Recommended for Hackathons)
Android is the best platform for demonstrating NFC tag read/write.

1. Connect your Android phone to your Mac via USB.
2. Ensure **USB Debugging** is enabled in your Android Developer Options.
3. Open your terminal in the project folder and run:
   ```bash
   npx expo run:android
   ```
4. This will build the native Android app with NFC permissions and install it on your phone.

### iOS Setup
Apple restricts iOS NFC writing capabilities.
*   **What works on iOS:** Your iOS device **can** be the "Customer" (reader). It can read NFC tags written by an Android device.
*   **To run on iOS:**
    ```bash
    npx expo run:ios
    ```
    *(Note: You will need an Apple Developer account configured in Xcode to deploy the app to a physical iPhone).*

**💡 Pro Hackathon Tip:** Use one Android phone as the **Merchant** to write payment data to an NFC tag, and a second phone (Android or iOS) as the **Customer** to read the tag and pay.

---

## 2️⃣ Wallet Setup & Funding

The app reads the demo wallet private key from a `.env` file in the project root. This keeps secrets out of source code.

### Setting Up Your Wallet
1. Open the `.env` file in the project root.
2. Replace `your_private_key` with a **Sepolia testnet** private key from a wallet you control.
3. **Fund the wallet:**
   - **Get Testnet ETH:** Go to [Sepolia Faucet](https://sepoliafaucet.com/) and send Sepolia ETH to your wallet address.
   - **Get Testnet USDC:** Use Circle's faucet or swap Sepolia ETH for USDC on Uniswap (Sepolia).

> ⚠️ **Never** put a mainnet private key with real funds in `.env`!

### Real-World Integration (If judges ask)
If judges ask, "Is it secure to use an embedded wallet?"
**Your Answer:** *"For this hackathon demo, we use an embedded ethers.js wallet loaded from environment variables. In production, we would integrate **WalletConnect v2** or **MetaMask SDK** to deep-link to the user's actual crypto wallet for secure transaction signing."*

---

## 3️⃣ The Perfect Demo Flow

When you walk up to present, here is the exact script and flow to use:

1. **Show the Merchant Phone (Android).** Enter an amount like `$5` and select `USDC`. Tap "Send via NFC". The app will start pulsing.
2. **The Tag Write:** Place a physical NFC tag (sticker) on the back of the Merchant phone. The app writes the payment request to the tag.
3. **Explain:** *"The merchant has written a payment request to this NFC tag — it contains the amount, token, and wallet address encoded as NDEF data."*
4. **Take the Customer Phone (Android/iOS).** Open the app to the Customer tab. Tap "Scan NFC".
5. **The Tap:** Customer taps the NFC tag.
6. **The Magic:** The Customer phone instantly shows a beautiful glassmorphic card with the merchant name, wallet, and `$5` amount.
7. **The Confirmation:** Tap "Confirm & Pay" on the Customer phone.
8. **The Proof:** Wait ~5 seconds for the Sepolia network to process it. A green confirmation badge appears. Tap "View on Etherscan" to show the judges the on-chain transaction hash.

---

## 4️⃣ Key Files You Should Know About

If you want to tweak things before your pitch:

*   **`src/theme.js`**: Change colors, gradients, and fonts here.
*   **`src/utils/wallet.js`**: Where the blockchain magic happens. You can change `USDC_ADDRESS` if you find a different token you want to use.
*   **`src/screens/MerchantScreen.js`**: Where the NFC `Ndef.textRecord` is constructed. You can add more data to the payload here (like a product ID or order number).
