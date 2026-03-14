import { ethers } from 'ethers';
import { DEMO_PRIVATE_KEY, SEPOLIA_RPC_URL } from '@env';
import { CONTRACTS, ERC20_ABI, EXPLORER, CHAINS, DEFAULT_CHAIN, getChainConfig, getUSDCAddress } from '../config/blockchain';

// ─── Provider ────────────────────────────────────────────────────────
export function getProvider(chainKey) {
    const chain = getChainConfig(chainKey || DEFAULT_CHAIN);
    return new ethers.JsonRpcProvider(chain.rpcUrl);
}

// ─── Demo Wallet ─────────────────────────────────────────────────────
// Reads from .env file
export function getDemoWallet(chainKey) {
    if (!DEMO_PRIVATE_KEY || DEMO_PRIVATE_KEY === 'your_private_key') {
        throw new Error('Wallet not configured. Please add your private key to the .env file.');
    }
    const provider = getProvider(chainKey);
    return new ethers.Wallet(DEMO_PRIVATE_KEY, provider);
}

// ─── Send ETH ────────────────────────────────────────────────────────
export async function sendETH(toAddress, amountInEther, chainKey) {
    try {
        const chain = getChainConfig(chainKey || DEFAULT_CHAIN);
        const wallet = getDemoWallet(chainKey);
        const value = ethers.parseEther(amountInEther);

        // Balance check
        const balance = await wallet.provider.getBalance(wallet.address);
        if (balance < value) {
            throw new Error(`Insufficient ETH balance on ${chain.name}. Have ${ethers.formatEther(balance)} ETH, need ${amountInEther} ETH.`);
        }

        const tx = await wallet.sendTransaction({ to: toAddress, value });
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
    } catch (err) {
        if (err.code === 'INSUFFICIENT_FUNDS') {
            const chain = getChainConfig(chainKey || DEFAULT_CHAIN);
            throw new Error(`Insufficient ETH balance. Please fund your wallet on ${chain.name}.`);
        }
        if (err.code === 'NETWORK_ERROR') {
            throw new Error('Network error. Please check your internet connection.');
        }
        throw new Error(err.shortMessage || err.message || 'ETH transaction failed.');
    }
}

// ─── Send USDC (ERC-20) ─────────────────────────────────────────────
export async function sendUSDC(toAddress, amountInUSDC, chainKey) {
    try {
        const chain = getChainConfig(chainKey || DEFAULT_CHAIN);
        const wallet = getDemoWallet(chainKey);
        const usdcAddr = getUSDCAddress(chainKey || DEFAULT_CHAIN);
        const usdc = new ethers.Contract(usdcAddr, ERC20_ABI, wallet);
        const decimals = await usdc.decimals();
        const amount = ethers.parseUnits(amountInUSDC, decimals);

        // Balance + gas estimation check
        const usdcBalance = await usdc.balanceOf(wallet.address);
        if (usdcBalance < amount) {
            const chainName = getChainConfig(chainKey || DEFAULT_CHAIN).name;
            throw new Error(`Insufficient USDC on ${chainName}. Have ${ethers.formatUnits(usdcBalance, decimals)}, need ${amountInUSDC}.`);
        }

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
    } catch (err) {
        const chainName = getChainConfig(chainKey || DEFAULT_CHAIN).name;
        if (err.code === 'INSUFFICIENT_FUNDS') {
            throw new Error(`Insufficient ETH for gas. Please fund your wallet on ${chainName}.`);
        }
        if (err.code === 'CALL_EXCEPTION') {
            throw new Error(`USDC transfer failed. Check your USDC balance on ${chainName}.`);
        }
        if (err.code === 'NETWORK_ERROR') {
            throw new Error('Network error. Please check your internet connection.');
        }
        throw new Error(err.shortMessage || err.message || 'USDC transaction failed.');
    }
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

// ─── ENS Profile (avatar + reverse name + text records) ─────────────
export async function resolveENSProfile(ensNameOrAddress) {
    try {
        const mainnetProvider = new ethers.JsonRpcProvider(
            'https://eth.llamarpc.com'
        );

        let address = ensNameOrAddress;
        let ensName = null;

        if (ensNameOrAddress.endsWith('.eth')) {
            ensName = ensNameOrAddress;
            address = await mainnetProvider.resolveName(ensName);
            if (!address) return null;
        } else {
            // Reverse lookup: address → name.eth
            ensName = await mainnetProvider.lookupAddress(ensNameOrAddress);
        }

        // Fetch avatar
        let avatar = null;
        if (ensName) {
            try {
                avatar = await mainnetProvider.getAvatar(ensName);
            } catch (_) { }
        }

        // Fetch ENS text records (description, website, twitter, etc.)
        let textRecords = {};
        if (ensName) {
            try {
                const resolver = await mainnetProvider.getResolver(ensName);
                if (resolver) {
                    const fields = ['description', 'url', 'com.twitter', 'com.github', 'email'];
                    const results = await Promise.allSettled(
                        fields.map((field) => resolver.getText(field))
                    );
                    fields.forEach((field, i) => {
                        if (results[i].status === 'fulfilled' && results[i].value) {
                            textRecords[field] = results[i].value;
                        }
                    });
                }
            } catch (_) { }
        }

        return { ensName, address, avatar, textRecords };
    } catch (e) {
        console.warn('ENS profile fetch failed:', e);
        return null;
    }
}

// ─── Ensure Wallet is on Correct Chain ──────────────────────────────
export async function ensureCorrectChain(walletProvider, chainKey) {
    try {
        const chain = getChainConfig(chainKey || DEFAULT_CHAIN);
        const browserProvider = new ethers.BrowserProvider(walletProvider);
        const network = await browserProvider.getNetwork();
        const requiredChainId = BigInt(chain.chainId);

        if (network.chainId !== requiredChainId) {
            try {
                await walletProvider.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: chain.hexChainId }],
                });
            } catch (switchErr) {
                // 4902 = chain not added to wallet
                if (switchErr?.code === 4902) {
                    await walletProvider.request({
                        method: 'wallet_addEthereumChain',
                        params: [{
                            chainId: chain.hexChainId,
                            chainName: chain.name,
                            rpcUrls: [chain.rpcUrl],
                            nativeCurrency: chain.nativeCurrency,
                            blockExplorerUrls: [chain.explorer.baseUrl],
                        }],
                    });
                } else {
                    throw switchErr;
                }
            }
        }
    } catch (err) {
        if (err?.code === 4001 || err?.message?.includes('rejected')) {
            throw new Error('Network switch rejected by user.');
        }
        throw err;
    }
}

// ─── Send ETH via External Wallet (WalletConnect) ───────────────────
export async function sendETHViaProvider(walletProvider, toAddress, amountInEther, chainKey) {
    try {
        await ensureCorrectChain(walletProvider, chainKey);
        const browserProvider = new ethers.BrowserProvider(walletProvider);
        const signer = await browserProvider.getSigner();
        const tx = await signer.sendTransaction({
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
    } catch (err) {
        if (err?.code === 4001 || err?.message?.includes('rejected')) {
            throw new Error('Transaction rejected by user.');
        }
        if (err.code === 'INSUFFICIENT_FUNDS') {
            throw new Error('Insufficient ETH balance in your wallet.');
        }
        throw new Error(err.shortMessage || err.message || 'ETH transaction failed.');
    }
}

// ─── Send USDC via External Wallet (WalletConnect) ──────────────────
export async function sendUSDCViaProvider(walletProvider, toAddress, amountInUSDC, chainKey) {
    try {
        await ensureCorrectChain(walletProvider, chainKey);
        const browserProvider = new ethers.BrowserProvider(walletProvider);
        const signer = await browserProvider.getSigner();
        const usdcAddr = getUSDCAddress(chainKey || DEFAULT_CHAIN);
        const usdc = new ethers.Contract(usdcAddr, ERC20_ABI, signer);
        const decimals = await usdc.decimals();
        const amount = ethers.parseUnits(amountInUSDC, decimals);

        // Gas estimation check
        try {
            await usdc.transfer.estimateGas(toAddress, amount);
        } catch (gasErr) {
            throw new Error('Insufficient USDC balance or gas for this transaction.');
        }

        const tx = await usdc.transfer(toAddress, amount);
        const receipt = await tx.wait();
        return {
            hash: tx.hash,
            from: await signer.getAddress(),
            to: toAddress,
            amount: amountInUSDC,
            token: 'USDC',
            blockNumber: receipt.blockNumber,
            timestamp: new Date().toISOString(),
        };
    } catch (err) {
        if (err?.code === 4001 || err?.message?.includes('rejected')) {
            throw new Error('Transaction rejected by user.');
        }
        if (err.code === 'INSUFFICIENT_FUNDS') {
            throw new Error('Insufficient ETH for gas in your wallet.');
        }
        if (err.code === 'CALL_EXCEPTION') {
            const chainName = getChainConfig(chainKey || DEFAULT_CHAIN).name;
            throw new Error(`USDC transfer failed. Check your USDC balance on ${chainName}.`);
        }
        throw new Error(err.shortMessage || err.message || 'USDC transaction failed.');
    }
}

// ─── Helpers ─────────────────────────────────────────────────────────
export function shortenAddress(addr) {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function getEtherscanUrl(txHash, chainKey) {
    if (chainKey) {
        const chain = getChainConfig(chainKey);
        return chain.explorer.tx(txHash);
    }
    return EXPLORER.tx(txHash);
}
