const { ethers } = require("hardhat");
const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
const expect = chai.expect;

chai.use(chaiAsPromised);

describe("NFT tests", function() {
    const MINT_PRICE = ethers.utils.parseEther("0.01");
    const MAX_SUPPLY = 10;

    function solidityKeccak256ToUint256(num) {
        // Discovered through trial and error that abi.encodePacked(num) is the number
        // padded to 256 bits (32 bytes). That's all we're doing here: turning num into
        // a 32 byte number and representing it as a hex string (though a byte array
        // might work too)
        const numEncodePacked = ethers.utils.hexZeroPad(ethers.utils.hexlify(num), 32);
        const hash = ethers.utils.keccak256(numEncodePacked);
        return ethers.BigNumber.from(hash);
    }

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

    async function deployTestNFTContract() {
        const NFTTest = await ethers.getContractFactory("NFTTest");
        const nft = await NFTTest.deploy()
        await nft.deployed();
        return nft;
    }

    it("should mint a new NFT", async function() {
        const nft = await deployNFTContract();
        const [deployer, acct2] = await ethers.getSigners()
        await nft.mintTo(deployer.address, 1, {
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
        await expect(nft.mintTo(deployer.address, 1, {
            value: MINT_PRICE.sub(ethers.utils.parseUnits("1", "wei")),
        })).to.be.rejected;
        expect(await nft.balanceOf(deployer.address)).to.equal(0);
    })

    it("should set the base token URI", async function() {
        const BASE_TOKEN_URI = "https://example.com/"
        const nft = await deployNFTContract();
        const [deployer] = await ethers.getSigners()

        await nft.setBaseTokenURI(BASE_TOKEN_URI);
        await nft.mintTo(deployer.address, 1, {
            value: MINT_PRICE,
        });

        expect(await nft.tokenURI(1)).to.equal(`${BASE_TOKEN_URI}1`);
    })

    it("should let the owner withdraw funds", async function() {
        const nft = await deployNFTContract();
        const [deployer, acct2] = await ethers.getSigners();

        expect(await nft.owner()).to.equal(deployer.address);
        await nft.mintTo(acct2.address, 1, {
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
        const mint = (seed) => nft.mintTo(deployer.address, seed, {
            value: MINT_PRICE,
        });

        for (let i = 0; i < MAX_SUPPLY; i++) {
            await mint(i);
        }

        await expect(mint(100)).to.be.rejected;
    })

    it("should return the initial state that's a 128 x 128 grid", async function() {
        const nft = await deployNFTContract();
        const [deployer] = await ethers.getSigners();
        await nft.mintTo(deployer.address, 1, {
            value: MINT_PRICE,
        });

        const initialState = await nft.draw(1);
        const rows = initialState.split("\n");
        rows.pop() // Last row will be empty
        expect(rows.length).to.equal(128);
        for (let i = 0; i < rows.length; i++) {
            expect(rows[i].length).to.equal(128);
        }
    })

    it("should not mint an NFT if the seed is already taken", async function() {
        const nft = await deployNFTContract();
        const [deployer] = await ethers.getSigners();
        const mint = (seed) => nft.mintTo(deployer.address, seed, {
            value: MINT_PRICE,
        });
        await mint(1);
        await expect(mint(1)).to.be.rejected;
    })

    it("should not draw a token that doesn't exist", async function() {
        const nft = await deployNFTContract();
        await expect(nft.draw(1)).to.be.rejected;
    })

    it("should draw the expected initial grid", async function() {
        const expected = [
            "oooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooo",
            "ooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooox"
        ].concat(Array(126).fill(
            "xxxxxxxxooooooooxxxxxxxxooooooooxxxxxxxxooooooooxxxxxxxxooooooooxxxxxxxxooooooooxxxxxxxxooooooooxxxxxxxxooooooooxxxxxxxxoooooooo")
        )
        const nft = await deployTestNFTContract();
        const [deployer] = await ethers.getSigners()
        await nft.mintTo(deployer.address, 1, {
            value: MINT_PRICE,
        });
        const initialState = await nft.draw(1)
        const rows = initialState.split("\n");
        rows.pop() // Last row will be empty
        expect(rows).to.deep.equal(expected)
    })

    it("should produce the expected initial state", async function() {
        const expected = []
        const nft = await deployNFTContract();
        const [deployer] = await ethers.getSigners()
        await nft.mintTo(deployer.address, 1, {
            value: MINT_PRICE,
        });
        const initialState = await nft.getInitialState(1);

        // The seed is 1, so initial state is just the
        // keccak256 hash of 1 to 64, converted to uint256's
        for (let i = 1; i <= 64; i++) {
            expected.push(solidityKeccak256ToUint256(i))
        }
        expect(initialState).to.deep.equal(expected)
    })
})