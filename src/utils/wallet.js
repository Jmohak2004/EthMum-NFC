import { ethers } from 'ethers';

// ─── Sepolia Testnet Config ──────────────────────────────────────────
const SEPOLIA_RPC = 'https://rpc.sepolia.org';
const USDC_ADDRESS = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'; // Sepolia USDC

const ERC20_ABI = [
    'function transfer(address to, uint256 amount) returns (bool)',
    'function balanceOf(address owner) view returns (uint256)',
    'function decimals() view returns (uint8)',
    'function symbol() view returns (string)',
];

// ─── Provider ────────────────────────────────────────────────────────
export function getProvider() {
    return new ethers.JsonRpcProvider(SEPOLIA_RPC);
}

// ─── Demo Wallet (Sepolia testnet only!) ─────────────────────────────
// ⚠️ NEVER use a real private key here — this is for hackathon demo only
const DEMO_PRIVATE_KEY =
    '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'; // Hardhat #0

export function getDemoWallet() {
    const provider = getProvider();
    return new ethers.Wallet(DEMO_PRIVATE_KEY, provider);
}

// ─── Send ETH ────────────────────────────────────────────────────────
export async function sendETH(toAddress, amountInEther) {
    const wallet = getDemoWallet();
    const tx = await wallet.sendTransaction({
        to: toAddress,
        value: ethers.parseEther(amountInEther),
    });
    const receipt = await tx.wait();
    return {
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        amount: amountInEther,
        token: 'ETH',
        blockNumber: receipt.blockNumber,
        timestamp: new Date().toISOString(),
    };
}

// ─── Send USDC (ERC-20) ─────────────────────────────────────────────
export async function sendUSDC(toAddress, amountInUSDC) {
    const wallet = getDemoWallet();
    const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, wallet);
    const decimals = await usdc.decimals();
    const amount = ethers.parseUnits(amountInUSDC, decimals);
    const tx = await usdc.transfer(toAddress, amount);
    const receipt = await tx.wait();
    return {
        hash: tx.hash,
        from: wallet.address,
        to: toAddress,
        amount: amountInUSDC,
        token: 'USDC',
        blockNumber: receipt.blockNumber,
        timestamp: new Date().toISOString(),
    };
}

// ─── ENS Resolution ─────────────────────────────────────────────────
export async function resolveENS(ensName) {
    try {
        // ENS resolution requires mainnet provider
        const mainnetProvider = new ethers.JsonRpcProvider(
            'https://eth.llamarpc.com'
        );
        const address = await mainnetProvider.resolveName(ensName);
        return address;
    } catch (e) {
        console.warn('ENS resolution failed:', e);
        return null;
    }
}

// ─── Helpers ─────────────────────────────────────────────────────────
export function shortenAddress(addr) {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function getEtherscanUrl(txHash) {
    return `https://sepolia.etherscan.io/tx/${txHash}`;
}
