// SPDX-License-Identifier: MIT
// Modified and copied from SushiSwap/MasterChef

pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IFungibleToken.sol";
import "../interfaces/IMigratorChef.sol";

// @title MasterChef - farming/staking contract.
//
// Note that it's ownable and the owner wields tremendous power. The ownership
// will be transferred to a governance smart contract once UM is sufficiently
// distributed and the community can show to govern itself.
//
// Have fun reading it. Hopefully it's bug-free. God bless.
contract MasterChef is Ownable {
    using SafeERC20 for IERC20;
    using SafeERC20 for IFungibleToken;
    // Info of each user.
    struct UserInfo {
        uint256 amount; // How many LP tokens the user has provided.
        uint256 rewardDebt; // Reward debt. See explanation below.
        //
        // We do some fancy math here. Basically, any point in time, the amount of UMs
        // entitled to a user but is pending to be distributed is:
        //
        //   pending reward = (user.amount * pool.accTokensPerShare) - user.rewardDebt
        //
        // Whenever a user deposits or withdraws LP tokens to a pool. Here's what happens:
        //   1. The pool's `accTokensPerShare` (and `lastRewardBlock`) gets updated.
        //   2. User receives the pending reward sent to his/her address.
        //   3. User's `amount` gets updated.
        //   4. User's `rewardDebt` gets updated.
    }
    // Info of each pool.
    struct PoolInfo {
        IERC20 lpToken; // Address of LP token contract.
        uint256 allocPoint; // How many allocation points assigned to this pool. UMs to distribute per block.
        uint256 lastRewardBlock; // Last block number that UMs distribution occurs.
        uint256 accTokensPerShare; // Accumulated UMs per share, times 1e12. See below.
    }
    // The UM TOKEN!
    IFungibleToken public immutable umToken;
    // Dev address.
    address public devaddr;
    // UM tokens created per block.
    uint256 public umPerBlock;
    // Bonus muliplier for early umToken makers.
    uint256 public rewardMultiplier = 1;
    // The migrator contract. It has a lot of power. Can only be set through governance (owner).
    IMigratorChef public migrator;
    // Info of each pool.
    PoolInfo[] public poolInfo;
    // Info of each user that stakes LP tokens.
    mapping(uint256 => mapping(address => UserInfo)) public userInfo;
    // Total allocation poitns. Must be the sum of all allocation points in all pools.
    uint256 public totalAllocPoint = 0;
    // The block number when UM mining starts.
    uint256 public startBlock;
    // Blocked LP for add func.
    mapping (address => bool) internal _uniqLPs;

    event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event EmergencyWithdraw(
        address indexed user,
        uint256 indexed pid,
        uint256 amount
    );

    constructor(
        IFungibleToken _umToken,
        address _devaddr,
        uint256 _umPerBlock,
        uint256 _startBlock
    ) {
        umToken = _umToken;
        devaddr = _devaddr;
        umPerBlock = _umPerBlock;
        startBlock = _startBlock;
    }

    function poolLength() external view returns (uint256 length) {
        length = poolInfo.length;
    }

    // Add a new lp to the pool. Can only be called by the owner.
    function add(
        uint256 _allocPoint,
        IERC20 _lpToken,
        bool _withUpdate
    ) public onlyOwner {
        require(!_uniqLPs[address(_lpToken)], "LP already added");
        _uniqLPs[address(_lpToken)] = true;
        if (_withUpdate) {
            massUpdatePools();
        }
        uint256 lastRewardBlock =
        block.number > startBlock ? block.number : startBlock;
        totalAllocPoint = totalAllocPoint + _allocPoint;
        poolInfo.push(
            PoolInfo({
                lpToken: _lpToken,
                allocPoint: _allocPoint,
                lastRewardBlock: lastRewardBlock,
                accTokensPerShare: 0
            })
        );
    }

    // Update the given pool's UM allocation point. Can only be called by the owner.
    function set(
        uint256 _pid,
        uint256 _allocPoint,
        bool _withUpdate
    ) public onlyOwner {
        if (_withUpdate) {
            massUpdatePools();
        }
        uint256 prevAllocPoint = poolInfo[_pid].allocPoint;
        poolInfo[_pid].allocPoint = _allocPoint;
        if (prevAllocPoint != _allocPoint) {
            totalAllocPoint = totalAllocPoint - prevAllocPoint + _allocPoint;
        }
    }

    // Set the migrator contract. Can only be called by the owner.
    function setMigrator(IMigratorChef _migrator) public onlyOwner {
        migrator = _migrator;
    }

    // Set reward multiplier. Zero set disable mining
    function setRewardMultiplier(uint256 _multiplier) public onlyOwner {
        rewardMultiplier = _multiplier;
    }

    // Migrate lp token to another lp contract. Can be called by anyone. We trust that migrator contract is good.
    function migrate(uint256 _pid) public {
        require(address(migrator) != address(0), "migrate: no migrator");
        PoolInfo storage pool = poolInfo[_pid];
        IERC20 lpToken = pool.lpToken;
        uint256 bal = lpToken.balanceOf(address(this));
        lpToken.safeApprove(address(migrator), bal);
        IERC20 newLpToken = migrator.migrate(lpToken);
        require(bal == newLpToken.balanceOf(address(this)), "migrate: bad");
        pool.lpToken = newLpToken;
    }

    // Return reward multiplier over the given _from to _to block.
    function getMultiplier(uint256 _from, uint256 _to)
        public
        view
        returns (uint256 multiplier)
    {
        multiplier = (_to - _from) * rewardMultiplier;
    }

    // View function to see pending UMs on frontend.
    function pendingReward(uint256 _pid, address _user)
        external
        view
        returns (uint256 reward)
    {
        PoolInfo memory pool = poolInfo[_pid];
        UserInfo memory user = userInfo[_pid][_user];
        uint256 accTokensPerShare = pool.accTokensPerShare;
        uint256 lpSupply = pool.lpToken.balanceOf(address(this));
        if (block.number > pool.lastRewardBlock && lpSupply != 0) {
            uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
            uint256 umReward = multiplier * umPerBlock * pool.allocPoint / totalAllocPoint;
            accTokensPerShare = accTokensPerShare + (umReward * 1e12 / lpSupply);
        }
        reward = user.amount * accTokensPerShare / 1e12 - user.rewardDebt;
    }

    // Update reward vairables for all pools. Be careful of gas spending!
    function massUpdatePools() public {
        uint256 length = poolInfo.length;
        for (uint256 pid = 0; pid < length; ++pid) {
            updatePool(pid);
        }
    }

    // Update reward variables of the given pool to be up-to-date.
    function updatePool(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        if (block.number <= pool.lastRewardBlock) {
            return;
        }
        uint256 lpSupply = pool.lpToken.balanceOf(address(this));
        if (lpSupply == 0) {
            pool.lastRewardBlock = block.number;
            return;
        }
        uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
        uint256 umReward = multiplier * umPerBlock * pool.allocPoint / totalAllocPoint;

        umToken.mint(devaddr, umReward / 10);
        umToken.mint(address(this), umReward);

        pool.accTokensPerShare = pool.accTokensPerShare + (umReward * 1e12 / lpSupply);
        pool.lastRewardBlock = block.number;
    }

    // Deposit LP tokens to MasterChef for UM allocation.
    function deposit(uint256 _pid, uint256 _amount) public {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        updatePool(_pid);
        if (user.amount > 0) {
            uint256 pending = (user.amount * pool.accTokensPerShare / 1e12) - user.rewardDebt;
            _safeUMTransfer(msg.sender, pending);
        }
        pool.lpToken.safeTransferFrom(
            address(msg.sender),
            address(this),
            _amount
        );
        user.amount = user.amount + _amount;
        user.rewardDebt = user.amount * pool.accTokensPerShare / 1e12;
        emit Deposit(msg.sender, _pid, _amount);
    }

    // Withdraw LP tokens from MasterChef.
    function withdraw(uint256 _pid, uint256 _amount) public {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        require(user.amount >= _amount, "withdraw: not good");
        updatePool(_pid);
        uint256 pending = (user.amount * pool.accTokensPerShare / 1e12) - user.rewardDebt;
        if (pending > 0) {
            _safeUMTransfer(msg.sender, pending);
        }
        if (_amount > 0) {
            user.amount = user.amount - _amount;
            pool.lpToken.safeTransfer(address(msg.sender), _amount);
        }
        user.rewardDebt = user.amount * pool.accTokensPerShare / 1e12;
        emit Withdraw(msg.sender, _pid, _amount);
    }

    // Withdraw without caring about rewards. EMERGENCY ONLY.
    function emergencyWithdraw(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        pool.lpToken.safeTransfer(address(msg.sender), user.amount);
        emit EmergencyWithdraw(msg.sender, _pid, user.amount);
        user.amount = 0;
        user.rewardDebt = 0;
    }

    // Safe umToken transfer function, just in case if rounding error causes pool to not have enough UMs.
    function _safeUMTransfer(address _to, uint256 _amount) internal {
        uint256 umBalance = umToken.balanceOf(address(this));
        if (_amount > umBalance) {
            umToken.safeTransfer(_to, umBalance);
        } else {
            umToken.safeTransfer(_to, _amount);
        }
    }

    // Update dev address by the previous dev.
    function dev(address _devaddr) public {
        require(msg.sender == devaddr, "dev: wut?");
        devaddr = _devaddr;
    }
}
