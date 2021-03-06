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

        const MINTER_ROLE = await umToken.MINTER_ROLE()

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

        await usd.mint(WETH_USD.address, "5000000000000000000")
        await weth.deposit({value: "100000000000000"})
        await weth.transfer(WETH_USD.address, "100000000000000")

        await WETH_USD.mint(ALICE)

        console.log(await WETH_USD.balanceOf(AddressZero))
        console.log(await WETH_USD.balanceOf(ALICE))
        console.log(await WETH_USD.balanceOf(OWNER))


        await factory.createPair(weth.address, umToken.address);
        let WETH_UM: Contract = await getPairAddress(weth.address, umToken.address)

        console.log(`Pair: ${WETH_UM.address}`)

        await umToken.grantRole(MINTER_ROLE, OWNER)
        await umToken.mint(WETH_UM.address, "5000000000000000")
        await weth.deposit({value: "1000000000000000"})
        await weth.transfer(WETH_UM.address, "1000000000000000")

        await WETH_UM.mint(ALICE)

        console.log(await WETH_UM.balanceOf(AddressZero))
        console.log(await WETH_UM.balanceOf(ALICE))
        console.log(await WETH_UM.balanceOf(OWNER))


        await umToken.grantRole(MINTER_ROLE, farm.address)
    })

    describe.only('success cases', () => {
        it('#add', async () => {
            let WETH_USD: Contract = await getPairAddress(weth.address, usd.address)
            await farm.add(
                100,
                WETH_USD.address,
                true
            )

            let WETH_UM: Contract = await getPairAddress(weth.address, umToken.address)
            await farm.add(
                150,
                WETH_UM.address,
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
            await WETH_USD.connect(ALICE_SIGNER).approve(farm.address, "22360679774996896")
            await farm.connect(ALICE_SIGNER).deposit(0, "22360679774996896")
            console.log(await farm.pendingReward(0, ALICE))
            await mineBlock()
            console.log(await farm.pendingReward(0, ALICE))
            await mineBlock()
            console.log(await farm.pendingReward(0, ALICE))

            let WETH_UM: Contract = await getPairAddress(weth.address, umToken.address)
            await WETH_UM.connect(ALICE_SIGNER).approve(farm.address, "2236067977498789")
            await farm.connect(ALICE_SIGNER).deposit(1, "2236067977498789")
            console.log(await farm.pendingReward(1, ALICE))
            await mineBlock()
            console.log(await farm.pendingReward(1, ALICE))
            await mineBlock()
            console.log(await farm.pendingReward(1, ALICE))
        })

        it('claim through multicall', async () => {
            await mineBlock()
            console.log(`Reward Alice pool 0: ${await farm.pendingReward(0, ALICE)}`)
            console.log(`Reward Alice pool 1: ${await farm.pendingReward(1, ALICE)}`)

            await farm.connect(ALICE_SIGNER).multicall(
                [
                    farm.interface.encodeFunctionData('deposit', [0, 0]),
                    farm.interface.encodeFunctionData('deposit', [1, 0]),
                ]
            )

            assert.equal(Number(await farm.pendingReward(0, ALICE)), 0, 'Pool reward 0 not zero?')
            assert.equal(Number(await farm.pendingReward(1, ALICE)), 0, 'Pool reward 0 not zero?')

            await mineBlock()
            console.log(`Reward Alice pool 0: ${await farm.pendingReward(0, ALICE)}`)
            console.log(`Reward Alice pool 1: ${await farm.pendingReward(1, ALICE)}`)

            await farm.connect(ALICE_SIGNER).multicall(
                [
                    farm.interface.encodeFunctionData('deposit', [0, 0]),
                    farm.interface.encodeFunctionData('deposit', [0, 0]),
                ]
            )

            assert.equal(Number(await farm.pendingReward(0, ALICE)), 0, 'Pool reward 0 not zero?')

        })

        it('#withdraw', async () => {
            let WETH_USD: Contract = await getPairAddress(weth.address, usd.address)

            console.log(await farm.pendingReward(0, ALICE))
            await farm.connect(ALICE_SIGNER).withdraw(0, "22360679774996896")

            console.log(await farm.pendingReward(0, ALICE))
            console.log(await WETH_USD.balanceOf(ALICE))
            console.log(await umToken.balanceOf(ALICE))

            let WETH_UM: Contract = await getPairAddress(weth.address, umToken.address)

            console.log(await farm.pendingReward(1, ALICE))
            await farm.connect(ALICE_SIGNER).withdraw(1, "2236067977498789")

            console.log(await farm.pendingReward(1, ALICE))
            console.log(await WETH_UM.balanceOf(ALICE))
            console.log(await umToken.balanceOf(ALICE))
        })
    })
})
