import { Market, Comptroller, Account } from "../types/models";
import { AcalaEvmEvent, AcalaEvmCall } from '@subql/acala-evm-processor';
import { BigNumber } from "ethers";
import { CToken } from "../types/models/CToken";
import { createAccount, mantissaFactorBD, updateCommonCTokenStats, zeroBD } from "./helpers";


// Setup types from ABI
type MarketListedEventArgs = [string] & { cToken: string; };
type MarketEnteredEventArgs = [string, string] & { cToken: string; account: string; };
type MarketExitedArgs = [string, string] & { cToken: string; account: string; };
type NewCloseFactorArgs = [BigInt, BigInt] & { oldCloseFactorMantissa: BigInt; newCloseFactorMantissa: BigInt; };
type NewCollateralFactorArgs = [string, BigInt, BigInt] & { cToken: string; oldCollateralFactorMantissa: BigInt; newCollateralFactorMantissa: BigInt; };
type NewLiquidationIncentiveArgs = [BigInt, BigInt] & { oldLiquidationIncentiveMantissa: BigInt; newLiquidationIncentiveMantissa: BigInt; };
type NewPriceOracleArgs = [string, string] & { oldPriceOracle: string; newPriceOracle: string; };
type NewMaxAssetsArgs = [BigInt, BigInt] & { oldMaxAssets: BigInt; newMaxAssets: BigInt; };

export async function handleMarketListed(event: AcalaEvmEvent<MarketListedEventArgs>): Promise<void> {
    logger.info(`MarketListed: ${event.args.cToken}`);
    // await createDynamicDatasource('CToken', { cToken: event.args.cToken });
    const ctoken = new CToken(event.args.cToken);
    ctoken.cToken = event.args.cToken;
    await ctoken.save();
    // Create the market for this token, since it's now been listed.
    let market = createMarket(event.args.cToken)
    await market.save()
}

export async function handleMarketEntered(event: AcalaEvmEvent<MarketEnteredEventArgs>): Promise<void> {
    let market = await Market.get(event.args.cToken);
    // Null check needed to avoid crashing on a new market added. Ideally when dynamic data
    // sources can source from the contract creation block and not the time the
    // comptroller adds the market, we can avoid this altogether
    if (market != undefined) {
        let accountID = event.args.account;
        let account = await Account.get(accountID)
        if (account == undefined) {
            await createAccount(accountID);
        }
        let cTokenStats = await updateCommonCTokenStats(
            market.id,
            market.symbol,
            accountID,
            event.transactionHash,
            BigInt(event.blockTimestamp.getTime()),
            event.blockNumber,
            event.logIndex,
        )
        cTokenStats.enteredMarket = true
        await cTokenStats.save()
    }
}

export async function handleMarketExited(event: AcalaEvmEvent<MarketExitedArgs>): Promise<void> {
    let market = await Market.get(event.args.cToken)
    // Null check needed to avoid crashing on a new market added. Ideally when dynamic data
    // sources can source from the contract creation block and not the time the
    // comptroller adds the market, we can avoid this altogether
    if (market != null) {
        let accountID = event.args.account;
        let account = await Account.get(accountID)
        if (account == null) {
            createAccount(accountID)
        }

        let cTokenStats = await updateCommonCTokenStats(
            market.id,
            market.symbol,
            accountID,
            event.transactionHash,
            BigInt(event.blockTimestamp.getTime()),
            event.blockNumber,
            event.logIndex,
        )
        cTokenStats.enteredMarket = false
        await cTokenStats.save()
    }
}

export async function handleNewCloseFactor(event: AcalaEvmEvent<NewCloseFactorArgs>): Promise<void> {
    let comptroller = await Comptroller.get('1')
    comptroller.closeFactor = BigInt(+event.args.newCloseFactorMantissa)
    await comptroller.save()
}

export async function handleNewCollateralFactor(event: AcalaEvmEvent<NewCollateralFactorArgs>): Promise<void> {
    let market = await Market.get(event.args.cToken)
    // Null check needed to avoid crashing on a new market added. Ideally when dynamic data
    // sources can source from the contract creation block and not the time the
    // comptroller adds the market, we can avoid this altogether
    if (market != null) {
        market.collateralFactor = BigInt(+event.args.newCollateralFactorMantissa / +mantissaFactorBD)
        await market.save()
    }
}


// This should be the first event acccording to etherscan but it isn't.... price oracle is. weird
export async function handleNewLiquidationIncentive(event: AcalaEvmEvent<NewLiquidationIncentiveArgs>): Promise<void> {
    let comptroller = await Comptroller.get('1')
    comptroller.liquidationIncentive = BigInt(+event.args.newLiquidationIncentiveMantissa)
    await comptroller.save()
}


// export async function handleNewMaxAssets(event: AcalaEvmEvent<NewMaxAssetsArgs>): Promise<void> {
//   let comptroller = await Comptroller.get('1')
//   comptroller.maxAssets = event.get.newMaxAssets
//   await comptroller.save()
// }

export async function handleNewPriceOracle(event: AcalaEvmEvent<NewPriceOracleArgs>): Promise<void> {
    let comptroller = await Comptroller.get('1')
    // This is the first event used in this mapping, so we use it to create the entity
    if (comptroller == null) {
        comptroller = new Comptroller('1')
    }
    comptroller.priceOracle = event.args.newPriceOracle
    await comptroller.save()
}


export function createMarket(marketAddress: string): Market {
    // log.info('createMarket: {}', [marketAddress])
    let market: Market
    // let contract = CToken.bind(Address.fromString(marketAddress))
    // log.info('contract.name(): {}', [contract.name()])

    market = new Market(marketAddress)
    market.underlyingAddress = marketAddress; //contract.underlying()
    // let underlyingContract = ERC20.bind(market.underlyingAddress as Address)
    market.underlyingDecimals = 18; //underlyingContract.decimals()
    market.underlyingName = marketAddress; //underlyingContract.name()
    market.underlyingSymbol = marketAddress; //underlyingContract.symbol()
    market.underlyingPriceUSD = zeroBD

    let interestRateModelAddress = '0x0000000000000000000000000000000000000000'// contract.try_interestRateModel()
    let reserveFactor = zeroBD;// contract.try_reserveFactorMantissa()

    market.borrowRate = zeroBD
    market.cash = zeroBD
    market.collateralFactor = zeroBD
    market.exchangeRate = zeroBD
    market.interestRateModelAddress = interestRateModelAddress
    // .reverted
    //   ? Address.fromString('0x0000000000000000000000000000000000000000')
    //   : interestRateModelAddress.value
    market.name = marketAddress// contract.name()
    market.reserves = zeroBD
    market.supplyRate = zeroBD
    market.symbol = marketAddress// contract.symbol()
    market.totalBorrows = zeroBD
    market.totalSupply = zeroBD

    market.accrualBlockNumber = 0
    market.blockTimestamp = 0
    market.borrowIndex = zeroBD
    market.reserveFactor = reserveFactor
    //.reverted ? BigInt.fromI32(0) : reserveFactor.value

    return market
}