const { ethers } = require("hardhat");
const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
const expect = chai.expect;

chai.use(chaiAsPromised);

describe("NFT tests", function() {
    const MINT_PRICE = ethers.utils.parseEther("0.01");
    const MAX_SUPPLY = 10;

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
        await nft.mintTo(deployer.address, {
            value: MINT_PRICE,
        });

        const address = await nft.ownerOf(1);
        const numOwnedByDeployer = await nft.balanceOf(deployer.address);
        const numOwnedByAcct2 = await nft.balanceOf(acct2.address);
        expect(address).to.equal(deployer.address);
        expect(numOwnedByDeployer).to.equal(1);
        expect(numOwnedByAcct2).to.equal(0);
    })

    it("should not mint an NFT if the tx value is too low", async function() {
        const nft = await deployNFTContract();
        const [deployer] = await ethers.getSigners()
        await expect(nft.mintTo(deployer.address, {
            value: MINT_PRICE.sub(ethers.utils.parseUnits("1", "wei")),
        })).to.be.rejected;
        expect(await nft.balanceOf(deployer.address)).to.equal(0);
    })

    it("should set the base token URI", async function() {
        const BASE_TOKEN_URI = "https://example.com/"
        const nft = await deployNFTContract();
        const [deployer] = await ethers.getSigners()

        await nft.setBaseTokenURI(BASE_TOKEN_URI);
        await nft.mintTo(deployer.address, {
            value: MINT_PRICE,
        });

        expect(await nft.tokenURI(1)).to.equal(`${BASE_TOKEN_URI}1`);
    })

    it("should let the owner withdraw funds", async function() {
        const nft = await deployNFTContract();
        const [deployer, acct2] = await ethers.getSigners();

        expect(await nft.owner()).to.equal(deployer.address);
        await nft.mintTo(acct2.address, {
            value: MINT_PRICE,
        });

        const paymentDue = await nft.payments(deployer.address);
        expect(paymentDue).to.equal(MINT_PRICE); // Waffle handles equality of BigNumbers.

        // The following amount should be deposited into the owner's account:
        // [Mint Price] - [gas fee for calling withdrawPayments]
        const beforeBalance = await deployer.getBalance();
        const tx = await nft.withdrawPayments(deployer.address);
        const afterBalance = await deployer.getBalance();

        const txReceipt = await tx.wait();
        const gasFee = txReceipt.gasUsed.mul(txReceipt.effectiveGasPrice);
        const expectedDeposit = MINT_PRICE.sub(gasFee)
        const actualDeposit = afterBalance.sub(beforeBalance);
        expect(actualDeposit).to.equal(expectedDeposit);
    })

    it("should not let a non-owner withdraw funds", async function() {
        const acct2 = (await ethers.getSigners())[1];
        let nft = await deployNFTContract();
        nft = await nft.connect(acct2)
        await expect(nft.withdrawPayments(acct2.address)).to.be.rejected;
    })

    it("should not mint more than 10", async function() {
        const nft = await deployNFTContract();
        const [deployer] = await ethers.getSigners();
        const mint = () => nft.mintTo(deployer.address, {
            value: MINT_PRICE,
        });

        for (let i = 0; i < MAX_SUPPLY; i++) {
            await mint();
        }

        await expect(mint()).to.be.rejected;
    })
})