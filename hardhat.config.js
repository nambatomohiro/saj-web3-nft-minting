require("@nomicfoundation/hardhat-toolbox");
require("./tasks/handson");
require("./tasks/distribute");
require("./tasks/collect");

// 秘密鍵は .env から(docker compose の env_file で注入される。設計書§5)。
// MetaMask のエクスポートは 0x 無しのことがあるため、ここで補う(当日の事故防止)。
const rawKey = process.env.SEMINAR_PRIVATE_KEY;
const accounts = rawKey ? [rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`] : [];

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      // OpenZeppelin 5.6 が Cancun の mcopy 命令を使う。
      // Hardhat network / Polygon Amoy(Napoliアップグレード済み) は両方 Cancun 対応。
      evmVersion: "cancun",
      // デプロイガス削減(faucetのPOLでも余裕を持たせる)
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    // Part3 背骨: コンテナ内で稼働するローカルチェーン(npx hardhat node)
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    // Part4 ごほうび層: Polygon Amoy テストネット
    amoy: {
      // 2026-08-15: 旧フォールバック先 https://rpc-amoy.polygon.technology が名前解決に失敗する
      // (MetaMask も「チェーンIDを取得できませんでした」で追加不可)。公式RPCは当てにしない。
      // 代替は当日ハマったとき用に .env.example に併記してある。
      url: process.env.AMOY_RPC_URL || "https://polygon-amoy-bor-rpc.publicnode.com",
      chainId: 80002,
      accounts,
    },
  },
};
