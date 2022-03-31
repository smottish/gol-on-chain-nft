// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/security/PullPayment.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// Inheriting from PullPayment adds a `payments` function to query due
// payments, and `withdrawPayments` to get funds out of the contract
contract NFT is ERC721, PullPayment, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private currentTokenId;
    string public baseTokenURI;
    uint256 public constant TOTAL_SUPPLY = 10;
    uint256 public constant MINT_PRICE = 0.01 ether;

    constructor() ERC721("PracticeNFT", "NFT") {
        baseTokenURI = "";
    }

    function mintTo(address recipient) public payable returns (uint256) {
        uint256 tokenId = currentTokenId.current();
        require(tokenId < TOTAL_SUPPLY, "Max supply reached");
        require(msg.value == MINT_PRICE, "Transaction value didn't equal the mint price");

        currentTokenId.increment();
        uint256 newTokenId = currentTokenId.current();
        _safeMint(recipient, newTokenId);
        _asyncTransfer(owner(), msg.value);
        return newTokenId;
    }

    // This will be called by OpenZeppelin's tokenURI function, which will return
    // _baseURI() + tokenId
    function _baseURI() internal view virtual override returns (string memory) {
        return baseTokenURI;
    }

    function setBaseTokenURI(string memory _baseTokenURI) public onlyOwner {
        baseTokenURI = _baseTokenURI;
    }

    function withdrawPayments(address payable payee) public override onlyOwner virtual {
        super.withdrawPayments(payee);
    }
}