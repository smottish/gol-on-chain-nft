# Game of Life "on-chain" NFT

This is an experiment with "on-chain" NFT art, where the art lives on the blockchain itself, instead of in metadata linked to by a URI.

This project is inspired by [Autoglyphs](https://www.larvalabs.com/autoglyphs) and uses effectivley the same method for generating art "on-chain". In this case, the artwork is a 64x64 grid that can be used as the initial state for [John Conway's Game of Life (GoL)](https://en.wikipedia.org/wiki/Conway%27s_Game_of_Life).

## Getting started

Clone the repo
```sh
git clone git@github.com:smottish/gol-on-chain-nft.git
```

Install NPM packages
```sh
npm ci
```

Compile contracts
```sh
npx hardhat compile
```

Run tests
```sh
npx hardhat test
```

## What does "on-chain" mean?

Typically, what an NFT represents (e.g. an image) is not stored on the blockchain itself. Instead, an NFT contract usually provides a method for returning a URI for a given token ID, and that URI can be used to access the metadata for the NFT (e.g. a link to the image).

Alternatively, the unique "something" represented by the NFT, or the code that generates this something, can live on the blockchain. For this project, a "seed" (e.g. a cryptographically secure pseudorandom random number generated off chain) is provided when minting the NFT. The NFT contract then has a `draw` function that generates a 64x64 grid of x's (live cells) and o's (dead cells) from the `seed`. This grid serves as the initial state for GoL. From there, the GoL algorithm can be used to bring the NFT to life, if someone so desires.

Because the contract code (e.g. the `draw` function) and state (e.g. the `seed`) used to generate the art is stored on the blockchain, the art is said to be "on-chain." This can be taken one step further by writing the results of the `draw` function to transaction logs when the NFT is minted (e.g. see `mintAndLog` in the `NFTTest` contract).

The method described above is essentially how [Autoglyphs](https://www.larvalabs.com/autoglyphs) implemented "on-chain" generative art.

## Disclaimer

This is currently an experiment and as such, gas usage has not been optimized and there are likely security issues. In their current state, the contracts in this project are not meant to be deployed to a public network like Ethereum's "Mainnet" or "testnets."