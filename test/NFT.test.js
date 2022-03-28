const { ethers } = require("hardhat");
const { expect } = require("chai");

describe("NFT tests", function() {

    /*
     * NOTE: If it takes too long to deploy the contract for
     * each test, then I can deploy it once in a before hook,
     * and share the contract instance amongst tests. the
     * downside is tests will share contract state from one test
     * to the next, so a previous test could cause a later test
     * to fail if we're not careful.
     */

    async function deployNFTContract() {
        const NFT = await ethers.getContractFactory("NFT");
        const nft = await NFT.deploy()
        await nft.deployed();
        return nft;
    }

    it("should mint a new NFT", async function() {
        const nft = await deployNFTContract();
        const [deployer, acct2] = await ethers.getSigners()
        await nft.mintTo(deployer.address);

        const address = await nft.ownerOf(1);
        const numOwnedByDeployer = await nft.balanceOf(deployer.address);
        const numOwnedByAcct2 = await nft.balanceOf(acct2.address);
        expect(address).to.equal(deployer.address);
        expect(numOwnedByDeployer).to.equal(1);
        expect(numOwnedByAcct2).to.equal(0);
    })

    it("should set the base token URI", async function() {
        const BASE_TOKEN_URI = "https://example.com/"
        const nft = await deployNFTContract();
        const [deployer] = await ethers.getSigners()

        await nft.setBaseTokenURI(BASE_TOKEN_URI);
        await nft.mintTo(deployer.address);

        expect(await nft.tokenURI(1)).to.equal(`${BASE_TOKEN_URI}1`);
    })
})