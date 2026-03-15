# EthMum NFC Pay 💳⚡

> Hackathon-ready React Native (Expo) app for **NFC tag-based crypto payments** on Ethereum.

Architecture Diagram :
## Architecture Diagram
![EthMum Architecture](./WhatsApp%20Image%202026-03-15%20at%2013.39.06.jpeg)

## 🔥 Features

- **Merchant Mode** — Enter amount, select token (USDC/ETH), write payment request to a physical NFC tag
- **Customer Mode** — Tap the NFC tag, view payment details, confirm & send on-chain transaction
- **Transaction History** — Persistent log with Etherscan links
- **ENS Resolution** — Resolve `.eth` names to wallet addresses
- **Dark Neon UI** — Glassmorphic cards, animated NFC pulse, gradient buttons

## 📱 Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React Native + Expo SDK 55 |
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
Merchant Phone → Enter Amount → Tap "Write to NFC Tag"
        ↓
    Merchant taps physical NFC tag (writes payment data)
        ↓
Customer Phone → Taps the same NFC tag → Reads Payment Data
        ↓
    Shows PaymentCard → Tap "Confirm & Pay"
        ↓
    On-chain USDC/ETH Transfer → Etherscan Receipt
```

> 💡 Use cheap NFC215/NTAG215 stickers (~$1 each). The merchant writes the payment request to the tag, and the customer taps the same tag to read it.

## ⚠️ Important Notes

- **NFC requires a physical Android device** — won't work in Expo Go or simulators
- **You need physical NFC tags** — NTAG215 stickers work great and cost ~$1 each
- **Uses Sepolia testnet** — no real funds. Get test ETH from [Sepolia faucet](https://sepoliafaucet.com/)
- **Wallet config** — add your private key to the `.env` file (never commit it!)

## 🏆 Hackathon Upgrade Ideas

- WalletConnect v2 integration for real wallet signing
- Tap-to-mint NFT receipts
- Merchant dashboard with analytics
- QR code fallback for devices without NFC
- Multi-chain support (Polygon, Base, Arbitrum)
