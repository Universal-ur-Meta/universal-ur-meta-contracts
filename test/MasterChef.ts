import chai, { assert } from "chai"

import { ethers } from "hardhat"
import { Contract, Signer } from "ethers"
import { solidity } from "ethereum-waffle"

import UniswapV2FactoryArtifacts from "@uniswap/v2-core/build/UniswapV2Factory.json"
import UniswapV2PairArtifacts from "@uniswap/v2-core/build/UniswapV2Pair.json"
import WETH9Artifacts from "@uniswap/v2-periphery/build/WETH9.json"
import {increaseTime, mineBlock} from "./Helper";

const { AddressZero } = ethers.constants

chai.use(solidity)

describe("MasterChef", function () {
    let accounts: Signer[];

    let OWNER_SIGNER: any;
    let DEV_SIGNER: any;
    let ALICE_SIGNER: any;

    let OWNER: any;
    let DEV: any;
    let ALICE: any;

    let farm: any
    let umToken: any
    let voucher: any

    let factory: any

    let weth: any
    let usd: any

    const MAX_SUPPLY = "10000000000000000000000000000"

    let getPairAddress: any = async function (tokenA: string, tokenB: string): Promise<Contract> {
        const UniswapV2Pair = await ethers.getContractFactory(
            UniswapV2PairArtifacts.abi,
            UniswapV2PairArtifacts.bytecode
        );

        return UniswapV2Pair.attach(
            String(await factory.getPair(tokenA, tokenB))
        )
    }

    before("config", async () => {
        accounts = await ethers.getSigners();

        OWNER_SIGNER = accounts[0];
        DEV_SIGNER = accounts[1];
        ALICE_SIGNER = accounts[2];
        OWNER = await OWNER_SIGNER.getAddress();
        DEV = await DEV_SIGNER.getAddress();
        ALICE = await ALICE_SIGNER.getAddress();

        const UMToken = await ethers.getContractFactory("UMToken");
        const MasterChef = await ethers.getContractFactory("MasterChef");
        const ERC20Mock = await ethers.getContractFactory("ERC20Mock");
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

        const umPerBlock = "1000000"
        const startBlock = 0
        farm = await MasterChef.deploy(
            umToken.address,
            OWNER,
            umPerBlock,
            startBlock
        )
        await farm.deployed()

        factory = await UniswapV2Factory.deploy(OWNER)
        await factory.deployed()

        weth = await WETH9.deploy()
        await weth.deployed()

        await factory.createPair(weth.address, usd.address);
        let WETH_USD: Contract = await getPairAddress(weth.address, usd.address)

        console.log(`Pair: ${WETH_USD.address}`)

        await usd.mint(WETH_USD.address, 50000000000)
        await weth.deposit({value: 10000000000})
        await weth.transfer(WETH_USD.address, 10000000000)

        await WETH_USD.mint(ALICE)

        console.log(await WETH_USD.balanceOf(AddressZero))
        console.log(await WETH_USD.balanceOf(ALICE))
        console.log(await WETH_USD.balanceOf(OWNER))

        const MINTER_ROLE = await umToken.MINTER_ROLE()
        await umToken.grantRole(MINTER_ROLE, farm.address)
    })

    describe('success cases', () => {
        it('#add', async () => {
            let WETH_USD: Contract = await getPairAddress(weth.address, usd.address)
            await farm.add(
                100,
                WETH_USD.address,
                true
            )
        })

        it('#set', async () => {
            await farm.set(
                0,
                99,
                true
            )
            await farm.set(
                0,
                101,
                false
            )
            await farm.set(
                0,
                100,
                true
            )
        })

        it('#setRewardMultiplier', async () => {
            await farm.setRewardMultiplier(10)
            assert.equal(Number(await farm.rewardMultiplier()), 10, "Reward multiplier 10")
            await farm.setRewardMultiplier(1)
            assert.equal(Number(await farm.rewardMultiplier()), 1, "Reward multiplier 1")
        })

        it('#deposit', async () => {
            let WETH_USD: Contract = await getPairAddress(weth.address, usd.address)
            await WETH_USD.connect(ALICE_SIGNER).approve(farm.address, "1000")
            await farm.connect(ALICE_SIGNER).deposit(0, "1000")
            console.log(await farm.pendingReward(0, ALICE))
            await mineBlock()
            console.log(await farm.pendingReward(0, ALICE))
            await mineBlock()
            console.log(await farm.pendingReward(0, ALICE))
        })

        it('#withdraw', async () => {
            let WETH_USD: Contract = await getPairAddress(weth.address, usd.address)

            console.log(await farm.pendingReward(0, ALICE))
            await farm.connect(ALICE_SIGNER).withdraw(0, "1000")

            console.log(await farm.pendingReward(0, ALICE))
            console.log(await WETH_USD.balanceOf(ALICE))
            console.log(await umToken.balanceOf(ALICE))
        })
    })
})