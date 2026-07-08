// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {ERC721Burnable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";

/// @title SAJ Web3 Member NFT(会員証の練習台)
/// @notice web3ビジネス研究会ハンズオン用の練習NFT。
///         あえて「譲渡可能 + burn可能」にしてある:
///         - 譲渡できてしまう体験 → 「だから本物の会員証は Soulbound にする」への布石
///         - burn → ハンズオン締めの焼却儀式(本物は将来 Base メインネットに発行する)
contract SAJMemberNFT is ERC721, ERC721Enumerable, ERC721Burnable {
    uint256 private _nextTokenId;

    /// tokenId => メンバー名(メタデータに埋め込む)
    mapping(uint256 => string) private _memberNames;

    string public constant MEMBER_YEAR = "2026";

    constructor() ERC721("SAJ Web3 Member", "SAJM") {}

    /// @notice 自分に会員証(練習台)を1枚発行する
    /// @param memberName メタデータに刻む名前
    function mint(string calldata memberName) external returns (uint256 tokenId) {
        tokenId = _nextTokenId++;
        _memberNames[tokenId] = memberName;
        _safeMint(msg.sender, tokenId);
    }

    /// @notice メタデータはオンチェーン直書き(IPFS等の外部依存ゼロ)
    ///         { "name": "SAJ Web3 Member", "member": "<名前>", "year": "2026" }
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        bytes memory json = abi.encodePacked(
            '{"name":"SAJ Web3 Member","member":"',
            _memberNames[tokenId],
            '","year":"',
            MEMBER_YEAR,
            '"}'
        );
        return string(abi.encodePacked("data:application/json;base64,", Base64.encode(json)));
    }

    // ---- 以下は OpenZeppelin の多重継承(ERC721 x Enumerable)のお作法 ----

    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721, ERC721Enumerable)
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value)
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._increaseBalance(account, value);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
