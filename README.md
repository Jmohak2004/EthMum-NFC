# EthMum NFC Pay 💳⚡

> Hackathon-ready React Native (Expo) app for **NFC phone-to-phone crypto payments** on Ethereum.

## 🔥 Features

- **Merchant Mode** — Enter amount, select token (USDC/ETH), write payment request to NFC
- **Customer Mode** — Read NFC tag, view payment details, confirm & send on-chain transaction
- **Transaction History** — Persistent log with Etherscan links
- **ENS Resolution** — Resolve `.eth` names to wallet addresses
- **Dark Neon UI** — Glassmorphic cards, animated NFC pulse, gradient buttons

## 📱 Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React Native + Expo SDK 52 |
| NFC | `react-native-nfc-manager` |
| Blockchain | `ethers` v6 (Sepolia testnet) |
| Navigation | `@react-navigation/bottom-tabs` |
| Storage | `@react-native-async-storage/async-storage` |
| UI | `expo-linear-gradient`, `@expo/vector-icons` |

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start Expo dev server
npx expo start

# For NFC testing (requires physical Android device)
npx expo run:android
```

## 📂 Project Structure

```
src/
├── components/
│   ├── PaymentCard.js      # Glassmorphic payment display card
│   ├── NfcPulse.js         # Animated NFC scan indicator
│   └── GlassButton.js      # Neon gradient button with press anim
├── screens/
│   ├── MerchantScreen.js   # NFC write + payment config
│   ├── CustomerScreen.js   # NFC read + crypto payment
│   └── HistoryScreen.js    # Transaction log
├── navigation/
│   └── AppNavigator.js     # Bottom tab navigator
├── utils/
│   ├── wallet.js           # ethers.js wallet, sendETH/USDC, ENS
│   └── storage.js          # AsyncStorage tx persistence
└── theme.js                # Design tokens (colors, spacing, fonts)
```

## 🔄 Payment Flow

```
Merchant Phone → Enter Amount → Tap "Send via NFC"
        ↓
    Phones Touch (NFC)
        ↓
Customer Phone → Reads Payment Data → Shows PaymentCard
        ↓
    Tap "Confirm & Pay"
        ↓
    On-chain USDC/ETH Transfer → Etherscan Receipt
```

## ⚠️ Important Notes

- **NFC requires a physical Android device** — won't work in Expo Go or simulators
- **Uses Sepolia testnet** — no real funds. Get test ETH from [Sepolia faucet](https://sepoliafaucet.com/)
- **Demo wallet** — replace the private key in `wallet.js` for production

## 🏆 Hackathon Upgrade Ideas

- WalletConnect v2 integration for real wallet signing
- Tap-to-mint NFT receipts
- Merchant dashboard with analytics
- QR code fallback for devices without NFC
- Multi-chain support (Polygon, Base, Arbitrum)
