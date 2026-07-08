# SAJ Web3 NFT ハンズオン用イメージ(設計書§5)
# - 重い node_modules はイメージに焼き込む(当日の npm install 待ち/失敗を排除)
# - ソース(コントラクト/スクリプト)は git リポジトリ側 → docker-compose.yml でマウント
# - イベント前に事前ビルドしてレジストリへ push し、参加者は docker pull するだけにする
FROM node:20

WORKDIR /app

# 依存定義のみ COPY → npm ci で node_modules を焼き込む
COPY package.json package-lock.json ./
RUN npm ci

# TODO(コントラクト実装後): ここで npx hardhat compile を実行し、
# solc コンパイラを /root/.cache に事前ダウンロードしておく(当日のDL待ち・wifi事故対策)

# ローカルチェーン(Hardhat node)の JSON-RPC ポート
EXPOSE 8545

# デフォルトはローカルチェーン起動(docker-compose.yml の command と同一)
CMD ["npx", "hardhat", "node", "--hostname", "0.0.0.0"]
