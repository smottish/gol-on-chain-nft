// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./NFT.sol";

contract NFTTest is NFT {
    event Minted(uint256 indexed tokenId, address indexed to, string initialState);

    // This value is 11111111000000001111111100000000... for 256 bits
    uint internal constant FILL_VALUE = 0xFF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00FF00;
    function getInitialState(uint tokenId) public override pure returns(uint256[INITIAL_STATE_SIZE] memory) {
        uint i;
        uint256[INITIAL_STATE_SIZE] memory output;

        output[0] = tokenId;
        for (i = 1; i < INITIAL_STATE_SIZE; i++) {
            output[i] = FILL_VALUE;
        }

        return output;
    }

    function mintAndLog(address recipient, uint seed) public payable returns (uint256) {
        uint256 tokenId = _mintTo(recipient, seed);
        emit Minted(tokenId, recipient, draw(tokenId));
        _asyncTransfer(owner(), msg.value);
        return tokenId;
    }
}