const { expect } = require("chai");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { ethers } = require("hardhat");

// 設計書§4: ERC-721ベース、譲渡可能+burn可能(あえてSoulboundにしない練習台)
// メタデータ: { name: "SAJ Web3 Member", member: "<名前>", year: "2026" } をオンチェーン直書き
describe("SAJMemberNFT(会員証の練習台)", function () {
  async function deployFixture() {
    const [alice, bob] = await ethers.getSigners();
    const nft = await ethers.deployContract("SAJMemberNFT");
    return { nft, alice, bob };
  }

  describe("mint(発行)", function () {
    it("自分に会員証を1枚発行できる", async function () {
      const { nft, alice } = await loadFixture(deployFixture);
      await nft.mint("難波");
      expect(await nft.balanceOf(alice.address)).to.equal(1);
      expect(await nft.ownerOf(0)).to.equal(alice.address);
    });

    it("メタデータ {name, member, year} をオンチェーンで持つ(data URI)", async function () {
      const { nft } = await loadFixture(deployFixture);
      await nft.mint("難波");
      const uri = await nft.tokenURI(0);
      expect(uri).to.match(/^data:application\/json;base64,/);
      const json = JSON.parse(
        Buffer.from(uri.split(",")[1], "base64").toString("utf8")
      );
      expect(json).to.deep.equal({
        name: "SAJ Web3 Member",
        member: "難波",
        year: "2026",
      });
    });
  });

  describe("check-membership(token-gating: 保有者だけが会員)", function () {
    it("balanceOf で会員か判定できる(保有=会員, 未保有=非会員)", async function () {
      const { nft, alice, bob } = await loadFixture(deployFixture);
      await nft.mint("難波");
      expect(await nft.balanceOf(alice.address)).to.equal(1); // 会員
      expect(await nft.balanceOf(bob.address)).to.equal(0); // 非会員
    });

    it("tokenOfOwnerByIndex で自分のトークンを特定できる(スクリプトが使用)", async function () {
      const { nft, alice } = await loadFixture(deployFixture);
      await nft.mint("難波");
      expect(await nft.tokenOfOwnerByIndex(alice.address, 0)).to.equal(0);
    });
  });

  describe("transfer(譲渡)", function () {
    it("練習台はあえて譲渡できてしまう(→ だから本物は Soulbound にする)", async function () {
      const { nft, alice, bob } = await loadFixture(deployFixture);
      await nft.mint("難波");
      await nft.transferFrom(alice.address, bob.address, 0);
      expect(await nft.ownerOf(0)).to.equal(bob.address);
      expect(await nft.balanceOf(alice.address)).to.equal(0); // もう会員ではない
      expect(await nft.balanceOf(bob.address)).to.equal(1);
    });
  });

  describe("burn(焼却)", function () {
    it("保有者は自分の会員証を焼却できる(Part4の焼却儀式)", async function () {
      const { nft, alice } = await loadFixture(deployFixture);
      await nft.mint("難波");
      await nft.burn(0);
      expect(await nft.balanceOf(alice.address)).to.equal(0);
      await expect(nft.ownerOf(0)).to.be.revertedWithCustomError(
        nft,
        "ERC721NonexistentToken"
      );
    });

    it("他人の会員証は焼却できない", async function () {
      const { nft, bob } = await loadFixture(deployFixture);
      await nft.mint("難波");
      await expect(nft.connect(bob).burn(0)).to.be.revertedWithCustomError(
        nft,
        "ERC721InsufficientApproval"
      );
    });
  });
});
