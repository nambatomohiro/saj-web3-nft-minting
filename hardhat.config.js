require("@nomicfoundation/hardhat-toolbox");

// 秘密鍵は .env から(docker compose の env_file で注入される。設計書§5)。
// MetaMask のエクスポートは 0x 無しのことがあるため、ここで補う(当日の事故防止)。
const rawKey = process.env.SEMINAR_PRIVATE_KEY;
const accounts = rawKey ? [rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`] : [];

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.28",
  networks: {
    // Part3 背骨: コンテナ内で稼働するローカルチェーン(npx hardhat node)
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    // Part4 ごほうび層: Polygon Amoy テストネット
    amoy: {
      url: process.env.AMOY_RPC_URL || "https://rpc-amoy.polygon.technology",
      chainId: 80002,
      accounts,
    },
  },
};
