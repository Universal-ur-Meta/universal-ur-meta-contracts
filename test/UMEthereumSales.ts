import chai, { assert } from "chai"

import { ethers } from "hardhat"
import {BigNumber, Contract, Signer} from "ethers"
import { solidity } from "ethereum-waffle"

import UniswapV2FactoryArtifacts from "@uniswap/v2-core/build/UniswapV2Factory.json"
import UniswapV2PairArtifacts from "@uniswap/v2-core/build/UniswapV2Pair.json"
import WETH9Artifacts from "@uniswap/v2-periphery/build/WETH9.json"
import {increaseTime} from "./Helper";
import {parseEther} from "ethers/lib/utils";

chai.use(solidity)

describe("UM with ETH sales", function () {
    let accounts: Signer[];

    let OWNER_SIGNER: any;
    let DEV_SIGNER: any;
    let ALICE_SIGNER: any;
    let BOB_SIGNER: any;

    let OWNER: any;
    let DEV: any;
    let ALICE: any;
    let BOB: any;

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
        BOB_SIGNER = accounts[3];
        OWNER = await OWNER_SIGNER.getAddress();
        DEV = await DEV_SIGNER.getAddress();
        ALICE = await ALICE_SIGNER.getAddress();
        BOB = await BOB_SIGNER.getAddress();

        const UMToken = await ethers.getContractFactory("UMToken");
        const PresaleTicket = await ethers.getContractFactory("PresaleTicket");
        const UMEthereumSales = await ethers.getContractFactory("UMEthereumSales");
        const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
        const ExampleOracleSimple = await ethers.getContractFactory("ExampleOracleSimple");
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

        weth = await WETH9.deploy()
        await weth.deployed()

        sales = await UMEthereumSales.deploy(umToken.address, voucher.address, OWNER, weth.address)
        await sales.deployed()

        factory = await UniswapV2Factory.deploy(OWNER)
        await factory.deployed()

        await factory.createPair(weth.address, usd.address);
        let pair: Contract = await UniswapV2Pair.attach(
            String(await factory.getPair(weth.address, usd.address))
        )

        console.log(`Pair: ${pair.address}`)

        await usd.mint(pair.address, parseEther('2066.98'))
        await weth.deposit({value: parseEther('1.0')})
        await weth.transfer(pair.address, parseEther('1.0'))

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
        it('#oracle', async () => {
            let price = parseEther('0.03')
            let ethPerToken = await oracle.consult(usd.address, price)

            await sales.setRoundWithDetails(2, price, 100000000)

            assert.equal(String(ethPerToken), String(await sales.countInputAmount(1)), 'consult vs countInputAmount')
        })

        it('#mint', async () => {
            await sales.setRoundWithDetails(1, parseEther('0.03'), 1)
            await sales.setGiftPrice(parseEther('0.03'))

            let inputAmount = await sales.countInputAmount(1);
            console.log(inputAmount)
            await sales.connect(BOB_SIGNER).mint(1, {value: inputAmount})
            assert.equal((await umToken.balanceOf(BOB)).toString(), String(parseEther('1.0')), "Um token balance bob")
            assert.equal(Number(await voucher.balanceOf(BOB, 0)), 1, "Voucher balance 1")

            await sales.setRoundWithDetails(2, parseEther('0.03'), 1)
            await sales.setGiftPrice(parseEther('0.03'))

            await sales.connect(BOB_SIGNER).mint(1, {value: inputAmount})
            assert.equal((await umToken.balanceOf(BOB)).toString(), String(parseEther('2.0')), "Um token balance bob")
            assert.equal(Number(await voucher.balanceOf(BOB, 0)), 1, "Voucher balance 1")
        })
    })
})
