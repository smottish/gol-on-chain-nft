// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/security/PullPayment.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// Inheriting from PullPayment adds a `payments` function to query due
// payments, and `withdrawPayments` to get funds out of the contract
contract NFT is ERC721, PullPayment, Ownable {
    // Bit array representation of a row in the initial state grid.
    // The number of bits in the uint must match the value of GRID_SIZE.
    type GridRowBits is uint64;
    // Number of 256-bit uints needed to store the GRID_SIZE x GRID_SIZE
    // initial state grid. If GRID_SIZE changes, we'll need to update
    // this accordingly. E.g. with GRID_SIZE = 128, we can represent two
    // rows with one uint (256 bits / 2). So we only need 64 uints to
    // represent a 128 x 128 grid.
    uint internal constant INITIAL_STATE_SIZE = 16;
    // The intial state grid will be GRID_SIZE x GRID_SIZE.
    // GRID_SIZE must match the number of bits in GridRowBits and thus must
    // be a power of 2.
    uint internal constant GRID_SIZE = 64;
    using Counters for Counters.Counter;
    Counters.Counter private currentTokenId;
    string public baseTokenURI;
    uint256 public constant TOTAL_SUPPLY = 10;
    uint256 public constant MINT_PRICE = 0.01 ether;
    mapping(uint => uint) internal idToSeed;
    mapping(uint => uint) internal seedToId;

    constructor() ERC721("PracticeNFT", "NFT") {
        baseTokenURI = "";
    }

    function _mintTo(address recipient, uint seed) internal returns (uint256) {
        uint256 tokenId = currentTokenId.current();
        require(tokenId < TOTAL_SUPPLY, "Max supply reached");
        require(msg.value == MINT_PRICE, "Transaction value didn't equal the mint price");
        // Make sure we haven't already used this seed
        require(seedToId[seed] == 0, "Seed is already taken");

        currentTokenId.increment();
        uint256 newTokenId = currentTokenId.current();
        idToSeed[newTokenId] = seed;
        seedToId[seed] = newTokenId;
        _safeMint(recipient, newTokenId);
        return newTokenId;
    }

    function mintTo(address recipient, uint seed) public payable returns (uint256) {
        uint256 tokenId = _mintTo(recipient, seed);
        _asyncTransfer(owner(), msg.value);
        return tokenId;
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

    function getInitialState(uint tokenId) public virtual view returns(uint256[INITIAL_STATE_SIZE] memory) {
        uint i;
        // Use memory not calldata for the data location because calldata can't be modified.
        uint256[INITIAL_STATE_SIZE] memory state;

        require(_exists(tokenId), "tokenId doesn't exist");

        uint seed = idToSeed[tokenId];
        for (i = 0; i < INITIAL_STATE_SIZE; i++) {
            state[i] = uint(keccak256(abi.encodePacked(seed + i)));
        }
        return state;
    }

    // Convert a bit array representing a row in the initial state grid (GridRowBits)
    // to its string representation. Write this string representation directly into
    // the specified row in `grid`. `grid` is a 1D representation of a
    // (GRID_SIZE + 1) x GRID_SIZE grid. The row width is GRID_SIZE + 1 because an
    // extra byte is needed for the newline character.
    function _setRow(bytes memory grid, uint row, GridRowBits value) internal pure {
        uint b;
        uint bitmask;
        uint cell;
        uint unwrappedValue = uint(GridRowBits.unwrap(value));
        // Row width is GRID_SIZE + 1 to accomodate the newline
        uint WIDTH = GRID_SIZE + 1;
        // End index is WIDTH - 1, which is GRID_SIZE + 1 - 1 = GRID_SIZE,
        // but the last cell contains a newline so we subtract 1 again.
        uint ROW_END_INDEX = GRID_SIZE - 1;
        uint ROW_OFFSET = row * WIDTH;
        uint LENGTH = WIDTH * GRID_SIZE;

        require(grid.length == LENGTH, "grid is the wrong length");

        // End of the row is the newline character
        grid[ROW_OFFSET + GRID_SIZE] = '\n';
        for (b = 0; b < GRID_SIZE; b++) {
            // Right most bit is the last cell in a grid row before
            // the newline character
            bitmask = 0x1 << b;
            // Fill the row from the end to the beginning
            cell = ROW_OFFSET + (ROW_END_INDEX - b);
            // Check if bit is set
            if ((bitmask & unwrappedValue) == bitmask) {
                grid[cell] = 'x';
            } else {
                grid[cell] = 'o';
            }
        }
    }

    // Extract two initial state rows (representated as bit arrays) from a 256-bit uint.
    // If the underlying type of GridRowBits changes, this function will need to be updated.
    function _decodeStateValue(uint256 value) internal pure returns(GridRowBits, GridRowBits, GridRowBits, GridRowBits) {
        uint256 ROW_MASK = 0x000000000000000000000000000000000000000000000000FFFFFFFFFFFFFFFF;
        // left most 64 bits
        uint64 row1 = uint64(value >> 192);
        uint64 row2 = uint64((value >> 128) & ROW_MASK);
        uint64 row3 = uint64((value >> 64) & ROW_MASK);
        // right most 64 bits
        uint64 row4 = uint64(value & ROW_MASK);
        return (
            GridRowBits.wrap(row1),
            GridRowBits.wrap(row2),
            GridRowBits.wrap(row3),
            GridRowBits.wrap(row4)
        );
    }

    function draw(uint tokenId) public view returns(string memory) {
        uint i;
        uint ROWS_PER_INITIAL_STATE_VALUE = 4;
        uint256[INITIAL_STATE_SIZE] memory state = getInitialState(tokenId);
        // Each row has an extra byte for a newline character
        bytes memory output = new bytes(GRID_SIZE * (GRID_SIZE + 1));

        for (i = 0; i < INITIAL_STATE_SIZE; i++) {
            (GridRowBits row1, GridRowBits row2, GridRowBits row3, GridRowBits row4) = _decodeStateValue(state[i]);
            _setRow(output, i * ROWS_PER_INITIAL_STATE_VALUE, row1);
            _setRow(output, (i * ROWS_PER_INITIAL_STATE_VALUE) + 1, row2);
            _setRow(output, (i * ROWS_PER_INITIAL_STATE_VALUE) + 2, row3);
            _setRow(output, (i * ROWS_PER_INITIAL_STATE_VALUE) + 3, row4);
        }

        return string(output);
    }
}