import chai, { assert } from "chai"

import { ethers } from "hardhat"
import { Signer } from "ethers"
import { solidity } from "ethereum-waffle"

const { constants } = ethers
const { MaxUint256 } = constants

chai.use(solidity)

describe("UM with USDX sales", function () {
    let accounts: Signer[];

    let OWNER_SIGNER: any;
    let DEV_SIGNER: any;
    let ALICE_SIGNER: any;

    let OWNER: any;
    let DEV: any;
    let ALICE: any;

    let sales: any
    let umToken: any
    let voucher: any

    let depositToken: any

    const MAX_SUPPLY = "10000000000000000000000000000"

    before("config", async () => {
        accounts = await ethers.getSigners();

        OWNER_SIGNER = accounts[0];
        DEV_SIGNER = accounts[1];
        ALICE_SIGNER = accounts[2];
        OWNER = await OWNER_SIGNER.getAddress();
        DEV = await DEV_SIGNER.getAddress();
        ALICE = await ALICE_SIGNER.getAddress();

        const UMToken = await ethers.getContractFactory("UMToken");
        const PresaleTicket = await ethers.getContractFactory("PresaleTicket");
        const UMUSDXSales = await ethers.getContractFactory("UMUSDXSales");
        const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
        const ERC1155Mock = await ethers.getContractFactory("ERC1155Mock");

        umToken = await UMToken.deploy(OWNER, MAX_SUPPLY)
        await umToken.deployed()

        voucher = await PresaleTicket.deploy(OWNER)
        await voucher.deployed()

        sales = await UMUSDXSales.deploy(umToken.address, voucher.address, OWNER)
        await sales.deployed()

        depositToken = await ERC20Mock.deploy()
        await depositToken.deployed()

        await sales.setDepositToken(depositToken.address)

        const MINTER_ROLE = await umToken.MINTER_ROLE()
        await umToken.grantRole(MINTER_ROLE, sales.address)
        await voucher.grantRole(MINTER_ROLE, sales.address)
    })

    describe('success cases', () => {
        it('#mint', async () => {
            await depositToken.mint(ALICE, "1000000")
            await depositToken.connect(ALICE_SIGNER).approve(sales.address, MaxUint256)

            // presale
            await sales.setRoundWithDetails(1, 1, 1)
            await sales.setGiftPrice(1)

            await sales.connect(ALICE_SIGNER).mint(1)

            assert.equal(Number(await umToken.balanceOf(ALICE)), 1000000000000000000, "Um token balance 1UM")
            assert.equal(Number(await voucher.balanceOf(ALICE, 0)), 1, "Voucher balance 1")

            // sale
            await sales.setRoundWithDetails(2, 1, 1)

            await sales.connect(ALICE_SIGNER).mint(1)

            assert.equal(Number(await umToken.balanceOf(ALICE)), 2000000000000000000, "Um token balance 2UM")
            assert.equal(Number(await voucher.balanceOf(ALICE, 0)), 1, "Voucher balance 1")
        })
    })
})