// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract NFTManager is ERC721URIStorage, Ownable {
    uint256 public tokenIdCounter;
    mapping(uint256 => bool) public isSoulbound;

    event Minted(address indexed to, uint256 indexed tokenId, string uri, bool soulbound);

    constructor(string memory name_, string memory symbol_) ERC721(name_, symbol_) {}

    /// @notice Выпуск NFT или SBT
    function mint(
        address to,
        string calldata uri,
        bool soulbound
    ) external onlyOwner returns (uint256) {
        uint256 tokenId = ++tokenIdCounter;
        _mint(to, tokenId);
        _setTokenURI(tokenId, uri);
        isSoulbound[tokenId] = soulbound;

        emit Minted(to, tokenId, uri, soulbound);
        return tokenId;
    }

    /// @notice Soulbound токены нельзя переводить
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal override {
        require(!isSoulbound[tokenId] || from == address(0), "SBT is non-transferable");
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }

    /// В случае чего админ может сжечь токен
    function burn(uint256 tokenId) external onlyOwner {
        _burn(tokenId);
    }
}
