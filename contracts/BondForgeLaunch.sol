// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./BondForgeToken.sol";
import "./BondForgeNFT.sol";
import "./BondForgeLiquidityLocker.sol";
import "./BondForgeNftBuybackVault.sol";
import "./BondForgeTokenBuybackVault.sol";
import "./interfaces/IPancakeV3.sol";

contract BondForgeLaunch is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 private constant FEE_BPS = 100;
    uint24 private constant PANCAKE_POOL_FEE = 10000;
    int24 private constant MIN_TICK = -887272;
    int24 private constant MAX_TICK = 887272;
    struct InitParams {
        string name;
        string symbol;
        string tokenName;
        string tokenSymbol;
        string description;
        string imageURI;
        string bannerURI;
        string website;
        string twitter;
        string telegram;
        string nftBaseURI;
        string memeImageURI;
        uint8 nftMode;
        uint256 mintPriceWei;
        uint256 nftSupply;
        uint16 walletCapBps;
        uint16 multipleBps;
        uint32 firstDelayMinutes;
        uint16 firstUnlockBps;
        uint32 secondDelayMinutes;
        uint16 secondUnlockBps;
        uint16 hourlyUnlockBps;
        uint16 day2To7DailyBps;
        uint16 postDay7DailyBps;
    }

    string public projectName;
    string public projectSymbol;
    string public description;
    string public imageURI;
    string public bannerURI;
    string public website;
    string public twitter;
    string public telegram;

    BondForgeToken public token;
    BondForgeNFT public nft;
    address public issuer;
    address public protocolTreasury;
    address public marketplace;
    address public swapRouter;
    address public buybackNftVault;
    address public buybackTokenVault;
    address public positionManager;
    address public pancakeFactory;
    address public wrappedNativeToken;
    BondForgeLiquidityLocker public liquidityLocker;
    address public pancakePool;
    uint256 public positionTokenId;
    uint24 public pancakePoolFee = PANCAKE_POOL_FEE;

    uint256 public mintPriceWei;
    uint256 public nftSupply;
    uint256 public totalSold;
    uint256 public totalRaised;
    bool public finalized;
    uint256 public launchTime;

    uint16 public walletCapBps;
    uint16 public multipleBps;
    uint32 public firstDelayMinutes;
    uint16 public firstUnlockBps;
    uint32 public secondDelayMinutes;
    uint16 public secondUnlockBps;
    uint16 public hourlyUnlockBps;
    uint16 public day2To7DailyBps;
    uint16 public postDay7DailyBps;

    uint256 public tokensForNFT;
    uint256 public tokensForPool;
    uint256 public tokensPerNFT;
    uint256 public initialLiquidityNative;
    uint256 public initialLiquidityToken;
    uint256 public referencePricePerTokenWei;

    mapping(address => uint256) public reservationOf;
    mapping(address => uint256) public claimedReservations;
    address[] public subscribers;
    mapping(address => bool) public hasSubscribed;
    mapping(uint256 => uint256) public claimed;
    mapping(uint256 => uint256) public pausedDuration;
    mapping(uint256 => uint256) public pauseStartedAt;
    uint256[] private burnPoolIds;
    mapping(uint256 => uint256) public burnPoolRemaining;
    mapping(uint256 => bool) public burnPoolActive;

    event Subscribed(address indexed user, uint256 quantity, uint256 paid);
    event Refunded(address indexed user, uint256 quantity, uint256 returnedAmount);
    event Finalized(uint256 liquidityNative, uint256 issuerAmount, uint256 protocolAmount);
    event PancakePoolReady(address indexed pool, address indexed locker, uint256 indexed positionTokenId);
    event NFTsClaimed(address indexed user, uint256 quantity);
    event ClaimExecuted(address indexed user, uint256 indexed tokenId, uint256 amount);
    event BurnPoolListed(uint256 indexed tokenId, uint256 remaining, uint256 price);
    event BurnPoolBought(uint256 indexed tokenId, address indexed buyer, uint256 price);

    constructor(
        InitParams memory p,
        address issuer_,
        address protocolTreasury_,
        address marketplace_,
        address swapRouter_,
        address positionManager_
    ) Ownable(issuer_) {
        issuer = issuer_;
        protocolTreasury = protocolTreasury_;
        marketplace = marketplace_;
        swapRouter = swapRouter_;
        positionManager = positionManager_;

        projectName = p.name;
        projectSymbol = p.symbol;
        description = p.description;
        imageURI = p.imageURI;
        bannerURI = p.bannerURI;
        website = p.website;
        twitter = p.twitter;
        telegram = p.telegram;
        mintPriceWei = p.mintPriceWei;
        nftSupply = p.nftSupply;
        walletCapBps = p.walletCapBps;
        multipleBps = p.multipleBps;
        firstDelayMinutes = p.firstDelayMinutes;
        firstUnlockBps = p.firstUnlockBps;
        secondDelayMinutes = p.secondDelayMinutes;
        secondUnlockBps = p.secondUnlockBps;
        hourlyUnlockBps = p.hourlyUnlockBps;
        day2To7DailyBps = p.day2To7DailyBps;
        postDay7DailyBps = p.postDay7DailyBps;

        token = new BondForgeToken(p.tokenName, p.tokenSymbol, address(this));
        nft = new BondForgeNFT(string(abi.encodePacked(p.name, " NFT")), string(abi.encodePacked("NFT-", p.symbol)), p.nftBaseURI, p.memeImageURI, p.nftMode, address(this));
        pancakeFactory = IPancakeV3PositionManager(positionManager_).factory();
        wrappedNativeToken = IPancakeV3PositionManager(positionManager_).WETH9();
        buybackNftVault = address(new BondForgeNftBuybackVault(
            address(this),
            marketplace_,
            address(nft),
            address(token),
            wrappedNativeToken
        ));
        buybackTokenVault = address(new BondForgeTokenBuybackVault(
            address(this),
            address(token),
            wrappedNativeToken,
            swapRouter_,
            PANCAKE_POOL_FEE
        ));
        liquidityLocker = new BondForgeLiquidityLocker(
            address(this),
            positionManager_,
            issuer_,
            buybackNftVault,
            protocolTreasury_,
            address(token),
            wrappedNativeToken
        );
    }

    function tokenAddress() external view returns (address) { return address(token); }
    function nftAddress() external view returns (address) { return address(nft); }

    function projectCard() external view returns (
        string memory,
        string memory,
        string memory,
        string memory,
        string memory,
        string memory,
        string memory,
        string memory,
        address,
        address,
        address,
        uint256,
        uint256,
        uint256,
        bool
    ) {
        return (projectName, projectSymbol, description, website, twitter, telegram, imageURI, bannerURI, address(token), address(nft), issuer, mintPriceWei, totalSold, nftSupply, finalized);
    }

    function subscribe(uint256 quantity) external payable nonReentrant {
        require(!finalized, "already finalized");
        require(quantity > 0, "qty=0");
        require(totalSold + quantity <= nftSupply, "sold out");
        uint256 cap = (nftSupply * walletCapBps) / 10_000;
        if (cap == 0) cap = 1;
        require(reservationOf[msg.sender] + quantity <= cap, "wallet cap");
        uint256 cost = mintPriceWei * quantity;
        require(msg.value == cost, "wrong value");
        if (!hasSubscribed[msg.sender]) { hasSubscribed[msg.sender] = true; subscribers.push(msg.sender); }
        reservationOf[msg.sender] += quantity;
        totalSold += quantity;
        totalRaised += cost;
        emit Subscribed(msg.sender, quantity, cost);
    }

    function refund(uint256 quantity) external nonReentrant {
        require(!finalized, "already finalized");
        require(quantity > 0 && reservationOf[msg.sender] >= quantity, "bad qty");
        reservationOf[msg.sender] -= quantity;
        totalSold -= quantity;
        uint256 paid = mintPriceWei * quantity;
        totalRaised -= paid;
        uint256 returnedAmount = (paid * 99) / 100;
        uint256 feeAmount = paid - returnedAmount;
        _distributeNativeFee(feeAmount);
        (bool ok,) = payable(msg.sender).call{value: returnedAmount}("");
        require(ok, "refund failed");
        emit Refunded(msg.sender, quantity, returnedAmount);
    }

    function finalizeLaunch() external nonReentrant {
        require(!finalized, "already finalized");
        require(totalSold == nftSupply, "not full");
        finalized = true;
        launchTime = block.timestamp;

        uint256 protocolAmount = (totalRaised * 5) / 100;
        uint256 issuerAmount = (totalRaised * 5) / 100;
        uint256 liquidityAmount = totalRaised - protocolAmount - issuerAmount;
        _safeTransferNative(protocolTreasury, protocolAmount);
        _safeTransferNative(issuer, issuerAmount);

        uint256 denom = 10_000 + multipleBps;
        tokensForPool = (token.totalSupply() * 10_000) / denom;
        tokensForNFT = token.totalSupply() - tokensForPool;
        tokensPerNFT = tokensForNFT / nftSupply;
        initialLiquidityNative = liquidityAmount;
        initialLiquidityToken = tokensForPool;
        referencePricePerTokenWei = tokensForPool > 0 ? (liquidityAmount * 1e18) / tokensForPool : 0;

        _provisionPancakeLiquidity(liquidityAmount, tokensForPool);
        emit Finalized(liquidityAmount, issuerAmount, protocolAmount);
    }

    function collectPoolFees() external nonReentrant returns (uint256 amountProjectToken, uint256 amountWrappedNative) {
        require(finalized, "not finalized");
        if (positionTokenId != 0) {
            liquidityLocker.syncPositionTokenId(positionTokenId);
        }
        return liquidityLocker.collectFees();
    }

    function claimableNFTs(address user) public view returns (uint256) {
        uint256 reserved = reservationOf[user];
        uint256 alreadyClaimed = claimedReservations[user];
        return reserved > alreadyClaimed ? reserved - alreadyClaimed : 0;
    }

    function claimNFTs(uint256 quantity) external nonReentrant returns (uint256 mintedQuantity) {
        return _claimReservedNFTs(msg.sender, quantity);
    }

    function claimAllNFTs() external nonReentrant returns (uint256 mintedQuantity) {
        return _claimReservedNFTs(msg.sender, claimableNFTs(msg.sender));
    }

    function vestedBpsForToken(uint256 tokenId) public view returns (uint256) {
        if (!finalized || tokenId == 0) return 0;
        uint256 elapsed = _effectiveElapsed(tokenId);
        uint256 bps = 0;
        if (elapsed >= uint256(firstDelayMinutes) * 1 minutes) bps += firstUnlockBps;
        if (elapsed >= uint256(secondDelayMinutes) * 1 minutes) {
            bps += secondUnlockBps;
            uint256 afterSecond = elapsed - uint256(secondDelayMinutes) * 1 minutes;
            uint256 hourlyPart = afterSecond / 1 hours;
            if (hourlyPart > 23) hourlyPart = 23;
            bps += hourlyPart * hourlyUnlockBps;
        }
        uint256 daysElapsed = elapsed / 1 days;
        if (daysElapsed > 1) {
            uint256 d = daysElapsed - 1;
            uint256 until7 = d > 6 ? 6 : d;
            bps += until7 * day2To7DailyBps;
            if (daysElapsed > 7) bps += (daysElapsed - 7) * postDay7DailyBps;
        }
        if (bps > 10_000) bps = 10_000;
        return bps;
    }

    function claim(uint256 tokenId) external nonReentrant {
        _claimSingleToken(msg.sender, tokenId);
    }

    function claimMany(uint256[] calldata tokenIds) external nonReentrant returns (uint256 totalClaimedAmount) {
        require(tokenIds.length > 0, "empty batch");
        for (uint256 i = 0; i < tokenIds.length; i++) {
            totalClaimedAmount += _claimSingleToken(msg.sender, tokenIds[i]);
        }
    }

    function _claimSingleToken(address account, uint256 tokenId) internal returns (uint256 claimable) {
        require(nft.ownerOf(tokenId) == account, "not owner");
        require(!burnPoolActive[tokenId], "in burn pool");
        uint256 vested = (tokensPerNFT * vestedBpsForToken(tokenId)) / 10_000;
        claimable = vested > claimed[tokenId] ? vested - claimed[tokenId] : 0;
        require(claimable > 0, "nothing to claim");
        claimed[tokenId] += claimable;
        token.transfer(account, claimable);
        emit ClaimExecuted(account, tokenId, claimable);
    }

    function burnToPool(uint256 tokenId) external nonReentrant {
        require(nft.ownerOf(tokenId) == msg.sender, "not owner");
        require(!burnPoolActive[tokenId], "already listed");
        uint256 unclaimed = tokensPerNFT - claimed[tokenId];
        require(unclaimed > 0, "empty nft");
        uint256 immediate = unclaimed / 2;
        claimed[tokenId] += immediate;
        token.transfer(msg.sender, immediate);
        burnPoolRemaining[tokenId] = unclaimed - immediate;
        burnPoolActive[tokenId] = true;
        pauseStartedAt[tokenId] = block.timestamp;
        burnPoolIds.push(tokenId);
        nft.seizeToPool(msg.sender, tokenId);
        emit BurnPoolListed(tokenId, burnPoolRemaining[tokenId], currentBurnPoolPrice(tokenId));
    }

    function buyFromBurnPool(uint256 tokenId) external payable nonReentrant {
        require(burnPoolActive[tokenId], "not active");
        uint256 price = currentBurnPoolPrice(tokenId);
        require(msg.value >= price, "insufficient payment");
        burnPoolActive[tokenId] = false;
        pausedDuration[tokenId] += block.timestamp - pauseStartedAt[tokenId];
        pauseStartedAt[tokenId] = 0;
        uint256 buyback = (price * 90) / 100;
        uint256 issuerShare = (price * 5) / 100;
        uint256 protocolShare = price - buyback - issuerShare;
        _safeTransferNative(buybackTokenVault, buyback);
        _safeTransferNative(issuer, issuerShare);
        _safeTransferNative(protocolTreasury, protocolShare);
        if (msg.value > price) _safeTransferNative(msg.sender, msg.value - price);
        nft.releaseFromPool(msg.sender, tokenId);
        emit BurnPoolBought(tokenId, msg.sender, price);
    }

    function burnPoolLength() external view returns (uint256) { return burnPoolIds.length; }
    function burnPoolTokenIdAt(uint256 index) external view returns (uint256) { return burnPoolIds[index]; }

    function burnPoolItem(uint256 tokenId) external view returns (uint256 remaining, uint256 price, bool active) {
        return (burnPoolRemaining[tokenId], currentBurnPoolPrice(tokenId), burnPoolActive[tokenId]);
    }

    function currentBurnPoolPrice(uint256 tokenId) public view returns (uint256) {
        if (!burnPoolActive[tokenId]) return 0;
        uint256 baseValue = referencePricePerTokenWei > 0 ? (burnPoolRemaining[tokenId] * referencePricePerTokenWei) / 1e18 : 0;
        uint256 steps = (block.timestamp - pauseStartedAt[tokenId]) / 30 minutes;
        uint256 discountBps = 9_500;
        uint256 drop = steps * 500;
        if (drop >= 4_500) discountBps = 5_000; else discountBps -= drop;
        return (baseValue * discountBps) / 10_000;
    }

    function _effectiveElapsed(uint256 tokenId) internal view returns (uint256) {
        if (launchTime == 0 || block.timestamp <= launchTime) return 0;
        uint256 elapsed = block.timestamp - launchTime;
        elapsed = elapsed > pausedDuration[tokenId] ? elapsed - pausedDuration[tokenId] : 0;
        if (burnPoolActive[tokenId] && pauseStartedAt[tokenId] > 0) {
            uint256 currentPause = block.timestamp - pauseStartedAt[tokenId];
            elapsed = elapsed > currentPause ? elapsed - currentPause : 0;
        }
        return elapsed;
    }

    function _claimReservedNFTs(address user, uint256 quantity) internal returns (uint256 mintedQuantity) {
        require(finalized, "not finalized");
        uint256 remaining = claimableNFTs(user);
        require(quantity > 0 && quantity <= remaining, "bad qty");
        claimedReservations[user] += quantity;
        for (uint256 i = 0; i < quantity; i++) {
            nft.mintTo(user);
        }
        emit NFTsClaimed(user, quantity);
        return quantity;
    }

    function _distributeNativeFee(uint256 feeAmount) internal {
        if (feeAmount == 0) return;
        _safeTransferNative(issuer, feeAmount);
    }

    function _safeTransferNative(address to, uint256 amount) internal {
        if (amount == 0) return;
        (bool ok,) = payable(to).call{value: amount}("");
        require(ok, "native transfer failed");
    }

    function _provisionPancakeLiquidity(uint256 nativeAmount, uint256 tokenAmount) internal {
        require(nativeAmount > 0 && tokenAmount > 0, "pool amounts");

        IWBNB(wrappedNativeToken).deposit{value: nativeAmount}();
        IERC20(address(token)).forceApprove(positionManager, tokenAmount);
        IERC20(wrappedNativeToken).forceApprove(positionManager, nativeAmount);

        address token0 = address(token) < wrappedNativeToken ? address(token) : wrappedNativeToken;
        address token1 = address(token) < wrappedNativeToken ? wrappedNativeToken : address(token);
        uint256 amount0Desired = token0 == address(token) ? tokenAmount : nativeAmount;
        uint256 amount1Desired = token1 == address(token) ? tokenAmount : nativeAmount;

        uint160 sqrtPriceX96 = _encodeSqrtPriceX96(amount1Desired, amount0Desired);
        address pool = IPancakeV3PositionManager(positionManager).createAndInitializePoolIfNecessary(
            token0,
            token1,
            PANCAKE_POOL_FEE,
            sqrtPriceX96
        );
        pancakePool = pool;

        int24 spacing = IPancakeV3Factory(pancakeFactory).feeAmountTickSpacing(PANCAKE_POOL_FEE);
        (int24 tickLower, int24 tickUpper) = _fullRangeTicks(spacing);

        (uint256 tokenId,,,) = IPancakeV3PositionManager(positionManager).mint(
            IPancakeV3PositionManager.MintParams({
                token0: token0,
                token1: token1,
                fee: PANCAKE_POOL_FEE,
                tickLower: tickLower,
                tickUpper: tickUpper,
                amount0Desired: amount0Desired,
                amount1Desired: amount1Desired,
                amount0Min: 0,
                amount1Min: 0,
                recipient: address(liquidityLocker),
                deadline: block.timestamp
            })
        );

        positionTokenId = tokenId;
        liquidityLocker.syncPositionTokenId(tokenId);
        IERC20(address(token)).forceApprove(positionManager, 0);
        IERC20(wrappedNativeToken).forceApprove(positionManager, 0);
        emit PancakePoolReady(pool, address(liquidityLocker), tokenId);
    }

    function _encodeSqrtPriceX96(uint256 amount1, uint256 amount0) internal pure returns (uint160) {
        require(amount0 > 0 && amount1 > 0, "bad ratio");
        uint256 ratio = (amount1 * 1e18) / amount0;
        uint256 sqrtRatio = Math.sqrt(ratio);
        return uint160((sqrtRatio << 96) / 1e9);
    }

    function _fullRangeTicks(int24 spacing) internal pure returns (int24 tickLower, int24 tickUpper) {
        tickLower = (MIN_TICK / spacing) * spacing;
        if (tickLower < MIN_TICK) {
            tickLower += spacing;
        }
        tickUpper = (MAX_TICK / spacing) * spacing;
    }

    receive() external payable {}
}
