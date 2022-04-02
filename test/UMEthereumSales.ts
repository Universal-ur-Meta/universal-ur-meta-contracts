import chai, { assert } from "chai"

import { ethers } from "hardhat"
import { Contract, Signer } from "ethers"
import { solidity } from "ethereum-waffle"

import UniswapV2FactoryArtifacts from "@uniswap/v2-core/build/UniswapV2Factory.json"
import UniswapV2PairArtifacts from "@uniswap/v2-core/build/UniswapV2Pair.json"
import ExampleOracleSimpleArtifacts from "@uniswap/v2-periphery/build/ExampleOracleSimple.json"
import WETH9Artifacts from "@uniswap/v2-periphery/build/WETH9.json"
import {increaseTime} from "./Helper";

chai.use(solidity)

describe("UM with ETH sales", function () {
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

    let factory: any
    let oracle: any

    let weth: any
    let usd: any

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
        const UMEthereumSales = await ethers.getContractFactory("UMEthereumSales");
        const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
        const ExampleOracleSimple = await ethers.getContractFactory(
            ExampleOracleSimpleArtifacts.abi,
            ExampleOracleSimpleArtifacts.bytecode
        );
        const UniswapV2Factory = await ethers.getContractFactory(
            UniswapV2FactoryArtifacts.abi,
            UniswapV2FactoryArtifacts.bytecode
        );
        const WETH9 = await ethers.getContractFactory(
            WETH9Artifacts.abi,
            WETH9Artifacts.bytecode
        );
        const UniswapV2Pair = await ethers.getContractFactory(
            UniswapV2PairArtifacts.abi,
            UniswapV2PairArtifacts.bytecode
        );

        umToken = await UMToken.deploy(OWNER, MAX_SUPPLY)
        await umToken.deployed()

        usd = await ERC20Mock.deploy()
        await usd.deployed()

        voucher = await PresaleTicket.deploy(OWNER)
        await voucher.deployed()

        sales = await UMEthereumSales.deploy(umToken.address, voucher.address, OWNER)
        await sales.deployed()

        factory = await UniswapV2Factory.deploy(OWNER)
        await factory.deployed()

        weth = await WETH9.deploy()
        await weth.deployed()

        await factory.createPair(weth.address, usd.address);
        let pair: Contract = await UniswapV2Pair.attach(
            String(await factory.getPair(weth.address, usd.address))
        )

        console.log(`Pair: ${pair.address}`)

        await usd.mint(pair.address, 50000000000)
        await weth.deposit({value: 10000000000})
        await weth.transfer(pair.address, 10000000000)

        await pair.sync()

        oracle = await ExampleOracleSimple.deploy(factory.address, weth.address, usd.address)
        await oracle.deployed()

        const MINTER_ROLE = await umToken.MINTER_ROLE()
        await umToken.grantRole(MINTER_ROLE, sales.address)
        await voucher.grantRole(MINTER_ROLE, sales.address)

        await sales.setPriceOracle(oracle.address, usd.address)

        await increaseTime(Number(await oracle.PERIOD()) + 100)

        await oracle.update()
    })

    describe('success cases', () => {
        it('#mint', async () => {
            // presale
            await sales.setRoundWithDetails(1, 10000, 1)
            await sales.setGiftPrice(100)

            console.log(await oracle.consult(usd.address, 100000000))
            console.log(await sales.countOutputAmount(100000000))

            await sales.connect(ALICE_SIGNER).mint({value: 100000000})

            assert.equal(Number(await voucher.balanceOf(ALICE, 0)), 199999, "Voucher balance 1")
            assert.equal(Number(await umToken.balanceOf(ALICE)), 1999, "Um token balance 1999UM")

            // sale
            await sales.setRoundWithDetails(2, 10000, 1)

            await sales.connect(ALICE_SIGNER).mint({value: 100000000})

            console.log((await oracle.consult(usd.address, 100000000)).div(10000).toString())
            assert.equal(Number(await umToken.balanceOf(ALICE)), 3998, "Um token balance 3998UM")
        })
    })
})